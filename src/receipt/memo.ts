import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import type { CycleInput, CycleReceipt } from './types.js';
import { RECEIPT_SCHEMA_VERSION } from './types.js';
import type { X402Payment } from '../x402/types.js';

/**
 * SPL Memo program v2 — the canonical Solana program for attaching a UTF-8
 * note to a transaction. Every memo is visible in the signer's transaction
 * history and on any explorer; this is what makes each WhaleWatch cycle
 * publicly auditable.
 */
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/** USDC has 6 decimal places. */
const USDC_DECIMALS = 6;

/**
 * Safe ceiling for the memo string, in bytes. A Solana transaction is capped
 * at 1232 bytes; with a single memo instruction and one signer the memo can
 * run to roughly 560 bytes. 500 leaves comfortable headroom — and a receipt is
 * far smaller than that in practice (~250 bytes).
 */
export const MEMO_MAX_BYTES = 500;

/** Sum the x402 atomic amounts into a fixed 6-dp USDC string. Skips nulls. */
function totalSpentUsdc(payments: (X402Payment | null)[]): string {
  let atomic = 0n;
  for (const p of payments) {
    if (!p) continue;
    try {
      atomic += BigInt(p.amountAtomic);
    } catch {
      // A malformed amount string must never crash receipt building.
    }
  }
  const whole = atomic / 1_000_000n;
  const frac = (atomic % 1_000_000n).toString().padStart(USDC_DECIMALS, '0');
  return `${whole.toString()}.${frac}`;
}

/** Derive the canonical receipt from a completed cycle's inputs. */
export function buildReceipt(input: CycleInput): CycleReceipt {
  const settled = input.payments.filter((p) => p?.settled === true).length;
  return {
    v: RECEIPT_SCHEMA_VERSION,
    agent: 'whalewatch',
    kind: 'whale-cycle-receipt',
    cycle: input.cycle,
    event: input.event.id,
    chain: input.event.blockchain,
    sym: input.event.symbol,
    usd: input.event.amountUsd,
    signal: input.signal,
    x402: {
      calls: input.payments.length,
      settled,
      spentUsdc: totalSpentUsdc(input.payments),
    },
    ts: new Date().toISOString(),
  };
}

/** Serialize a receipt to the compact JSON string that goes on-chain. */
export function serializeReceipt(receipt: CycleReceipt): string {
  return JSON.stringify(receipt);
}

/**
 * Build the SPL Memo instruction for a receipt string. The signer is listed in
 * the instruction keys so the memo is provably attributable to the agent
 * wallet. Throws if the memo exceeds the safe byte ceiling.
 */
export function buildMemoInstruction(memo: string, signer: PublicKey): TransactionInstruction {
  const data = Buffer.from(memo, 'utf8');
  if (data.length > MEMO_MAX_BYTES) {
    throw new Error(`Memo is ${data.length} bytes; the safe limit is ${MEMO_MAX_BYTES}.`);
  }
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data,
  });
}
