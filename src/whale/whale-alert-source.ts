import WebSocket from 'ws';
import type { WhaleEvent } from '../types.js';
import type { WhaleEventSource } from './source.js';
import { log } from '../util/log.js';

/**
 * Whale Alert WebSocket adapter — the Custom Alerts API, which is what the
 * affordable ALERTS plan provides (Whale Alert's REST API is Enterprise-tier).
 *
 * Protocol: connect to wss://leviathan.whale-alert.io/ws?api_key=KEY, send one
 * `subscribe_alerts` message, then receive alert messages pushed in real time.
 * Docs: https://developer.whale-alert.io/documentation/  (Custom Alerts API).
 *
 * The WhaleEventSource interface is pull-based (poll()), but a WebSocket is
 * push-based. This adapter bridges the two: it keeps a connection open in the
 * background, buffers every alert as it arrives, and poll() simply drains the
 * buffer. The agent's 10-minute poll cadence is unchanged — each poll returns
 * whatever the socket buffered since the last one.
 *
 * Resilience: the socket auto-reconnects with capped backoff. The subscription
 * `id` is stable across reconnects, so Whale Alert replays up to 5 minutes of
 * alerts missed during a brief drop. A persistent auth failure stops the
 * reconnect loop with a clear message instead of spinning forever.
 */

/** Custom Alerts API endpoint. */
const WS_URL = 'wss://leviathan.whale-alert.io/ws';
/** Whale Alert rejects min_value_usd below this floor. */
const MIN_VALUE_USD_FLOOR = 100_000;
/** Reconnect backoff bounds. */
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 60_000;
/** Defensive cap: a buffer that is never drained must not grow without bound. */
const MAX_BUFFER = 500;

/** A parsed Whale Alert WebSocket message. All fields optional — it is external JSON. */
interface WhaleAlertWsMessage {
  type?: string;
  error?: string;
  id?: string;
  channel_id?: string;
  timestamp?: number;
  blockchain?: string;
  transaction_type?: string;
  from?: string;
  to?: string;
  amounts?: WhaleAlertAmount[];
  text?: string;
  transaction?: { hash?: string };
}

interface WhaleAlertAmount {
  symbol?: string;
  amount?: number;
  value_usd?: number;
}

/** The outcome of interpreting one raw WebSocket message. */
export type InterpretedMessage =
  | { kind: 'alert'; event: WhaleEvent }
  | { kind: 'subscribed'; channelId: string }
  | { kind: 'error'; message: string }
  | { kind: 'ignored'; reason: string };

/**
 * Pure message interpretation — no side effects, no socket. Exported so the
 * smoke test can exercise parsing and normalization without a live connection.
 */
export function interpretWhaleAlertMessage(raw: string): InterpretedMessage {
  let msg: WhaleAlertWsMessage;
  try {
    msg = JSON.parse(raw) as WhaleAlertWsMessage;
  } catch {
    return { kind: 'ignored', reason: 'message was not valid JSON' };
  }
  if (!msg || typeof msg !== 'object') {
    return { kind: 'ignored', reason: 'message was not a JSON object' };
  }
  if (typeof msg.error === 'string') {
    return { kind: 'error', message: msg.error };
  }
  if (msg.type === 'subscribed_alerts') {
    return { kind: 'subscribed', channelId: msg.id ?? msg.channel_id ?? '(unnamed)' };
  }
  if (Array.isArray(msg.amounts)) {
    const event = normalize(msg);
    return event
      ? { kind: 'alert', event }
      : { kind: 'ignored', reason: 'alert had no transaction hash or no amounts' };
  }
  return { kind: 'ignored', reason: `unhandled message (type=${msg.type ?? 'none'})` };
}

/** Map a Whale Alert alert message into the agent's source-agnostic WhaleEvent. */
function normalize(msg: WhaleAlertWsMessage): WhaleEvent | null {
  const hash = msg.transaction?.hash;
  const amounts = Array.isArray(msg.amounts) ? msg.amounts : [];
  if (!hash || amounts.length === 0) return null;

  // A transaction can move several tokens. Use the largest single transfer for
  // the symbol/amount, and the sum of every transfer for the USD value — so the
  // value matches what Whale Alert's min_value_usd filter actually measured.
  let dominant = amounts[0]!;
  let totalUsd = 0;
  for (const a of amounts) {
    const v = a.value_usd ?? 0;
    totalUsd += v;
    if (v > (dominant.value_usd ?? 0)) dominant = a;
  }

  const ts = typeof msg.timestamp === 'number' ? msg.timestamp : Math.floor(Date.now() / 1000);
  return {
    id: hash,
    blockchain: msg.blockchain ?? 'unknown',
    symbol: dominant.symbol ? dominant.symbol.toUpperCase() : 'UNKNOWN',
    amount: dominant.amount ?? 0,
    amountUsd: Math.round(totalUsd),
    fromLabel: msg.from || 'unknown wallet',
    fromType: 'unknown',
    toLabel: msg.to || 'unknown wallet',
    toType: 'unknown',
    txType: msg.transaction_type || 'transfer',
    timestamp: new Date(ts * 1000).toISOString(),
  };
}

