import { config, resolveSourceName } from './config.js';
import { checkRunMode } from './preflight/guard.js';
import { log } from './util/log.js';
import { IdempotencyStore } from './store/idempotency.js';
import type { WhaleEventSource } from './whale/source.js';
import { MockWhaleSource } from './whale/mock-source.js';
import { WhaleAlertSource } from './whale/whale-alert-source.js';
import { WhaleAlertRestSource } from './whale/whale-alert-rest-source.js';
import { EthRpcSource } from './whale/eth-rpc-source.js';
import type { WhaleEvent } from './types.js';
import { X402Client } from './x402/client.js';
import type { X402Payment } from './x402/types.js';
import { loadWallet } from './solana/wallet.js';
import { analyzeWhaleEvent } from './llm/analyze.js';
import { generateImage } from './media/image.js';
import { generateVideo } from './media/video.js';
import { ReceiptInscriber } from './receipt/inscribe.js';

/** 1-based whale-event cycle counter for this agent process run. */
let cycleCount = 0;

function buildSource(): WhaleEventSource {
  const name = resolveSourceName();
  if (name === 'whale-alert') {
    log.info('Event source: Whale Alert (WebSocket, paid ALERTS plan).');
    return new WhaleAlertSource(config.whaleAlertApiKey, config.whaleThresholdUsd);
  }
  if (name === 'whale-alert-rest') {
    log.info('Event source: Whale Alert (REST polling, free tier).');
    return new WhaleAlertRestSource(config.whaleAlertApiKey, config.whaleThresholdUsd);
  }
  if (name === 'eth-rpc') {
    log.info('Event source: Ethereum public RPC (large USDC/USDT transfers, no key).');
    return new EthRpcSource(config.ethRpcUrl, config.whaleThresholdUsd);
  }
  log.info('Event source: mock (no API key required).');
  return new MockWhaleSource(config.whaleThresholdUsd);
}

function buildX402Client(): X402Client {
  if (config.agentMode === 'live') {
    const wallet = loadWallet(config.agentKeypairPath, config.solanaRpcUrl);
    log.info(`x402: live mode. Agent wallet ${wallet.address}.`);
    return new X402Client({ mode: 'live', wallet: wallet.adapter });
  }
  log.info('x402: dry-run mode. No wallet loaded; no USDC will move.');
  return new X402Client({ mode: 'dry-run' });
}

/** Append a settled x402 signature to the event's idempotency record. */
async function recordPayment(
  store: IdempotencyStore,
  eventId: string,
  payment: X402Payment | null,
): Promise<void> {
  if (payment?.settled && payment.signature) {
    await store.update(eventId, { addTxSignature: payment.signature });
  }
}

/**
 * The paid pipeline for one whale event: LLM analysis -> image -> video, each
 * an x402 call, then an on-chain Memo receipt (architecture §10). Status
 * advances analyzed -> imaged -> videoed -> complete; settled signatures and
 * the receipt signature accumulate on the event's idempotency record.
 */
async function handleNewEvent(
  event: WhaleEvent,
  store: IdempotencyStore,
  x402: X402Client,
  inscriber: ReceiptInscriber,
): Promise<void> {
  const cycleNum = ++cycleCount;
  log.info(
    `NEW whale event (cycle ${cycleNum}): ${event.symbol} ~$${event.amountUsd.toLocaleString()} ` +
      `(${event.fromLabel} -> ${event.toLabel}) id=${event.id.slice(0, 12)}...`,
  );
  try {
    const analysis = await analyzeWhaleEvent(event, x402, {
      baseUrl: config.aceDataBaseUrl,
      model: config.aceLlmModel,
      apiToken: config.aceApiToken,
    });
    log.info(
      `Analysis [${analysis.stub ? 'stub' : 'live'}] signal=${analysis.analysis.signal} :: ` +
        `${analysis.analysis.one_line}`,
    );
    await recordPayment(store, event.id, analysis.payment);
    await store.update(event.id, { status: 'analyzed' });

    const image = await generateImage(analysis.analysis, x402, {
      baseUrl: config.aceDataBaseUrl,
      model: config.aceImageModel,
      apiToken: config.aceApiToken,
    });
    log.info(`Image [${image.stub ? 'stub' : 'live'}] ${image.url ?? '(stub, no url)'}`);
    await recordPayment(store, event.id, image.payment);
    await store.update(event.id, { status: 'imaged' });

    const video = await generateVideo(analysis.analysis, x402, {
      baseUrl: config.aceDataBaseUrl,
      apiToken: config.aceApiToken,
    });
    log.info(`Video [${video.stub ? 'stub' : 'live'}] ${video.url ?? '(stub, no url)'}`);
    await recordPayment(store, event.id, video.payment);
    await store.update(event.id, { status: 'videoed' });

    // Architecture §10 — inscribe a verifiable on-chain receipt for the cycle.
    const inscription = await inscriber.inscribe({
      cycle: cycleNum,
      event,
      signal: analysis.analysis.signal,
      payments: [analysis.payment, image.payment, video.payment],
    });
    if (inscription.signature) {
      await store.update(event.id, { addTxSignature: inscription.signature });
    }
    await store.update(event.id, {
      status: 'complete',
      note: inscription.inscribed
        ? `cycle complete; receipt ${inscription.signature}`
        : `cycle complete; receipt not inscribed (${x402.mode})`,
    });

    log.info(`Cycle ${cycleNum} complete for id=${event.id.slice(0, 12)}... [${x402.mode}]`);
  } catch (err) {
    log.error(`Pipeline failed for id=${event.id.slice(0, 12)}...`, err);
    await store.update(event.id, { status: 'failed', note: String(err).slice(0, 200) });
  }
}

