import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { loadKeypair } from '../solana/wallet.js';
import { log } from '../util/log.js';
import type { AgentMode } from '../types.js';
import type { CycleInput, InscriptionResult } from './types.js';
import { buildReceipt, serializeReceipt, buildMemoInstruction } from './memo.js';

export interface InscriberOptions {
  /** 'live' inscribes a real Memo transaction; 'dry-run' only logs. */
  mode: AgentMode;
  /** Solana RPC URL. Used only in live mode. */
  rpcUrl: string;
  /** Path to the agent keypair JSON. Loaded lazily, only in live mode. */
  keypairPath: string;
}

/**
 * Inscribes a verifiable receipt for each completed whale-event cycle on
 * Solana mainnet via the SPL Memo program (architecture §10).
 *
 * In live mode every cycle ends with a real Memo transaction — a permanent,
 * explorer-visible record tying the whale trigger to the x402 spend it caused,
 * landing in the agent wallet's history right next to the settlement
 * transactions it summarizes. In dry-run nothing is sent; the exact memo that
 * would be inscribed is logged so the format can be inspected off-chain.
 *
 * A memo transaction costs only the ~0.000005 SOL base fee, so inscribing
 * every cycle is negligible against the agent's gas budget.
 */
export class ReceiptInscriber {
  readonly mode: AgentMode;
  private readonly rpcUrl: string;
  private readonly keypairPath: string;
  /** Lazily initialized in live mode so dry-run never touches a keypair file. */
  private keypair: Keypair | null = null;
  private connection: Connection | null = null;

  constructor(opts: InscriberOptions) {
    this.mode = opts.mode;
    this.rpcUrl = opts.rpcUrl;
    this.keypairPath = opts.keypairPath;
  }

  /**
   * Build the receipt for a cycle and, in live mode, inscribe it on-chain.
   * Never throws: a failed receipt must not fail a cycle whose paid work has
   * already completed — the failure is logged and reported in the result.
   */
  async inscribe(input: CycleInput): Promise<InscriptionResult> {
    const receipt = buildReceipt(input);
    const memo = serializeReceipt(receipt);
    const bytes = Buffer.byteLength(memo, 'utf8');

    if (this.mode === 'dry-run') {
      log.info(`[dry-run] receipt built (${bytes} B), not inscribed: ${memo}`);
      return { receipt, memo, bytes, inscribed: false };
    }

    try {
      const signature = await this.sendMemo(memo);
      log.info(`Receipt inscribed on-chain (${bytes} B). Memo tx: ${signature}`);
      return { receipt, memo, bytes, inscribed: true, signature };
    } catch (err) {
      log.error("Receipt inscription failed; the cycle's paid work is unaffected.", err);
      return { receipt, memo, bytes, inscribed: false };
    }
  }

  /** Broadcast a single-instruction Memo transaction and await confirmation. */
  private async sendMemo(memo: string): Promise<string> {
    if (!this.keypair) this.keypair = loadKeypair(this.keypairPath);
    if (!this.connection) this.connection = new Connection(this.rpcUrl, 'confirmed');
    const ix = buildMemoInstruction(memo, this.keypair.publicKey);
    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [this.keypair]);
  }
}
