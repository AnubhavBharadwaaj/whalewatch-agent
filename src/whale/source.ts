import type { WhaleEvent } from '../types.js';

/**
 * A source of whale events. The rest of the agent depends only on this
 * interface, never on a concrete provider — so swapping Whale Alert for
 * CoinGecko on-chain trades, or anything else, touches only index.ts.
 */
export interface WhaleEventSource {
  readonly name: string;
  /** Return the most recent qualifying events. The caller handles dedupe. */
  poll(): Promise<WhaleEvent[]>;
  /** Optional clean-up hook, called once on agent shutdown (e.g. close a socket). */
  close?(): Promise<void> | void;
}
