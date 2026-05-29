import type { X402Client } from '../x402/client.js';
import type { X402Payment } from '../x402/types.js';
import { log } from '../util/log.js';

/** Result of a media generation stage — or, in dry-run, a marked stub. */
export interface MediaResult {
  /** The generated asset URL. null in dry-run, or if the task produced none. */
  url: string | null;
  stub: boolean;
  payment: X402Payment | null;
  taskId?: string;
}

export interface MediaTaskConfig {
  /** Short label for logs: 'image' or 'video'. */
  label: string;
  /** Endpoint that accepts the job (the x402-billed or credit-billed submit call). */
  submitUrl: string;
  /** Endpoint that reports task status. Optional — synchronous endpoints
   *  (OpenAI image, current Luma) return the asset URL on submit and never poll. */
  taskUrl?: string;
  requestBody: Record<string, unknown>;
  /** Extra request headers to merge with Content-Type (e.g. Authorization: Bearer). */
  headers?: Record<string, string>;
  pollIntervalMs: number;
  maxPolls: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Runs an Ace Data async media job: submit (paid via x402), then poll the task
 * endpoint until the asset URL appears.
 *
 * dry-run -> the submit call stops at the 402; a marked stub is returned.
 * live    -> the job is paid for, then polled to completion.
 *
 * NOTE: the exact JSON field names in Flux/Luma responses are not pinned in the
 * skill docs, so url/taskId/status are located defensively (see the finders
 * below). Confirm against a real response the first time this runs live.
 */
export async function runMediaTask(cfg: MediaTaskConfig, x402: X402Client): Promise<MediaResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cfg.headers ?? {}),
  };
  const submit = await x402.request(cfg.submitUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(cfg.requestBody),
  });

  if (x402.mode === 'dry-run') {
    if (submit.payment && !submit.payment.settled) {
      log.warn(
        `${cfg.label} dry-run: endpoint priced at ${submit.payment.amountAtomic} atomic USDC. Stub returned.`,
      );
    } else {
      log.warn(`${cfg.label} dry-run: endpoint returned status ${submit.status} (no 402). Stub returned.`);
    }
    return { url: null, stub: true, payment: submit.payment };
  }

  // live mode
  if (!submit.ok) {
    throw new Error(
      `${cfg.label} submit failed: status ${submit.status}. Body: ${JSON.stringify(submit.body).slice(0, 300)}`,
    );
  }

  // Most current Ace Data endpoints return the asset URL directly in the submit
  // response (OpenAI image generation always, Luma video on completion). Check
  // for an immediate URL first; only fall through to task polling if absent.
  const immediate = findMediaUrl(submit.body);
  if (immediate) return { url: immediate, stub: false, payment: submit.payment };

  const taskId = findTaskId(submit.body);
  if (!taskId) {
    throw new Error(
      `${cfg.label} submit returned neither a task id nor an asset URL. ` +
        `Body: ${JSON.stringify(submit.body).slice(0, 300)}`,
    );
  }
  if (!cfg.taskUrl) {
    throw new Error(
      `${cfg.label} submit returned task id ${taskId} but no taskUrl was configured for polling.`,
    );
  }

  for (let i = 0; i < cfg.maxPolls; i++) {
    await sleep(cfg.pollIntervalMs);
    const poll = await x402.request(cfg.taskUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'retrieve', id: taskId }),
    });
    if (!poll.ok) {
      log.warn(`${cfg.label} poll ${i + 1}: status ${poll.status}; retrying.`);
      continue;
    }
    const url = findMediaUrl(poll.body);
    if (url) return { url, stub: false, payment: submit.payment, taskId };

    const status = findStatus(poll.body);
    if (status === 'failed' || status === 'error') {
      throw new Error(`${cfg.label} task ${taskId} failed.`);
    }
    log.info(`${cfg.label} task ${taskId}: ${status ?? 'processing'} (poll ${i + 1}/${cfg.maxPolls})`);
  }
  throw new Error(`${cfg.label} task ${taskId} did not complete within ${cfg.maxPolls} polls.`);
}

/**
 * Deep-search a response object for the first asset URL. Robust to unknown
 * field nesting — prefers a URL with a media file extension. Exported for tests.
 */
export function findMediaUrl(body: unknown): string | null {
  const urls: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') {
      if (/^https?:\/\/\S+/i.test(v)) urls.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(visit);
    } else if (v && typeof v === 'object') {
      Object.values(v as Record<string, unknown>).forEach(visit);
    }
  };
  visit(body);
  const media = urls.find((u) => /\.(png|jpe?g|webp|gif|mp4|webm|mov)(\?|$)/i.test(u));
  return media ?? urls[0] ?? null;
}

function findTaskId(body: unknown): string | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const data = (b.data ?? {}) as Record<string, unknown>;
  const candidate = b.task_id ?? b.taskId ?? b.id ?? data.task_id ?? data.taskId ?? data.id;
  return typeof candidate === 'string' ? candidate : null;
}

function findStatus(body: unknown): string | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const data = (b.data ?? {}) as Record<string, unknown>;
  const s = b.status ?? b.state ?? data.status ?? data.state;
  return typeof s === 'string' ? s.toLowerCase() : null;
}
