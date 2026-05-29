/**
 * Smoke test for the Whale Alert WebSocket adapter.
 *
 * Part A (always) — offline checks: message interpretation and normalization,
 * and the constructor's min-value clamp. No network, no API key.
 *
 * Part B (only when WHALE_ALERT_API_KEY is set) — a live connection test:
 * connect, subscribe, wait, report. This is the staircase's "verify before
 * going live" step. Skipped automatically when no key is configured.
 */
import { config } from '../config.js';
import { log } from '../util/log.js';
import { WhaleAlertSource, interpretWhaleAlertMessage } from './whale-alert-source.js';

/** The example alert from Whale Alert's WebSocket documentation. */
const SAMPLE_ALERT = JSON.stringify({
  channel_id: 'xlLZ7tJq',
  timestamp: 1687389431,
  blockchain: 'ethereum',
  transaction_type: 'transfer',
  from: 'unknown wallet',
  to: 'binance',
  amounts: [
    { symbol: 'USDC', amount: 20006425.310176, value_usd: 20008425.95270702 },
    { symbol: 'WETH', amount: 5122.118861012107, value_usd: 9702266.325340524 },
  ],
  text: 'sample',
  transaction: { hash: '0x60b2f4ac1d2a1308aa04c82d70c388404c92c1d3474c13ca29188ada1edad9dc' },
});

function offlineChecks(): number {
  let failures = 0;
  const check = (label: string, ok: boolean, detail = ''): void => {
    if (ok) {
      log.info(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    } else {
      failures++;
      log.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    }
  };

  // 1. A real alert is interpreted and normalized.
  const alert = interpretWhaleAlertMessage(SAMPLE_ALERT);
  check('sample alert is classified as an alert', alert.kind === 'alert');
  if (alert.kind === 'alert') {
    const e = alert.event;
    check(
      'event id is the transaction hash',
      e.id === '0x60b2f4ac1d2a1308aa04c82d70c388404c92c1d3474c13ca29188ada1edad9dc',
    );
    check('blockchain mapped', e.blockchain === 'ethereum');
    check('dominant symbol is the largest transfer', e.symbol === 'USDC', `symbol=${e.symbol}`);
    check('amountUsd sums every transfer', e.amountUsd === 29710692, `amountUsd=${e.amountUsd}`);
    check('from/to labels mapped', e.fromLabel === 'unknown wallet' && e.toLabel === 'binance');
    check('tx type mapped', e.txType === 'transfer');
    check(
      'timestamp converted from unix seconds to ISO',
      e.timestamp === new Date(1687389431 * 1000).toISOString(),
      e.timestamp,
    );
  }

  // 2. Subscription confirmation.
  const sub = interpretWhaleAlertMessage('{"type":"subscribed_alerts","id":"abc123"}');
  check(
    'subscription confirmation recognized',
    sub.kind === 'subscribed' && sub.channelId === 'abc123',
  );

  // 3. API error.
  const err = interpretWhaleAlertMessage('{"error":"not authenticated"}');
  check('API error recognized', err.kind === 'error' && err.message === 'not authenticated');

  // 4. Non-alert / junk frames are ignored, never crashed on.
  check(
    'social-post frame ignored',
    interpretWhaleAlertMessage('{"type":"subscribed_socials"}').kind === 'ignored',
  );
  check('non-JSON frame ignored', interpretWhaleAlertMessage('not json at all').kind === 'ignored');
  check(
    'alert without a hash ignored',
    interpretWhaleAlertMessage('{"amounts":[{"symbol":"BTC","value_usd":1}]}').kind === 'ignored',
  );

  // 5. Constructor: empty key rejected, min value clamped to Whale Alert's $100k floor.
  let keyRejected = false;
  try {
    new WhaleAlertSource('', 10_000_000);
  } catch {
    keyRejected = true;
  }
  check('empty API key is rejected', keyRejected);
  check(
    'sub-floor threshold clamps up to $100k',
    new WhaleAlertSource('k', 50_000).minValueUsd === 100_000,
  );
  check(
    '$10M threshold is kept as-is',
    new WhaleAlertSource('k', 10_000_000).minValueUsd === 10_000_000,
  );

  return failures;
}

async function liveCheck(): Promise<number> {
  log.info('---');
  log.info('WHALE_ALERT_API_KEY is set — running a live connection test (~20s).');
  const source = new WhaleAlertSource(config.whaleAlertApiKey, config.whaleThresholdUsd);
  await source.poll(); // opens the socket + subscribes
  await new Promise((r) => setTimeout(r, 20_000));
  const events = await source.poll();
  const connected = source.isConnected();
  await source.close();
  log.info(`Live test: connected=${connected}, events received in the 20s window=${events.length}.`);
  if (!connected) {
    log.error(
      'Live test: socket was not open. Check the API key and that the ALERTS subscription is active.',
    );
    return 1;
  }
  log.info('Live test: connection + subscription OK. (Zero events in 20s is normal at a $10M floor.)');
  return 0;
}

async function main(): Promise<void> {
  log.info('Whale Alert adapter smoke test.');
  let failures = offlineChecks();

  if (config.whaleAlertApiKey) {
    failures += await liveCheck();
  } else {
    log.info('---');
    log.info('WHALE_ALERT_API_KEY not set — skipping the live connection test.');
    log.info('Set it in .env and re-run to verify the live socket before going live.');
  }

  if (failures > 0) {
    log.error(`Whale Alert smoke test: ${failures} failure(s).`);
    process.exit(1);
  }
  log.info('Whale Alert smoke test: all checks passed.');
}

main().catch((err) => {
  log.error('Whale Alert smoke test crashed.', err);
  process.exit(1);
});
