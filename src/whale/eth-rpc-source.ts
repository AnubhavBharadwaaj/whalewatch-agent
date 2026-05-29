import type { WhaleEvent } from '../types.js';
import type { WhaleEventSource } from './source.js';
import { log } from '../util/log.js';

/**
 * Ethereum public-RPC whale source.
 *
 * Watches ERC-20 Transfer events for USDC and USDT and emits any transfer at
 * or above the configured USD threshold. Both tokens are 6-decimal dollar
 * stablecoins, so USD value == token amount and NO price feed is needed — this
 * is what keeps the source fully free and dependency-light.
 *
 * Transport is raw JSON-RPC over fetch against a public endpoint (no API key,
 * no SDK). Each poll:
 *   1. eth_blockNumber to find the chain head,
 *   2. eth_getLogs over the new block range for the two token contracts,
 *   3. decode + threshold-filter the Transfer logs into WhaleEvents.
 *
 * Robustness: the queried range is capped (MAX_BLOCK_RANGE) so we never ask a
 * public RPC for an oversized window; on any RPC error we log and skip the
 * poll without advancing, and the cap naturally slides us forward over time.
 */

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

interface TokenMeta {
  symbol: string;
  decimals: number;
}

/** Contract address (lowercase) -> token metadata. Stablecoins only. */
const TOKENS: Record<string, TokenMeta> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6 },
};

/**
 * Best-effort labels for well-known, long-stable exchange hot wallets (public
 * Etherscan labels). Used only to enrich from/to; anything not listed falls
 * back to a truncated address with type 'unknown'. Extend freely.
 */
const KNOWN_ADDRESSES: Record<string, { label: string; type: string }> = {
  '0x28c6c06298d514db089934071355e5743bf21d60': { label: 'Binance', type: 'exchange' },
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { label: 'Binance', type: 'exchange' },
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { label: 'Binance', type: 'exchange' },
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { label: 'Coinbase', type: 'exchange' },
  '0x503828976d22510aad0201ac7ec88293211d23da': { label: 'Coinbase', type: 'exchange' },
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': { label: 'Kraken', type: 'exchange' },
  '0x1151314c646ce4e0efd76d1af4760ae66a9fe30f': { label: 'Bitfinex', type: 'exchange' },
};

const INITIAL_LOOKBACK_BLOCKS = 10; // first poll: ~2 minutes of history
const MAX_BLOCK_RANGE = 120; // cap total blocks examined per poll (~24 min); slides forward
const CHUNK_BLOCKS = 20; // per eth_getLogs sub-call; keeps result count under public-RPC caps
const HEAD_LAG_BLOCKS = 3; // stay behind the tip: dodges load-balancer head races + shallow reorgs
const SEEN_IDS_MAX = 2000;

interface RpcLog {
  address?: string;
  topics?: string[];
  data?: string;
  transactionHash?: string;
  logIndex?: string;
  blockNumber?: string;
}