export class WhaleAlertSource implements WhaleEventSource {
  readonly name = 'whale-alert';
  /** Effective subscription floor — clamped up to Whale Alert's $100k minimum. */
  readonly minValueUsd: number;

  private ws: WebSocket | null = null;
  private buffer: WhaleEvent[] = [];
  private started = false;
  private closing = false;
  private authFailed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Stable subscription id — reused on reconnect to recover up to 5 min of missed alerts. */
  private readonly channelId: string;

  constructor(
    private readonly apiKey: string,
    thresholdUsd: number,
  ) {
    if (!apiKey) throw new Error('WhaleAlertSource requires WHALE_ALERT_API_KEY.');
    this.minValueUsd = Math.max(thresholdUsd, MIN_VALUE_USD_FLOOR);
    this.channelId = `whalewatch-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** Drain everything buffered since the last poll. Opens the socket on first call. */
  async poll(): Promise<WhaleEvent[]> {
    if (!this.started) this.start();
    const drained = this.buffer;
    this.buffer = [];
    return drained;
  }

  /** True while the socket is open and usable. */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /** Open the connection and keep it alive. Idempotent. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.connect();
  }

  /** Close the socket cleanly and stop reconnecting. Called on agent shutdown. */
  async close(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, 'agent shutdown');
      } catch {
        /* already closed */
      }
      this.ws = null;
    }
    log.info('Whale Alert: connection closed.');
  }

  private connect(): void {
    if (this.closing || this.authFailed) return;
    log.info(
      `Whale Alert: connecting (min_value_usd $${this.minValueUsd.toLocaleString()}, ` +
        `channel ${this.channelId})...`,
    );
    const ws = new WebSocket(`${WS_URL}?api_key=${encodeURIComponent(this.apiKey)}`);
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectAttempts = 0;
      // Subscribe to $X+ transfers across every supported blockchain. tx_types
      // is fixed to "transfer" to match the agent's registered description;
      // widen it here (mint/burn/...) if you want more event volume.
      ws.send(
        JSON.stringify({
          type: 'subscribe_alerts',
          id: this.channelId,
          tx_types: ['transfer'],
          min_value_usd: this.minValueUsd,
        }),
      );
      log.info('Whale Alert: connected; subscription request sent.');
    });

    ws.on('message', (data: WebSocket.RawData) => this.onMessage(data));

    ws.on('error', (err) => {
      // 'ws' always emits 'close' after 'error'; reconnect is handled there.
      log.error('Whale Alert: socket error.', err);
    });

    ws.on('close', (code, reason) => {
      if (this.closing || this.authFailed) return;
      const why = reason && reason.length ? `, ${reason.toString()}` : '';
      log.warn(`Whale Alert: connection closed (code ${code}${why}).`);
      this.scheduleReconnect();
    });
  }

  private onMessage(data: WebSocket.RawData): void {
    const result = interpretWhaleAlertMessage(data.toString());
    switch (result.kind) {
      case 'alert': {
        this.buffer.push(result.event);
        if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
        const e = result.event;
        log.info(
          `Whale Alert: ${e.symbol} ~$${e.amountUsd.toLocaleString()} on ${e.blockchain} ` +
            `buffered (id=${e.id.slice(0, 12)}...).`,
        );
        return;
      }
      case 'subscribed':
        log.info(`Whale Alert: subscription confirmed (channel ${result.channelId}).`);
        return;
      case 'error': {
        const fatal = result.message === 'not authenticated' || result.message === 'not allowed';
        log.error(
          `Whale Alert: API error "${result.message}".` +
            (fatal
              ? ' Check WHALE_ALERT_API_KEY and that your ALERTS subscription is active.'
              : ''),
        );
        if (fatal) {
          // Spinning on a bad key helps no one — stop and let the agent run on.
          this.authFailed = true;
          if (this.ws) {
            try {
              this.ws.close(1000, 'auth failed');
            } catch {
              /* ignore */
            }
          }
        }
        return;
      }
      case 'ignored':
        // subscribed_socials, keep-alives, unknown frames — nothing to do.
        return;
    }
  }

  private scheduleReconnect(): void {
    if (this.closing || this.authFailed || this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** (this.reconnectAttempts - 1),
      RECONNECT_MAX_MS,
    );
    log.info(`Whale Alert: reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}).`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
