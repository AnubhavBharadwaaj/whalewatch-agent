/**
 * Smoke test for the Ethereum public-RPC whale source.
 *
 * Part A (always) — offline decode/threshold/label checks, no network.
 * Part B (always attempted) — one live poll against the configured RPC. In an
 * environment that can't reach the RPC this just logs a warning; on your
 * machine it prints how many large stablecoin transfers were seen.
 */
import { config } from '../config.js';
import { log } from '../util/log.js';
import { EthRpcSource, decodeTransferLog, topicToAddress, shortAddress } from './eth-rpc-source.js';

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BINANCE = '0x28c6c06298d514db089934071355e5743bf21d60';

/** $12,500,000 USDC = 12.5e6 * 1e6 raw units, as a 32-byte hex value. */
const TWELVE_POINT_FIVE_M = `0x${(12_500_000n * 1_000_000n).toString(16).padStart(64, '0')}`;
const FROM_TOPIC = `0x${'00'.repeat(12)}${BINANCE.slice(2)}`;
const TO_TOPIC = `0x${'00'.repeat(12)}${'9'.repeat(40)}`; // an unknown wallet

const SAMPLE_LOG = {
  address: USDC,
  topics: [TRANSFER_TOPIC, FROM_TOPIC, TO_TOPIC],
  data: TWELVE_POINT_FIVE_M,
  transactionHash: '0xfeed',
  logIndex: '0x4',
  blockNumber: '0x10',
};

const NOW = new Date().toISOString();

function offlineChecks(): number {
  let failures = 0;
  const check = (label: string, ok: boolean, detail = ''): void => {
    if (ok) log.info(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    else {
      failures++;
      log.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    }
  };

  // topic -> address
  check('topicToAddress strips padding', topicToAddress(FROM_TOPIC) === BINANCE);
  check('shortAddress form', shortAddress(BINANCE) === '0x28c6…1d60', shortAddress(BINANCE));

  // Decode a valid USDC transfer
  const e = decodeTransferLog(SAMPLE_LOG, NOW);
  check('valid log decodes', e !== null);
  if (e) {
    check('symbol is USDC', e.symbol === 'USDC');
    check('usd value computed', e.amountUsd === 12_500_000, `amountUsd=${e.amountUsd}`);
    check('amount in token units', e.amount === 12_500_000);
    check('from labelled from known map', e.fromLabel === 'Binance' && e.fromType === 'exchange');
    check('to falls back to short addr', e.toType === 'unknown' && e.toLabel.includes('…'));
    check('id is hash + logIndex', e.id === '0xfeed-0x4');
    check('blockchain is ethereum', e.blockchain === 'ethereum');
    check('timestamp is detection time', e.timestamp === NOW);
  }

  // Reject non-watched token
  check(
    'unknown token rejected',
    decodeTransferLog({ ...SAMPLE_LOG, address: '0xdeadbeef' }, NOW) === null,
  );
  // Reject non-Transfer topic
  check(
    'non-Transfer topic rejected',
    decodeTransferLog({ ...SAMPLE_LOG, topics: ['0xabc', FROM_TOPIC, TO_TOPIC] }, NOW) === null,
  );
  // Reject malformed (too few topics)
  check('missing topics rejected', decodeTransferLog({ ...SAMPLE_LOG, topics: [TRANSFER_TOPIC] }, NOW) === null);
  // Bad data hex doesn't throw
  check('bad data hex rejected', decodeTransferLog({ ...SAMPLE_LOG, data: 'not-hex' }, NOW) === null);

  // Constructor validation
  try {
    new EthRpcSource('', 10_000_000);
    failures++;
    log.error('FAIL  empty RPC URL should be rejected');
  } catch {
    log.info('PASS  empty RPC URL is rejected');
  }
  check('valid construction', new EthRpcSource('https://example', 10_000_000).name === 'eth-rpc');

  return failures;
}

async function liveCheck(): Promise<number> {
  log.info('---');
  log.info(`Live poll against ${config.ethRpcUrl} (threshold $${config.whaleThresholdUsd.toLocaleString('en-US')})...`);
  const source = new EthRpcSource(config.ethRpcUrl, config.whaleThresholdUsd);
  try {
    const events = await source.poll();
    log.info(`Live poll returned ${events.length} whale event(s).`);
    if (events.length > 0) {
      const s = events[0]!;
      log.info(`Sample: ${s.symbol} $${s.amountUsd.toLocaleString('en-US')} (${s.fromLabel} -> ${s.toLabel}).`);
    } else {
      log.info('No transfers above threshold in this window. Lower WHALE_THRESHOLD_USD to see more.');
    }
    return 0;
  } catch (err) {
    // Treated as environmental (e.g. no network access here), not a hard failure.
    log.warn(`Live poll could not complete: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}

async function main(): Promise<void> {
  log.info('Ethereum RPC whale source smoke test.');
  const offlineFailures = offlineChecks();
  await liveCheck();
  if (offlineFailures === 0) {
    log.info('Ethereum RPC smoke test: all offline checks passed.');
  } else {
    log.error(`Ethereum RPC smoke test: ${offlineFailures} offline failure(s).`);
    process.exit(1);
  }
}

main().catch((e) => {
  log.error('Smoke test crashed.', e);
  process.exit(1);
});
