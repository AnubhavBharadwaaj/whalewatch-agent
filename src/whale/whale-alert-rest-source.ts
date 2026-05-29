import type { WhaleEvent } from '../types.js';
import type { WhaleEventSource } from './source.js';
import { log } from '../util/log.js';

/**
 * Whale Alert REST polling adapter — uses the v1/transactions endpoint, which
 * IS available on Whale Alert's Free plan (10 calls/min, $500k+ transactions).
 * The Custom Alerts WebSocket is gated to the paid ALERTS plan; this adapter
 * is the free-tier alternative and a permanent fallback for the repo.
 *
 * Polling cadence: the agent's main loop calls poll() on its own interval
 * (POLL_INTERVAL_MS, default 10 min). Each poll() fetches transactions in
 * (last seen timestamp, now], maps them to WhaleEvent objects, and dedupes
 * across polls in case of overlap. The agent's IdempotencyStore is the
 * authoritative dedupe; the per-source cache here is belt-and-suspenders.
 *
 * Free-tier limits respected here:
 *   - We poll on the agent's main interval (typically 60s+), not faster, so
 *     the 10/min ceiling has plenty of headroom.
 *   - We send min_value = max($500k floor, configured threshold). The API
 *     would reject a lower min_value on free plan anyway.
 *
 * Docs: https://docs.whale-alert.io/ (Transactions API).
 */

const REST_ENDPOINT = 'https://api.whale-alert.io/v1/transactions';
/** Whale Alert's free plan rejects min_value below this; clamp up if needed. */
const MIN_VALUE_USD_FLOOR = 500_000;
/** On first poll, look back this many seconds so demos aren't empty. */
const INITIAL_LOOKBACK_SECONDS = 60;
/** Cap on the cross-poll dedupe set to avoid unbounded growth in long runs. */
const SEEN_IDS_MAX = 1000;

interface RestResponseShape {
  result?: string;
  cursor?: string;
  count?: number;
  transactions?: RestTransactionShape[];
  message?: string;
}

interface RestTransactionShape {
  blockchain?: string;
  symbol?: string;
  /** Some responses use `id`, others use `hash`; we accept either. */
  id?: string;
  hash?: string;
  transaction_type?: string;
  timestamp?: number;
  amount?: number;
  amount_usd?: number;
  transaction_count?: number;
  from?: { address?: string; owner?: string; owner_type?: string };
  to?: { address?: string; owner?: string; owner_type?: string };
}

/** The pure result of interpreting one REST response, useful for testing. */
export interface InterpretedRestResponse {
  events: WhaleEvent[];
  cursor: string | null;
  /** Latest unix-seconds timestamp among the events; used to advance the cursor. */
  maxTimestamp: number | null;
}

/**
 * Pure mapping function from a parsed Whale Alert REST response to WhaleEvents.
 * No network, no side effects. Exported so the smoke test can exercise the
 * mapping without a live connection.
 */
export function interpretRestResponse(body: unknown): InterpretedRestResponse {
  const b = (body ?? {}) as RestResponseShape;
  if (!b.transactions || !Array.isArray(b.transactions)) {
    return { events: [], cursor: null, maxTimestamp: null };
  }

  const events: WhaleEvent[] = [];
  let maxTs: number | null = null;

  for (const t of b.transactions) {
    const event = toWhaleEvent(t);
    if (!event) continue;
    events.push(event);
    if (typeof t.timestamp === 'number' && (maxTs === null || t.timestamp > maxTs)) {
      maxTs = t.timestamp;
    }
  }

  return {
    events,
    cursor: typeof b.cursor === 'string' ? b.cursor : null,
    maxTimestamp: maxTs,
  };
}