async function pollOnce(
  source: WhaleEventSource,
  store: IdempotencyStore,
  x402: X402Client,
  inscriber: ReceiptInscriber,
  cycleBudget: number,
): Promise<number> {
  let events: WhaleEvent[];
  try {
    events = await source.poll();
  } catch (err) {
    log.error('Poll failed; will retry next interval.', err);
    return 0;
  }

  const perPollCap = config.maxEventsPerPoll > 0 ? config.maxEventsPerPoll : Infinity;
  let fresh = 0;
  let skipped = 0;
  let deferred = 0;
  for (const event of events) {
    if (event.amountUsd < config.whaleThresholdUsd) continue;
    if (store.has(event.id)) {
      skipped++;
      log.info(`Skipping already-seen event id=${event.id.slice(0, 12)}... (idempotency store).`);
      continue;
    }
    // Respect the per-poll cap and the remaining total-cycle budget. Events
    // past the cap are intentionally sampled out, not queued.
    if (fresh >= perPollCap || fresh >= cycleBudget) {
      deferred++;
      continue;
    }
    await store.markSeen(event.id);
    fresh++;
    await handleNewEvent(event, store, x402, inscriber);
  }
  const deferNote = deferred > 0 ? `, ${deferred} over cap (sampled out)` : '';
  log.info(`Poll complete: ${fresh} new, ${skipped} duplicate(s) skipped${deferNote}.`);
  return fresh;
}

async function main(): Promise<void> {
  log.info('WhaleWatch agent starting.');
  log.info(
    `Mode ${config.agentMode}, threshold $${config.whaleThresholdUsd.toLocaleString('en-US')}, ` +
      `poll every ${config.pollIntervalMs / 1000}s` +
      `${config.maxCycles > 0 ? `, max ${config.maxCycles} cycle(s)` : ''}` +
      `${config.maxEventsPerPoll > 0 ? `, ${config.maxEventsPerPoll}/poll` : ''}.`,
  );

  // Preflight: refuse unsafe mode/source combinations before any work begins.
  const sourceName = resolveSourceName();
  const verdict = checkRunMode(config.agentMode, sourceName);
  if (!verdict.ok) {
    log.error(verdict.reason ?? 'Preflight check failed; refusing to start.');
    process.exit(1);
  }
  if (config.agentMode === 'live') {
    log.warn(`LIVE MODE: this run settles real USDC on Solana mainnet (source: ${sourceName}).`);
  }

  const store = new IdempotencyStore(config.idempotencyStorePath);
  await store.load();
  const source = buildSource();
  const x402 = buildX402Client();
  const inscriber = new ReceiptInscriber({
    mode: config.agentMode,
    rpcUrl: config.solanaRpcUrl,
    keypairPath: config.agentKeypairPath,
  });
  log.info(
    config.agentMode === 'live'
      ? 'Receipts: live — each completed cycle inscribes an SPL Memo receipt on mainnet.'
      : 'Receipts: dry-run — memo receipts are logged, not inscribed.',
  );

  let running = true;
  const shutdown = (): void => {
    if (!running) return;
    running = false;
    log.info('Shutdown signal received; stopping after current cycle.');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const maxCycles = config.maxCycles > 0 ? config.maxCycles : Infinity;
  let done = 0;

  done += await pollOnce(source, store, x402, inscriber, maxCycles - done);
  while (running && done < maxCycles) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (!running || done >= maxCycles) break;
    done += await pollOnce(source, store, x402, inscriber, maxCycles - done);
  }
  await source.close?.();
  if (maxCycles !== Infinity && done >= maxCycles) {
    log.info(`Reached MAX_CYCLES=${config.maxCycles} (${done} cycle(s) completed); stopping.`);
  }
  log.info(`WhaleWatch agent stopped. ${store.size()} event(s) on record.`);
}

main().catch((err) => {
  log.error('Fatal error.', err);
  process.exit(1);
});
