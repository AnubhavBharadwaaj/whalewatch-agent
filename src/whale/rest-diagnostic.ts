/**
 * One-shot diagnostic for the Whale Alert REST API on the free tier.
 *
 * The smoke test's "0 events" result is ambiguous: an HTTP 200 with an empty
 * transactions array (quiet window) looks identical to an HTTP 200 whose body
 * is actually an error/upgrade notice. This script prints the raw status and
 * body for two endpoints so we can tell which is happening:
 *
 *   1. /v1/status       — key validity + which blockchains the key can access.
 *   2. /v1/transactions — last ~50 minutes at the $500k floor.
 *
 * The API key is redacted from the logged URLs. Run: npm run diag:whale-rest
 */
import { config } from '../config.js';
import { log } from '../util/log.js';

async function hit(label: string, url: string, key: string): Promise<void> {
  log.info(`=== ${label} ===`);
  log.info(`URL: ${url.replace(key, 'KEY_REDACTED')}`);
  try {
    const res = await fetch(url);
    log.info(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();
    const shown = text.slice(0, 2000);
    log.info(`Body: ${shown}${text.length > 2000 ? ' …(truncated)' : ''}`);
  } catch (err) {
    log.error('Request failed (network/DNS).', err);
  }
  log.info('');
}

async function main(): Promise<void> {
  const key = config.whaleAlertApiKey;
  if (!key) {
    log.error('WHALE_ALERT_API_KEY is not set in .env — nothing to diagnose.');
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);
  const start = now - 3000; // ~50 min, safely under the 1-hour-per-request cap

  log.info('Whale Alert REST diagnostic — raw responses follow.');
  log.info('');

  await hit('GET /v1/status', `https://api.whale-alert.io/v1/status?api_key=${key}`, key);
  await hit(
    'GET /v1/transactions (last ~50m, min $500k)',
    `https://api.whale-alert.io/v1/transactions?api_key=${key}` +
      `&min_value=500000&start=${start}&end=${now}&currency=usd&limit=100`,
    key,
  );

  log.info('Diagnostic complete. The bodies above show exactly what your key authorises.');
}

main().catch((e) => {
  log.error('Diagnostic crashed.', e);
  process.exit(1);
});
