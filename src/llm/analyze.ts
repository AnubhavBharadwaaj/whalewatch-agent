import type { WhaleEvent, WhaleAnalysis, WhaleSignal } from '../types.js';
import type { X402Client } from '../x402/client.js';
import type { X402Payment } from '../x402/types.js';
import { ACE_PATHS, aceHeaders, aceUrl } from '../acedata/endpoints.js';
import { log } from '../util/log.js';

/** Result of the LLM analysis stage, including payment metadata. */
export interface AnalysisResult {
  analysis: WhaleAnalysis;
  /** Payment info from the x402 call. null only if the endpoint never asked to be paid. */
  payment: X402Payment | null;
  /** True when the analysis is a dry-run stub, not a real LLM response. */
  stub: boolean;
}

export interface AnalyzeOptions {
  baseUrl: string;
  model: string;
  /** Ace Data API token; sent as Authorization: Bearer for credit-billed routing. */
  apiToken?: string;
}

// Architecture sec.4 — the analysis prompt.
const SYSTEM_PROMPT =
  'You are a crypto market analyst. Given one on-chain whale transaction, output STRICT JSON: ' +
  '{token, direction, usd_value, from_entity, to_entity, signal, one_line, analysis}. ' +
  '`signal` is one of BULLISH|BEARISH|NEUTRAL. `analysis` is <=80 words, plain, no hype, ' +
  'no financial advice. Output nothing outside the JSON object.';

function buildUserPrompt(e: WhaleEvent): string {
  return (
    `Whale event: ${e.amount} ${e.symbol} (~$${e.amountUsd}) moved from ${e.fromLabel} ` +
    `to ${e.toLabel}, type=${e.txType}, chain=${e.blockchain}, time=${e.timestamp}.`
  );
}

/**
 * Analyze one whale event with the Ace Data LLM, paying via x402.
 *
 * live mode    -> a real paid LLM call; the strict-JSON response is parsed.
 * dry-run mode -> the endpoint is probed for its 402 price, then a clearly
 *                 marked stub analysis is returned. No LLM call, no spend.
 */
export async function analyzeWhaleEvent(
  event: WhaleEvent,
  x402: X402Client,
  opts: AnalyzeOptions,
): Promise<AnalysisResult> {
  const url = aceUrl(opts.baseUrl, ACE_PATHS.llmChat);
  const body = JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(event) },
    ],
    max_tokens: 400,
    temperature: 0.3,
  });

  const result = await x402.request(url, {
    method: 'POST',
    headers: aceHeaders(opts.apiToken),
    body,
  });

  if (x402.mode === 'dry-run') {
    if (result.payment && !result.payment.settled) {
      log.warn(
        `LLM dry-run: endpoint priced at ${result.payment.amountAtomic} atomic USDC. Stub returned.`,
      );
    } else {
      log.warn(`LLM dry-run: endpoint returned status ${result.status} (no 402). Stub returned.`);
    }
    return { analysis: stubAnalysis(event), payment: result.payment, stub: true };
  }

  // live mode
  if (!result.ok) {
    throw new Error(
      `LLM call failed: status ${result.status}. Body: ${JSON.stringify(result.body).slice(0, 300)}`,
    );
  }
  const content = extractAssistantContent(result.body);
  const analysis = toWhaleAnalysis(extractJson(content), event);
  return { analysis, payment: result.payment, stub: false };
}

/** Pull the assistant message text from an OpenAI-compatible response body. */
function extractAssistantContent(body: unknown): string {
  const b = body as { choices?: { message?: { content?: string } }[] };
  const content = b.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error(`LLM response had no assistant content. Body: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return content;
}

/**
 * Extract a JSON object from LLM output. Tolerates code fences and surrounding
 * prose — models sometimes add them despite a strict-JSON instruction.
 * Exported for the smoke test.
 */
export function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`LLM output contained no JSON object. Got: ${text.slice(0, 200)}`);
  }
  return JSON.parse(t.slice(start, end + 1));
}

function coerceSignal(v: unknown): WhaleSignal {
  const s = String(v).toUpperCase();
  return s === 'BULLISH' || s === 'BEARISH' ? s : 'NEUTRAL';
}

/**
 * Map a parsed LLM object onto a validated WhaleAnalysis, falling back to the
 * event's own values for any missing field. Exported for the smoke test.
 */
export function toWhaleAnalysis(parsed: unknown, event: WhaleEvent): WhaleAnalysis {
  const p = (parsed ?? {}) as Record<string, unknown>;
  return {
    token: String(p.token ?? event.symbol),
    direction: String(p.direction ?? event.txType),
    usd_value: typeof p.usd_value === 'number' ? p.usd_value : event.amountUsd,
    from_entity: String(p.from_entity ?? event.fromLabel),
    to_entity: String(p.to_entity ?? event.toLabel),
    signal: coerceSignal(p.signal),
    one_line: String(p.one_line ?? ''),
    analysis: String(p.analysis ?? ''),
  };
}

/**
 * A clearly-marked dry-run stub. The signal is a transparent heuristic (a move
 * INTO an exchange often precedes selling) — never presented as a real call.
 */
function stubAnalysis(event: WhaleEvent): WhaleAnalysis {
  const signal: WhaleSignal =
    event.toType === 'exchange'
      ? 'BEARISH'
      : event.fromType === 'exchange'
        ? 'BULLISH'
        : 'NEUTRAL';
  return {
    token: event.symbol,
    direction: event.txType,
    usd_value: event.amountUsd,
    from_entity: event.fromLabel,
    to_entity: event.toLabel,
    signal,
    one_line: '[DRY-RUN STUB] no LLM call was made',
    analysis:
      '[DRY-RUN STUB] dry-run skipped the paid LLM call; this signal is a placeholder heuristic, ' +
      'not real analysis.',
  };
}