/** A 32-byte topic to a 20-byte 0x address (lowercased). */
export function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40).toLowerCase()}`;
}

/** 0x1234…abcd short form. */
export function shortAddress(addr: string): string {
  return addr.length >= 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function labelFor(addr: string): { label: string; type: string } {
  return KNOWN_ADDRESSES[addr] ?? { label: shortAddress(addr), type: 'unknown' };
}

/**
 * Decode a single Transfer log into a WhaleEvent (pre-threshold). Returns null
 * for logs that aren't a watched-token Transfer or are malformed. Exported for
 * offline testing. `nowIso` is the detection time used as the event timestamp
 * (logs carry no block timestamp; detection time is within a poll interval).
 */
export function decodeTransferLog(entry: RpcLog, nowIso: string): WhaleEvent | null {
  const contract = entry.address?.toLowerCase();
  if (!contract) return null;
  const token = TOKENS[contract];
  if (!token) return null;

  const topics = entry.topics;
  if (!Array.isArray(topics) || topics.length < 3) return null;
  if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return null;

  let value: bigint;
  try {
    value = BigInt(entry.data ?? '0x0');
  } catch {
    return null;
  }

  const divisor = 10n ** BigInt(token.decimals);
  const usd = Number(value / divisor); // integer USD; cents irrelevant at whale scale
  const amount = Number(value) / Number(divisor);

  const from = topicToAddress(topics[1]!);
  const to = topicToAddress(topics[2]!);
  const fromInfo = labelFor(from);
  const toInfo = labelFor(to);

  const hash = entry.transactionHash ?? '';
  const logIndex = entry.logIndex ?? '0x0';

  return {
    id: `${hash}-${logIndex}`, // unique per transfer (a tx may emit several)
    blockchain: 'ethereum',
    symbol: token.symbol,
    amount,
    amountUsd: usd,
    fromLabel: fromInfo.label,
    fromType: fromInfo.type,
    toLabel: toInfo.label,
    toType: toInfo.type,
    txType: 'transfer',
    timestamp: nowIso,
  };
}

export class EthRpcSource implements WhaleEventSource {
  readonly name = 'eth-rpc';
  private readonly thresholdUsd: number;
  private lastBlock: number | null = null;
  private readonly seenIds = new Set<string>();

  constructor(
    private readonly rpcUrl: string,
    thresholdUsd: number,
  ) {
    if (!rpcUrl || rpcUrl.trim().length === 0) {
      throw new Error('EthRpcSource requires a non-empty RPC URL.');
    }
    this.thresholdUsd = Math.max(0, Math.floor(thresholdUsd));
  }

  async poll(): Promise<WhaleEvent[]> {
    let head: number;
    try {
      head = hexToNumber(await this.rpc('eth_blockNumber', []));
    } catch (err) {
      log.warn(`ETH RPC: eth_blockNumber failed (${describe(err)}).`);
      return [];
    }
    // Stay a few blocks behind the tip so a load-balanced node that's briefly
    // behind the one that served eth_blockNumber still has every block we ask
    // for, and so we never read a block that later reorgs out.
    const safeHead = head - HEAD_LAG_BLOCKS;
    if (safeHead <= 0) return [];

    let fromBlock = this.lastBlock === null ? safeHead - INITIAL_LOOKBACK_BLOCKS : this.lastBlock + 1;
    if (safeHead - fromBlock + 1 > MAX_BLOCK_RANGE) {
      fromBlock = safeHead - MAX_BLOCK_RANGE + 1; // cap + slide forward
    }
    if (fromBlock > safeHead) {
      this.lastBlock = safeHead; // nothing new yet
      return [];
    }

    // Query in sub-chunks so a single eth_getLogs call never exceeds typical
    // public-RPC result caps (~10k logs). USDC+USDT run ~350 transfers/block,
    // so CHUNK_BLOCKS-sized windows stay comfortably under that.
    const allLogs: RpcLog[] = [];
    let cursor = fromBlock;
    let lastGood = fromBlock - 1;
    let chunks = 0;
    while (cursor <= safeHead) {
      const end = Math.min(cursor + CHUNK_BLOCKS - 1, safeHead);
      try {
        const logs = (await this.rpc('eth_getLogs', [
          {
            fromBlock: numberToHex(cursor),
            toBlock: numberToHex(end),
            address: Object.keys(TOKENS),
            topics: [TRANSFER_TOPIC],
          },
        ])) as RpcLog[];
        if (Array.isArray(logs)) allLogs.push(...logs);
        lastGood = end;
        cursor = end + 1;
        chunks++;
      } catch (err) {
        // Stop here and resume from the last good block next poll; seenIds
        // dedupes any overlap. If no chunk succeeded, lastBlock is untouched.
        log.warn(`ETH RPC: eth_getLogs failed for blocks ${cursor}-${end} (${describe(err)}).`);
        break;
      }
    }

    const nowIso = new Date().toISOString();
    let decoded = 0;
    const fresh: WhaleEvent[] = [];
    for (const entry of allLogs) {
      const event = decodeTransferLog(entry, nowIso);
      if (!event) continue;
      decoded++;
      if (event.amountUsd < this.thresholdUsd) continue;
      if (this.seenIds.has(event.id)) continue;
      this.seenIds.add(event.id);
      fresh.push(event);
    }
    this.trimSeenIds();
    if (lastGood >= fromBlock) this.lastBlock = lastGood;

    log.info(
      `ETH RPC: blocks ${fromBlock}-${lastGood >= fromBlock ? lastGood : safeHead} ` +
        `(${chunks} chunk${chunks === 1 ? '' : 's'}), ${decoded} stablecoin transfers, ` +
        `${fresh.length} ≥ $${this.thresholdUsd.toLocaleString('en-US')}.`,
    );
    return fresh;
  }

  private async rpc(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: { code?: number; message?: string } };
    if (json.error) throw new Error(`RPC ${json.error.code ?? ''}: ${json.error.message ?? 'error'}`);
    return json.result;
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

function hexToNumber(hex: unknown): number {
  if (typeof hex !== 'string') throw new Error('expected hex string');
  return parseInt(hex, 16);
}

function numberToHex(n: number): string {
  return `0x${n.toString(16)}`;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
