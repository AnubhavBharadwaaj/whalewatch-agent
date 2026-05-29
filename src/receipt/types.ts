import type { WhaleEvent } from '../types.js';
import type { X402Payment } from '../x402/types.js';

/** Receipt schema version. Bump on any breaking field change. */
export const RECEIPT_SCHEMA_VERSION = 1;

/**
 * What index.ts hands the inscriber at the end of a whale-event cycle —
 * everything needed to derive a receipt, and nothing more.
 */
export interface CycleInput {
  /** 1-based cycle counter for this agent process run. */
  cycle: number;
  /** The whale event that triggered the cycle. */
  event: WhaleEvent;
  /** Market signal from the LLM analysis stage. */
  signal: string;
  /**
   * The x402 payments for this cycle's paid calls, in pipeline order
   * (LLM, image, video). A null entry means that call made no payment.
   */
  payments: (X402Payment | null)[];
}

/**
 * The compact, canonical receipt inscribed on-chain via the SPL Memo program.
 * Field names are deliberately short: the whole JSON must fit comfortably
 * inside a single Solana transaction.
 */
export interface CycleReceipt {
  /** Schema version. */
  v: number;
  /** Always "whalewatch" — lets anyone filter this agent's receipts. */
  agent: string;
  /** Always "whale-cycle-receipt" — the memo discriminator. */
  kind: string;
  /** 1-based cycle number within the agent process run. */
  cycle: number;
  /** Whale event id — the source-chain transaction hash that triggered the cycle. */
  event: string;
  /** Source chain of the whale movement. */
  chain: string;
  /** Token symbol. */
  sym: string;
  /** USD value of the whale movement. */
  usd: number;
  /** Market signal: BULLISH | BEARISH | NEUTRAL. */
  signal: string;
  /** x402 spend summary for the cycle. */
  x402: {
    /** Paid calls attempted. */
    calls: number;
    /** How many settled on-chain (live mode). */
    settled: number;
    /** Total USDC billed across the cycle's paid calls, as a 6-dp string. */
    spentUsdc: string;
  };
  /** ISO 8601 UTC timestamp the receipt was built. */
  ts: string;
}

/** Outcome of an inscription attempt. */
export interface InscriptionResult {
  /** The receipt that was (or, in dry-run, would have been) inscribed. */
  receipt: CycleReceipt;
  /** The exact memo string. */
  memo: string;
  /** UTF-8 byte length of the memo. */
  bytes: number;
  /** true only when a real Memo transaction settled on mainnet. */
  inscribed: boolean;
  /** Memo transaction signature. Present only when inscribed === true. */
  signature?: string;
}
