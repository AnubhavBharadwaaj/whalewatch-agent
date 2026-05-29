import type { WhaleEvent } from '../types.js';
import type { WhaleEventSource } from './source.js';

const TOKENS = [
  { symbol: 'BTC', blockchain: 'bitcoin', price: 96_000 },
  { symbol: 'ETH', blockchain: 'ethereum', price: 3_400 },
  { symbol: 'USDT', blockchain: 'tron', price: 1 },
  { symbol: 'USDC', blockchain: 'ethereum', price: 1 },
  { symbol: 'SOL', blockchain: 'solana', price: 180 },
];

const ENTITIES = [
  { label: 'unknown wallet', type: 'unknown' },
  { label: 'Binance', type: 'exchange' },
  { label: 'Coinbase', type: 'exchange' },
  { label: 'Kraken', type: 'exchange' },
  { label: 'OKX', type: 'exchange' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomHash(): string {
  const hex = '0123456789abcdef';
  let s = '0x';
  for (let i = 0; i < 64; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

/**
 * Generates realistic whale events with zero API key, so the entire pipeline
 * can be built and tested today. Roughly one poll in four replays a recently
 * emitted id — that lets you watch the idempotency store reject duplicates.
 */
export class MockWhaleSource implements WhaleEventSource {
  readonly name = 'mock';
  private recentIds: string[] = [];

  constructor(private readonly thresholdUsd: number) {}

  async poll(): Promise<WhaleEvent[]> {
    const count = 1 + Math.floor(Math.random() * 3); // 1-3 events per poll
    const events: WhaleEvent[] = [];
    for (let i = 0; i < count; i++) {
      if (this.recentIds.length > 0 && Math.random() < 0.25) {
        // Replay a recent id to exercise the dedupe path.
        events.push(this.build(pick(this.recentIds)));
        continue;
      }
      const id = randomHash();
      this.recentIds.push(id);
      if (this.recentIds.length > 20) this.recentIds.shift();
      events.push(this.build(id));
    }
    return events;
  }

  private build(id: string): WhaleEvent {
    const token = pick(TOKENS);
    const from = pick(ENTITIES);
    let to = pick(ENTITIES);
    while (to.label === from.label) to = pick(ENTITIES);

    // USD value at or above threshold, capped at $250M.
    const amountUsd = this.thresholdUsd + Math.random() * (250_000_000 - this.thresholdUsd);

    return {
      id,
      blockchain: token.blockchain,
      symbol: token.symbol,
      amount: Number((amountUsd / token.price).toFixed(4)),
      amountUsd: Math.round(amountUsd),
      fromLabel: from.label,
      fromType: from.type,
      toLabel: to.label,
      toType: to.type,
      txType: 'transfer',
      timestamp: new Date().toISOString(),
    };
  }
}
