/** Market direction inferred for a whale event. Set by the LLM stage (later piece). */
export type WhaleSignal = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

/**
 * Operating mode. 'live' signs and settles real USDC on Solana mainnet;
 * 'dry-run' runs the pipeline but settles nothing. Default is 'live'.
 */
export type AgentMode = 'live' | 'dry-run';

/** A normalized whale movement, source-agnostic. Every event source maps into this shape. */
export interface WhaleEvent {
  /** Dedupe key — the source transaction hash. Must be globally unique per event. */
  id: string;
  blockchain: string;
  /** Token symbol, uppercased, e.g. "USDT". */
  symbol: string;
  /** Token amount moved. */
  amount: number;
  /** USD value of the movement. */
  amountUsd: number;
  fromLabel: string;
  fromType: string;
  toLabel: string;
  toType: string;
  /** e.g. "transfer", "mint", "burn". */
  txType: string;
  /** ISO 8601 UTC timestamp. */
  timestamp: string;
}

/** Structured analysis of a whale event — the exact JSON contract the LLM must return. */
export interface WhaleAnalysis {
  token: string;
  direction: string;
  usd_value: number;
  from_entity: string;
  to_entity: string;
  signal: WhaleSignal;
  one_line: string;
  analysis: string;
}

/** Where a given event is in the paid pipeline. Advanced by later pieces. */
export type PipelineStatus =
  | 'pending'
  | 'analyzed'
  | 'imaged'
  | 'videoed'
  | 'inscribed'
  | 'complete'
  | 'failed';

/**
 * One row in the idempotency store. Created the moment an event is first seen,
 * before any paid work begins, so a retried poll can never re-pay.
 */
export interface IdempotencyRecord {
  eventId: string;
  /** ISO timestamp the event was first recorded. */
  firstSeen: string;
  status: PipelineStatus;
  /** Solana x402 settlement signatures, appended by later pipeline stages. */
  txSignatures: string[];
  note?: string;
}
