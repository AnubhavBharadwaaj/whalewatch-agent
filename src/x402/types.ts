import type { AgentMode } from '../types.js';
import type { PaymentRequiredResponse } from '@acedatacloud/x402-client';

/** What a single x402 call paid — or, in dry-run, would have paid. */
export interface X402Payment {
  /** true only when a real on-chain settlement occurred (live mode). */
  settled: boolean;
  mode: AgentMode;
  /** On-chain settlement signature. Present only when settled === true. */
  signature?: string;
  /** Amount in the asset's smallest unit, as a string (from maxAmountRequired). */
  amountAtomic: string;
  /** USDC mint address. */
  asset: string;
  network: string;
  payTo: string;
}

export interface X402Result {
  ok: boolean;
  status: number;
  /** Parsed response body. In dry-run on a 402, this is the 402 body itself. */
  body: unknown;
  /** null when the endpoint returned without a 402 (no payment was needed). */
  payment: X402Payment | null;
}

export type { PaymentRequiredResponse };
