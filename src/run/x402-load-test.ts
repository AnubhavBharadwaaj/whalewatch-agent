/**
 * x402 load test — exercises the production stage code path with N
 * synthetic whale events, verifying that analyzeWhaleEvent + generateImage
 * + Seedance video sustain repeated x402 settlements without errors.
 *
 * Uses the same X402Client + signSolanaPayment + retry flow as the live
 * agent. Each cycle produces up to THREE real on-chain USDC settlements
 * to Ace Data, recorded to data/x402-load-test-receipts.jsonl.
 *
 * Synthetic-event generation is intentional and labeled: events vary across
 * cycles so each LLM prompt is distinct, but the goal is to stress the
 * payment + retry path under repeated load, not to simulate market activity.
 *
 * Video stage is intentionally skipped in 2-stage mode (default). To enable
 * the Seedance video stage and produce 3 settlements per cycle, pass --video:
 *
 *   ACE_API_TOKEN="" npx tsx src/run/x402-load-test.ts 50 --video
 *
 * Without --video, each cycle produces 2 settlements (chat + image) as before.
 *
 * Run:
 *   ACE_API_TOKEN="" npx tsx src/run/x402-load-test.ts <count> [--video]
 *
 * Example:
 *   ACE_API_TOKEN="" npx tsx src/run/x402-load-test.ts 5             # 2-stage
 *   ACE_API_TOKEN="" npx tsx src/run/x402-load-test.ts 50 --video    # 3-stage
 *
 * Settlement log appended to data/x402-load-test-receipts.jsonl (one JSON per line).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from '../config.js';
import { log } from '../util/log.js';
import { X402Client } from '../x402/client.js';
import { loadWallet } from '../solana/wallet.js';
import { analyzeWhaleEvent } from '../llm/analyze.js';
import { generateImage } from '../media/image.js';
import { aceUrl } from '../acedata/endpoints.js';
import type { WhaleEvent } from '../types.js';

const RECEIPTS_PATH = 'data/x402-load-test-receipts.jsonl';
const PACING_MS = 500;

// Seedance endpoint — cheapest stable video provider on Ace Data x402 (~$0.105/call).
// Verified to work with pre-submit pattern (probe: 2026-06-01T03:40 UTC).
const SEEDANCE_PATH = '/seedance/videos';
const SEEDANCE_MODEL = 'doubao-seedance-1-0-pro-250528';

interface SettlementRecord {
  cycleNum: number;
  ts: string;
  eventId: string;
  stage: 'chat' | 'image' | 'video';
  status: 'settled' | 'failed';
  signature?: string;
  amountAtomic?: string;
  errorMessage?: string;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function makeMockEvent(i: number): WhaleEvent {
  // Varied synthetic events so each cycle's LLM prompt is distinct.
  const tokens = ['USDC', 'USDT', 'SOL', 'WIF', 'BONK', 'JUP', 'PYTH', 'JTO'];
  const fromLabels = ['unknown wallet', 'Binance hot', 'Coinbase 7', 'Bitfinex', 'Kraken', 'OKX cold'];
  const toLabels = ['Binance 14', 'Coinbase Prime', 'unknown wallet', 'OKX', 'Bybit', 'Bitstamp'];
  const token = tokens[i % tokens.length]!;
  const fromLabel = fromLabels[i % fromLabels.length]!;
  const toLabel = toLabels[(i + 1) % toLabels.length]!;
  const amount = 1_000_000 + ((i * 137) % 9_000_000);
  const amountUsd = Math.round(amount * (0.9 + ((i * 7) % 100) / 100));
  return {
    id: `loadtest-${Date.now()}-${i.toString().padStart(3, '0')}`,
    blockchain: 'solana',
    symbol: token,
    amount,
    amountUsd,
    fromLabel,
    fromType: 'unknown',
    toLabel,
    toType: 'exchange',
    txType: 'transfer',
    timestamp: new Date().toISOString(),
  };
}

function recordSettlement(s: SettlementRecord): void {
  const dir = path.dirname(RECEIPTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(RECEIPTS_PATH, JSON.stringify(s) + '\n');
}

interface CycleOutcome {
  chatSig?: string;
  chatAmount?: string;
  imageSig?: string;
  imageAmount?: string;
  videoSig?: string;
  videoAmount?: string;
  errors: string[];
}

async function runOneCycle(
  cycleNum: number,
  x402: X402Client,
  enableVideo: boolean,
): Promise<CycleOutcome> {
  const event = makeMockEvent(cycleNum);
  log.info(
    `[cycle ${cycleNum}] ${event.symbol} ~$${event.amountUsd.toLocaleString('en-US')} ` +
      `(${event.fromLabel} -> ${event.toLabel})`,
  );

  const out: CycleOutcome = { errors: [] };

  // --- CHAT stage ---
  let analysisData;
  try {
    const r = await analyzeWhaleEvent(event, x402, {
      baseUrl: config.aceDataBaseUrl,
      model: config.aceLlmModel,
      apiToken: undefined, // force x402 path regardless of env
    });
    analysisData = r.analysis;
    if (r.payment?.settled && r.payment.signature) {
      out.chatSig = r.payment.signature;
      out.chatAmount = r.payment.amountAtomic;
      recordSettlement({
        cycleNum,
        ts: new Date().toISOString(),
        eventId: event.id,
        stage: 'chat',
        status: 'settled',
        signature: out.chatSig,
        amountAtomic: out.chatAmount,
      });
      const usd = (Number(r.payment.amountAtomic) / 1e6).toFixed(6);
      log.info(`[cycle ${cycleNum}] chat settled  ${out.chatSig.slice(0, 16)}... ($${usd})`);
    } else {
      log.warn(`[cycle ${cycleNum}] chat returned without a settled payment.`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    out.errors.push(`chat: ${msg}`);
    recordSettlement({
      cycleNum,
      ts: new Date().toISOString(),
      eventId: event.id,
      stage: 'chat',
      status: 'failed',
      errorMessage: msg,
    });
    log.error(`[cycle ${cycleNum}] chat failed: ${msg.slice(0, 200)}`);
    return out; // image + video stages need analysis output
  }

  // --- IMAGE stage ---
  try {
    const r = await generateImage(analysisData, x402, {
      baseUrl: config.aceDataBaseUrl,
      model: config.aceImageModel,
      apiToken: undefined,
    });
    if (r.payment?.settled && r.payment.signature) {
      out.imageSig = r.payment.signature;
      out.imageAmount = r.payment.amountAtomic;
      recordSettlement({
        cycleNum,
        ts: new Date().toISOString(),
        eventId: event.id,
        stage: 'image',
        status: 'settled',
        signature: out.imageSig,
        amountAtomic: out.imageAmount,
      });
      const usd = (Number(r.payment.amountAtomic) / 1e6).toFixed(6);
      log.info(`[cycle ${cycleNum}] image settled ${out.imageSig.slice(0, 16)}... ($${usd})`);
    } else {
      log.warn(`[cycle ${cycleNum}] image returned without a settled payment.`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    out.errors.push(`image: ${msg}`);
    recordSettlement({
      cycleNum,
      ts: new Date().toISOString(),
      eventId: event.id,
      stage: 'image',
      status: 'failed',
      errorMessage: msg,
    });
    log.error(`[cycle ${cycleNum}] image failed: ${msg.slice(0, 200)}`);
  }

  // --- VIDEO (Seedance) stage ---
  if (enableVideo) {
    try {
      const seedanceUrl = aceUrl(config.aceDataBaseUrl, SEEDANCE_PATH);
      const videoPrompt =
        `Short 5-second cinematic clip: ${analysisData.token} whale movement ` +
        `${analysisData.direction}, ${analysisData.signal.toLowerCase()} signal, ` +
        `dark abstract visualization, no text overlay.`;
      const r = await x402.request(seedanceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: SEEDANCE_MODEL,
          prompt: videoPrompt,
        }),
      });
      if (r.payment?.settled && r.payment.signature) {
        out.videoSig = r.payment.signature;
        out.videoAmount = r.payment.amountAtomic;
        recordSettlement({
          cycleNum,
          ts: new Date().toISOString(),
          eventId: event.id,
          stage: 'video',
          status: 'settled',
          signature: out.videoSig,
          amountAtomic: out.videoAmount,
        });
        const usd = (Number(r.payment.amountAtomic) / 1e6).toFixed(6);
        log.info(`[cycle ${cycleNum}] video settled ${out.videoSig.slice(0, 16)}... ($${usd})`);
      } else {
        log.warn(`[cycle ${cycleNum}] video returned without a settled payment.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      out.errors.push(`video: ${msg}`);
      recordSettlement({
        cycleNum,
        ts: new Date().toISOString(),
        eventId: event.id,
        stage: 'video',
        status: 'failed',
        errorMessage: msg,
      });
      log.error(`[cycle ${cycleNum}] video failed: ${msg.slice(0, 200)}`);
    }
  }

  return out;
}

async function main(): Promise<void> {
  // Parse args: <count> [--video]
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const enableVideo = process.argv.includes('--video');
  const count = parseInt(args[0] ?? '1', 10);
  if (Number.isNaN(count) || count < 1 || count > 200) {
    console.error('Usage: tsx src/run/x402-load-test.ts <count> [--video]');
    process.exit(1);
  }

  const stagesPerCycle = enableVideo ? 3 : 2;
  log.info(`=== x402 load test: ${count} cycle${count === 1 ? '' : 's'} (${stagesPerCycle} stages/cycle${enableVideo ? ', video ON' : ''}) ===`);

  if (config.aceApiToken) {
    log.error('ACE_API_TOKEN is set — would hit credit path, not x402.');
    log.error('Run with:  ACE_API_TOKEN="" npx tsx src/run/x402-load-test.ts <count>');
    process.exit(1);
  }
  if (config.agentMode !== 'live') {
    log.error(`AGENT_MODE must be "live" (currently: "${config.agentMode}").`);
    process.exit(1);
  }

  const wallet = loadWallet(config.agentKeypairPath, config.solanaRpcUrl);
  log.info(`Wallet: ${wallet.address}`);
  const x402 = new X402Client({ mode: 'live', wallet: wallet.adapter });

  let settlements = 0;
  let stageErrors = 0;
  let totalAtomic = BigInt(0);
  const startTime = Date.now();

  for (let i = 1; i <= count; i++) {
    try {
      const r = await runOneCycle(i, x402, enableVideo);
      if (r.chatSig) {
        settlements++;
        if (r.chatAmount) totalAtomic += BigInt(r.chatAmount);
      }
      if (r.imageSig) {
        settlements++;
        if (r.imageAmount) totalAtomic += BigInt(r.imageAmount);
      }
      if (r.videoSig) {
        settlements++;
        if (r.videoAmount) totalAtomic += BigInt(r.videoAmount);
      }
      stageErrors += r.errors.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[cycle ${i}] unexpected: ${msg.slice(0, 200)}`);
      stageErrors++;
    }
    if (i < count) await sleep(PACING_MS);
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalUsd = (Number(totalAtomic) / 1e6).toFixed(6);

  log.info('---');
  log.info('Load test complete:');
  log.info(`  Cycles run        : ${count}`);
  log.info(`  Stages per cycle  : ${stagesPerCycle}`);
  log.info(`  Settlements landed: ${settlements}  (target: ${count * stagesPerCycle})`);
  log.info(`  Stage errors      : ${stageErrors}`);
  log.info(`  Total settled     : ~$${totalUsd} USDC`);
  log.info(`  Elapsed           : ${elapsedSec}s  (avg ${(Number(elapsedSec) / count).toFixed(1)}s/cycle)`);
  log.info(`  Receipt log       : ${RECEIPTS_PATH}`);
}

main().catch((err) => {
  log.error('Load test crashed:', err);
  process.exit(1);
});
