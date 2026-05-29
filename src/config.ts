import 'dotenv/config';
import type { AgentMode } from './types.js';

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Env ${key} is not a valid number: "${raw}"`);
  }
  return n;
}

function str(key: string, fallback: string): string {
  const raw = process.env[key];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

const rawMode = str('AGENT_MODE', 'live');
if (rawMode !== 'live' && rawMode !== 'dry-run') {
  throw new Error(`AGENT_MODE must be 'live' or 'dry-run', got "${rawMode}"`);
}

export const config = {
  /** Minimum USD value for a whale event to qualify. Architecture locks $10M. */
  whaleThresholdUsd: num('WHALE_THRESHOLD_USD', 10_000_000),
  /** Hard cap on total completed cycles before the agent stops gracefully.
   *  0 = unlimited. Set to a small number (e.g. 1) to bound Ace Data credit
   *  spend on a demo run — each cycle costs analyze + image + video credits. */
  maxCycles: num('MAX_CYCLES', 0),
  /** Cap on cycles started per poll. 0 = unlimited. Set to 1 to spread spend
   *  across polls when a single busy window returns many whales at once. */
  maxEventsPerPoll: num('MAX_EVENTS_PER_POLL', 0),
  /** Poll interval. Architecture: every 10 minutes in production. */
  pollIntervalMs: num('POLL_INTERVAL_MS', 10 * 60 * 1000),
  /** Event source selector: 'auto' | 'mock' | 'whale-alert'. */
  whaleSource: str('WHALE_SOURCE', 'auto') as 'auto' | 'mock' | 'whale-alert' | 'whale-alert-rest' | 'eth-rpc',
  whaleAlertApiKey: str('WHALE_ALERT_API_KEY', ''),
  /** Public Ethereum JSON-RPC endpoint for the eth-rpc source (no key needed). */
  ethRpcUrl: str('ETH_RPC_URL', 'https://ethereum-rpc.publicnode.com'),
  /** Where the idempotency store persists. */
  idempotencyStorePath: str('IDEMPOTENCY_STORE_PATH', './data/idempotency.json'),
  /** Operating mode. 'live' settles real USDC; 'dry-run' settles nothing. */
  agentMode: rawMode as AgentMode,
  /** Solana RPC for broadcasting payments. Use the Synapse mainnet endpoint in production. */
  solanaRpcUrl: str('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
  /** Path to the agent's solana-keygen keypair JSON. Needed only in live mode. */
  agentKeypairPath: str('AGENT_KEYPAIR_PATH', './agent-keypair.json'),
  /** Ace Data Cloud API base URL. */
  aceDataBaseUrl: str('ACE_DATA_BASE_URL', 'https://api.acedata.cloud'),
  /** LLM model for the analysis stage. */
  aceLlmModel: str('ACE_LLM_MODEL', 'gpt-4o-mini'),
  /** Image generation model. Defaults to dall-e-3 via the OpenAI image endpoint,
   *  which has a channel in default group; switch to a flux-* model once the
   *  dev team provisions Flux for default group. */
  aceImageModel: str('ACE_IMAGE_MODEL', 'dall-e-3'),
  /** Ace Data account API token. Sent as `Authorization: Bearer` on x402 calls so
   *  the request is attributed to the account's group, not the unprovisioned "default". */
  aceApiToken: str('ACE_API_TOKEN', ''),
  /** Optional x402 endpoint to advertise on SAP registration (sell-side). Empty = none. */
  agentX402Endpoint: str('AGENT_X402_ENDPOINT', ''),
  /** Optional metadata URI to advertise on SAP registration. Empty = none. */
  agentMetadataUri: str('AGENT_METADATA_URI', ''),
} as const;

/**
 * Resolve the concrete source:
 *   - 'mock' / 'whale-alert' / 'whale-alert-rest' are returned as-is.
 *   - 'auto' picks WebSocket whale-alert iff a key is present, else mock.
 *
 * Free-tier users with a key should set WHALE_SOURCE=whale-alert-rest
 * explicitly, because 'auto' assumes the paid ALERTS WebSocket is available.
 */
export function resolveSourceName(): 'mock' | 'whale-alert' | 'whale-alert-rest' | 'eth-rpc' {
  if (config.whaleSource === 'mock') return 'mock';
  if (config.whaleSource === 'whale-alert') return 'whale-alert';
  if (config.whaleSource === 'whale-alert-rest') return 'whale-alert-rest';
  if (config.whaleSource === 'eth-rpc') return 'eth-rpc';
  return config.whaleAlertApiKey ? 'whale-alert' : 'mock';
}
