import { signSolanaPayment } from '@acedatacloud/x402-client';
import type {
  PaymentRequirement,
  PaymentRequiredResponse,
  SolanaWalletAdapter,
} from '@acedatacloud/x402-client';
import { log } from '../util/log.js';
import type { AgentMode } from '../types.js';
import type { X402Payment, X402Result } from './types.js';

const PAYMENT_NETWORK = 'solana';

export interface X402ClientOptions {
  mode: AgentMode;
  /** Required in 'live' mode. Omit for 'dry-run'. */
  wallet?: SolanaWalletAdapter;
}

/**
 * Performs HTTP requests through the x402 payment flow.
 *
 * live mode    -> on a 402, signs and settles a USDC payment on Solana, then
 *                 retries the request with the X-Payment header.
 * dry-run mode -> on a 402, logs the would-be payment and stops. No USDC moves.
 */
export class X402Client {
  constructor(private readonly opts: X402ClientOptions) {
    if (opts.mode === 'live' && !opts.wallet) {
      throw new Error('X402Client in live mode requires a wallet.');
    }
  }

  /** The operating mode this client was created with. */
  get mode(): AgentMode {
    return this.opts.mode;
  }

  /**
   * Pre-flight pricing. Hits the endpoint unpaid and returns the parsed 402
   * payment requirements without paying anything. Returns null if the endpoint
   * did not ask for payment.
   */
  async previewPrice(url: string, init?: RequestInit): Promise<PaymentRequiredResponse | null> {
    const res = await fetch(url, init);
    if (res.status !== 402) return null;
    return this.parsePaymentRequired(await res.text(), url);
  }

  /** Perform a request through the full x402 flow. */
  async request(url: string, init?: RequestInit): Promise<X402Result> {
    const first = await fetch(url, init);

    // Endpoint did not require payment — pass the result straight back.
    if (first.status !== 402) {
      return { ok: first.ok, status: first.status, body: await readBody(first), payment: null };
    }

    const required = this.parsePaymentRequired(await first.text(), url);
    const requirement = selectSolanaRequirement(required);
    const base = {
      mode: this.opts.mode,
      amountAtomic: requirement.maxAmountRequired,
      asset: requirement.asset,
      network: requirement.network,
      payTo: requirement.payTo,
    };

    if (this.opts.mode === 'dry-run') {
      log.warn(
        `DRY-RUN: would pay ${requirement.maxAmountRequired} (atomic) of ${requirement.asset} ` +
          `to ${requirement.payTo} on ${requirement.network}. No USDC moved.`,
      );
      const payment: X402Payment = { settled: false, ...base };
      return { ok: false, status: 402, body: required, payment };
    }

    // live: sign + settle on-chain, then retry with the X-Payment header.
    const envelope = await signSolanaPayment(requirement, this.opts.wallet!);
    const signature = (envelope.payload as { signature: string }).signature;
    log.info(`x402 settled on Solana: ${signature}`);

    // X-Payment header is the base64 of the JSON envelope.
    const header = Buffer.from(JSON.stringify(envelope)).toString('base64');
    const retry = await fetch(url, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), 'X-Payment': header },
    });

    const payment: X402Payment = { settled: true, signature, ...base };
    return { ok: retry.ok, status: retry.status, body: await readBody(retry), payment };
  }

  private parsePaymentRequired(text: string, url: string): PaymentRequiredResponse {
    try {
      return JSON.parse(text) as PaymentRequiredResponse;
    } catch {
      // Defensive: an empty or HTML 402 body must not crash with a bare
      // "Unexpected end of JSON input". (The EOF-error lesson.)
      throw new Error(
        `x402: 402 from ${url} but body was not JSON (length ${text.length}). ` +
          `First 200 chars: ${text.slice(0, 200)}`,
      );
    }
  }
}

function selectSolanaRequirement(required: PaymentRequiredResponse): PaymentRequirement {
  const accepts = required.accepts ?? [];
  const match = accepts.find((a) => a.network === PAYMENT_NETWORK);
  if (!match) {
    const available = accepts.map((a) => a.network).join(', ') || '<none>';
    throw new Error(
      `x402: no Solana payment requirement in the 402 response. Available networks: ${available}`,
    );
  }
  return match;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text; // non-JSON body — return raw text
  }
}