function toWhaleEvent(t: RestTransactionShape): WhaleEvent | null {
  const hash = (typeof t.hash === 'string' && t.hash) || (typeof t.id === 'string' && t.id);
  if (!hash) return null;

  const symbol = typeof t.symbol === 'string' ? t.symbol.toUpperCase() : '';
  if (!symbol) return null;

  return {
    id: hash,
    blockchain: t.blockchain ?? 'unknown',
    symbol,
    amount: typeof t.amount === 'number' ? t.amount : 0,
    amountUsd: typeof t.amount_usd === 'number' ? Math.round(t.amount_usd) : 0,
    fromLabel: t.from?.owner ?? t.from?.owner_type ?? 'unknown',
    fromType: t.from?.owner_type ?? 'unknown',
    toLabel: t.to?.owner ?? t.to?.owner_type ?? 'unknown',
    toType: t.to?.owner_type ?? 'unknown',
    txType: t.transaction_type ?? 'transfer',
    timestamp:
      typeof t.timestamp === 'number'
        ? new Date(t.timestamp * 1000).toISOString()
        : new Date().toISOString(),
  };
}

export class WhaleAlertRestSource implements WhaleEventSource {
  readonly name = 'whale-alert-rest';
  private readonly minValueUsd: number;
  private startTimestamp: number;
  private readonly seenIds = new Set<string>();

  constructor(
    private readonly apiKey: string,
    minValueUsd: number,
  ) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('WhaleAlertRestSource requires a non-empty API key.');
    }
    this.minValueUsd = Math.max(MIN_VALUE_USD_FLOOR, Math.floor(minValueUsd));
    this.startTimestamp = Math.floor(Date.now() / 1000) - INITIAL_LOOKBACK_SECONDS;
  }

  async poll(): Promise<WhaleEvent[]> {
    const endTimestamp = Math.floor(Date.now() / 1000);
    const url = new URL(REST_ENDPOINT);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('min_value', String(this.minValueUsd));
    url.searchParams.set('start', String(this.startTimestamp));
    url.searchParams.set('end', String(endTimestamp));
    url.searchParams.set('currency', 'usd');
    url.searchParams.set('limit', '100');

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (err) {
      log.warn('Whale Alert REST: network error.', err);
      return [];
    }

    if (response.status === 401) {
      log.warn('Whale Alert REST: 401 Unauthorized — check WHALE_ALERT_API_KEY.');
      return [];
    }
    if (response.status === 429) {
      log.warn('Whale Alert REST: 429 rate-limited; will retry next poll.');
      return [];
    }
    if (!response.ok) {
      log.warn(`Whale Alert REST: HTTP ${response.status}.`);
      return [];
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      log.warn('Whale Alert REST: response was not valid JSON.');
      return [];
    }

    // A 200 can still carry an error/notice body (e.g. an upgrade prompt). Surface
    // it rather than silently treating it as "no whales right now".
    const rb = (body ?? {}) as { result?: string; message?: string };
    if (rb.result && rb.result !== 'success') {
      log.warn(`Whale Alert REST: API returned result="${rb.result}" — ${rb.message ?? '(no message)'}`);
      return [];
    }

    const { events, maxTimestamp } = interpretRestResponse(body);

    // Advance the start cursor. If the batch was empty, jump to `end` so we
    // don't keep re-asking for the same empty window.
    this.startTimestamp = maxTimestamp !== null ? maxTimestamp + 1 : endTimestamp;

    // Cross-poll dedupe in case start/end windows overlap.
    const fresh: WhaleEvent[] = [];
    for (const e of events) {
      if (this.seenIds.has(e.id)) continue;
      this.seenIds.add(e.id);
      fresh.push(e);
    }
    this.trimSeenIds();

    return fresh;
  }

  private trimSeenIds(): void {
    if (this.seenIds.size <= SEEN_IDS_MAX) return;
    const overflow = this.seenIds.size - SEEN_IDS_MAX;
    const it = this.seenIds.values();
    for (let i = 0; i < overflow; i++) {
      const next = it.next();
      if (next.done) break;
      this.seenIds.delete(next.value);
    }
  }
}
