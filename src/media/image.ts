import type { WhaleAnalysis, WhaleSignal } from '../types.js';
import type { X402Client } from '../x402/client.js';
import { ACE_PATHS, aceHeaders, aceUrl } from '../acedata/endpoints.js';
import { runMediaTask, type MediaResult } from './task.js';

export interface ImageOptions {
  baseUrl: string;
  /** Image model. dall-e-3 (default) for the OpenAI image endpoint, or a
   *  flux-* model once Flux is provisioned for default group. */
  model: string;
  /** Ace Data API token; sent as Authorization: Bearer for credit-billed routing. */
  apiToken?: string;
  pollIntervalMs?: number;
  maxPolls?: number;
}

const ARROW: Record<WhaleSignal, string> = {
  BULLISH: 'upward green',
  BEARISH: 'downward red',
  NEUTRAL: 'flat grey',
};

/** Compact USD label, e.g. 148_000_000 -> "$148M". */
export function usdShort(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
  return `$${usd}`;
}

/** Architecture §5 — the infographic image prompt. Exported for tests. */
export function buildImagePrompt(a: WhaleAnalysis): string {
  return (
    `A clean financial infographic card, dark background, single headline ` +
    `"${a.token} ${a.direction} ${usdShort(a.usd_value)}", a stylized ${ARROW[a.signal]} arrow, ` +
    `${a.from_entity} to ${a.to_entity} flow line, minimalist, sharp, no text errors, no logos, 16:9.`
  );
}

/**
 * Generate one infographic image for a whale event.
 *
 * Uses the OpenAI-compatible image endpoint by default (dall-e-3), since that
 * channel is provisioned in the default Ace Data group. The Flux path is kept
 * in endpoints.ts so a config change is the only thing needed to switch once
 * the dev team unblocks Flux. The OpenAI endpoint returns the image URL
 * synchronously in `data[0].url`, so no task polling occurs.
 */
export async function generateImage(
  analysis: WhaleAnalysis,
  x402: X402Client,
  opts: ImageOptions,
): Promise<MediaResult> {
  const isFlux = opts.model.toLowerCase().startsWith('flux');
  const submitPath = isFlux ? ACE_PATHS.fluxImages : ACE_PATHS.openaiImages;
  // OpenAI body: { model, prompt, size, n }. Flux body: { action, model, prompt, size }.
  const requestBody: Record<string, unknown> = isFlux
    ? {
        action: 'generate',
        model: opts.model,
        prompt: buildImagePrompt(analysis),
        size: '1024x1024',
      }
    : {
        model: opts.model,
        prompt: buildImagePrompt(analysis),
        size: '1024x1024',
        n: 1,
      };

  return runMediaTask(
    {
      label: 'image',
      submitUrl: aceUrl(opts.baseUrl, submitPath),
      // taskUrl only used if a submit returns a task id instead of a URL.
      // OpenAI image gen is synchronous; Flux historically used /flux/tasks.
      taskUrl: isFlux ? aceUrl(opts.baseUrl, ACE_PATHS.fluxTasks) : undefined,
      requestBody,
      headers: aceHeaders(opts.apiToken),
      pollIntervalMs: opts.pollIntervalMs ?? 5000,
      maxPolls: opts.maxPolls ?? 36,
    },
    x402,
  );
}
