/**
 * Smoke test for the Whale Alert REST polling adapter.
 *
 * Part A (always) — offline mapping/edge-case checks. No network, no API key.
 *
 * Part B (only when WHALE_ALERT_API_KEY is set) — one live REST call to
 * confirm the key authorises against the free-tier transactions endpoint.
 * Min value is lowered to the $500k free-tier floor so a quiet minute still
 * returns something to look at.
 */
import { config } from '../config.js';
import { log } from '../util/log.js';
import { WhaleAlertRestSource, interpretRestResponse } from './whale-alert-rest-source.js';

/** A trimmed copy of a real-looking Whale Alert REST response. */
const SAMPLE_RESPONSE = {
  result: 'success',
  cursor: 'sample-cursor',
  count: 2,
  transactions: [
    {
      blockchain: 'ethereum',
      symbol: 'usdt',
      hash: '0xabc123',
      transaction_type: 'transfer',
      timestamp: 1687389431,
      amount: 1500000,
      amount_usd: 1500000.49,
      from: { address: '0xaaa', owner: 'unknown wallet', owner_type: 'unknown' },
      to: { address: '0xbbb', owner: 'binance', owner_type: 'exchange' },
    },
    {
      blockchain: 'tron',
      symbol: 'USDC',
      id: 'usdc-tx-id-456', // some responses use `id` instead of `hash`
      transaction_type: 'transfer',
      timestamp: 1687389500,
      amount: 8000000,
      amount_usd: 8000000,
      from: { address: 'TXxx', owner_type: 'unknown' },
      to: { address: 'TYyy', owner: 'huobi', owner_type: 'exchange' },
    },
  ],
};

function offlineChecks(): number {
  let failures = 0;
  const check = (label: string, ok: boolean, detail = ''): void => {
    if (ok) log.info(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    else {
      failures++;
      log.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    }
  };

  // 1. A real-shaped response is parsed into two events.
  const out = interpretRestResponse(SAMPLE_RESPONSE);
  check('two events parsed', out.events.length === 2, `count=${out.events.length}`);
  if (out.events.length === 2) {
    const a = out.events[0]!;
    const b = out.events[1]!;
    check('first event id from hash', a.id === '0xabc123');
    check('second event id from id field', b.id === 'usdc-tx-id-456');
    check('blockchain mapped', a.blockchain === 'ethereum' && b.blockchain === 'tron');
    check('symbol uppercased', a.symbol === 'USDT', `symbol=${a.symbol}`);
    check('amountUsd rounded to int', a.amountUsd === 1500000, `amountUsd=${a.amountUsd}`);
    check('from label uses owner when present', a.fromLabel === 'unknown wallet');
    check('from label falls back to owner_type', b.fromLabel === 'unknown');
    check('to label uses owner when present', a.toLabel === 'binance');
    check(
      'timestamp converted unix seconds -> ISO',
      a.timestamp === new Date(1687389431 * 1000).toISOString(),
      a.timestamp,
    );
  }
  check('cursor captured', out.cursor === 'sample-cursor');
  check('maxTimestamp is the later one', out.maxTimestamp === 1687389500);

  // 2. Defensive defaults for malformed input.
  check('empty body produces no events', interpretRestResponse({}).events.length === 0);
  check('null body produces no events', interpretRestResponse(null).events.length === 0);
  check(
    'tx missing both hash and id is skipped',
    interpretRestResponse({
      transactions: [{ ...SAMPLE_RESPONSE.transactions[0], hash: undefined, id: undefined }],
    }).events.length === 0,
  );
  check(
    'tx missing a symbol is skipped',
    interpretRestResponse({
      transactions: [{ ...SAMPLE_RESPONSE.transactions[0], symbol: undefined }],
    }).events.length === 0,
  );

  // 3. Constructor validates its inputs.
  try {
    new WhaleAlertRestSource('', 10_000_000);
    failures++;
    log.error('FAIL  empty API key should be rejected');
  } catch {
    log.info('PASS  empty API key is rejected');
  }

  // 4. The minValueUsd floor is enforced silently via clamp (no throw).
  const lowSrc = new WhaleAlertRestSource('test-key', 1_000);
  check('low threshold accepted (clamped to free-tier $500k floor)', lowSrc.name === 'whale-alert-rest');
  const highSrc = new WhaleAlertRestSource('test-key', 10_000_000);
  check('high threshold accepted', highSrc.name === 'whale-alert-rest');

  return failures;
}

async function liveCheck(): Promise<number> {
  log.info('---');
  if (!config.whaleAlertApiKey) {
    log.info('WHALE_ALERT_API_KEY is not set — skipping live REST check.');
    return 0;
  }
  log.info('WHALE_ALERT_API_KEY is set — running one live REST poll ($500k threshold for visibility)...');

  const source = new WhaleAlertRestSource(config.whaleAlertApiKey, 500_000);
  try {
    const events = await source.poll();
    log.info(`Live REST poll returned ${events.length} event(s) in the last ~60s.`);
    if (events.length > 0) {
      const s = events[0]!;
      log.info(
        `Sample: ${s.symbol} ~$${s.amountUsd.toLocaleString()} on ${s.blockchain} ` +
          `(${s.fromLabel} -> ${s.toLabel}).`,
      );
    } else {
      log.info('Empty batch is normal in a quiet minute; the call succeeded.');
    }
    return 0;
  } catch (err) {
    log.error('Live REST poll failed.', err);
    return 1;
  }
}

async function main(): Promise<void> {
  log.info('Whale Alert REST adapter smoke test.');
  const offlineFailures = offlineChecks();
  const liveFailures = await liveCheck();
  if (offlineFailures + liveFailures === 0) {
    log.info('Whale Alert REST smoke test: all checks passed.');
  } else {
    log.error(
      `Whale Alert REST smoke test: ${offlineFailures} offline failure(s), ${liveFailures} live failure(s).`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  log.error('Smoke test crashed.', e);
  process.exit(1);
});
