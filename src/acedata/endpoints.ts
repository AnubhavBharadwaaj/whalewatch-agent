/** Ace Data Cloud endpoint paths. Joined onto config.aceDataBaseUrl. */
export const ACE_PATHS = {
  /** OpenAI-compatible chat completions — the LLM endpoint (gpt-4o-mini, etc). */
  llmChat: '/openai/chat/completions',
  /** OpenAI-compatible image generation (DALL-E etc) — the primary image path,
   *  since OpenAI is provisioned in default group whereas Flux is not.
   *  Returns the image URL synchronously in `data[0].url` — no task polling needed. */
  openaiImages: '/openai/images/generations',
  /** Flux image generation (legacy / fallback). Pending dev-team channel provisioning;
   *  retained so the agent can switch back once Flux is unblocked for default group. */
  fluxImages: '/flux/images',
  /** Flux task status — used only with fluxImages. */
  fluxTasks: '/flux/tasks',
  /** Luma video generation. Returns the video URL synchronously on completion. */
  lumaVideos: '/luma/videos',
  /** Luma task status — used only if a Luma submit returns a task id instead of a URL. */
  lumaTasks: '/luma/tasks',
} as const;

/** Join a base URL and a path, tolerating a trailing slash on the base. */
export function aceUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

/**
 * Build the standard headers for an Ace Data API call. When an API token is set,
 * the request is account-attributed (credit-billed); without one, requests fall
 * into the unprovisioned "default" group where most model channels are absent.
 */
export function aceHeaders(apiToken?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiToken) h.Authorization = `Bearer ${apiToken}`;
  return h;
}
