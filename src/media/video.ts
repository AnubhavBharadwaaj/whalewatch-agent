import type { WhaleAnalysis, WhaleSignal } from '../types.js';
import type { X402Client } from '../x402/client.js';
import { ACE_PATHS, aceHeaders, aceUrl } from '../acedata/endpoints.js';
import { runMediaTask, type MediaResult } from './task.js';

export interface VideoOptions {
  baseUrl: string;
  /** Ace Data API token; sent as Authorization: Bearer for credit-billed routing. */
  apiToken?: string;
  pollIntervalMs?: number;
  maxPolls?: number;
}

const MOOD: Record<WhaleSignal, { mood: string; motion: string }> = {
  BULLISH: { mood: 'confident', motion: 'upward particle surge' },
  BEARISH: { mood: 'tense', motion: 'falling cascade' },
  NEUTRAL: { mood: 'calm', motion: 'sideways drift' },
};

/** Architecture §6 — the market-mood video prompt. Exported for tests. */
export function buildVideoPrompt(a: WhaleAnalysis): string {
  const m = MOOD[a.signal];
  return (
    `A short 6-second market-mood clip. Mood: ${m.mood}. Abstract motion of ${a.token} ` +
    `price energy: ${m.motion}. Dark, cinematic, no text, no logos, seamless loop.`
  );
}

/** Generate one market-mood video for a whale event, paying via x402. */
export async function generateVideo(
  analysis: WhaleAnalysis,
  x402: X402Client,
  opts: VideoOptions,
): Promise<MediaResult> {
  return runMediaTask(
    {
      label: 'video',
      submitUrl: aceUrl(opts.baseUrl, ACE_PATHS.lumaVideos),
      taskUrl: aceUrl(opts.baseUrl, ACE_PATHS.lumaTasks),
      requestBody: { action: 'generate', prompt: buildVideoPrompt(analysis), aspect_ratio: '16:9' },
      headers: aceHeaders(opts.apiToken),
      // Video generation is slow — poll longer than the image stage.
      pollIntervalMs: opts.pollIntervalMs ?? 6000,
      maxPolls: opts.maxPolls ?? 60,
    },
    x402,
  );
}
