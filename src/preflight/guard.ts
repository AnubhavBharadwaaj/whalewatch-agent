import type { AgentMode } from '../types.js';

/** A resolved event-source name, as produced by config.resolveSourceName(). */
export type SourceName = 'mock' | 'whale-alert' | 'whale-alert-rest' | 'eth-rpc';

/** The outcome of a preflight check. */
export interface PreflightVerdict {
  ok: boolean;
  /** A human-readable, actionable explanation. Present when ok === false. */
  reason?: string;
}

/**
 * Preflight safety check, run once at startup before any paid work.
 *
 * The combination it refuses: live mode on the mock event source. The mock
 * source fabricates whale events; live mode settles real USDC for every event
 * the agent processes. Running them together means paying real money to
 * analyze movements that never happened — it drains the wallet and fills the
 * agent's x402 history with non-organic activity. So it is a hard stop.
 *
 * The function is pure: it returns a verdict rather than throwing or exiting,
 * which keeps it trivial to test. index.ts turns an `ok: false` verdict into a
 * clean refusal with a non-zero exit code.
 */
export function checkRunMode(mode: AgentMode, source: SourceName): PreflightVerdict {
  if (mode === 'live' && source === 'mock') {
    return {
      ok: false,
      reason:
        'Refusing to start: AGENT_MODE=live with the mock event source.\n' +
        'The mock source invents whale events, and live mode settles real USDC ' +
        'for every event processed — this would spend real money analyzing data ' +
        "that never happened, and fill the agent's payment history with fake activity.\n" +
        'Fix one of these in .env:\n' +
        '  - To test safely: set AGENT_MODE=dry-run (nothing is paid).\n' +
        '  - To run live on free-tier data: set WHALE_SOURCE=whale-alert-rest ' +
        'with a valid WHALE_ALERT_API_KEY.\n' +
        '  - To run live on paid-tier data: set WHALE_SOURCE=whale-alert with a ' +
        'valid WHALE_ALERT_API_KEY (requires the Whale Alert ALERTS plan).',
    };
  }
  return { ok: true };
}
