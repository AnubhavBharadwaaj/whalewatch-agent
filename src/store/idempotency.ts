import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { IdempotencyRecord } from '../types.js';
import { log } from '../util/log.js';

/**
 * File-backed idempotency store keyed on the whale-event id (the source tx
 * hash). Architecture sec.2: "A retried poll must never re-pay." Every event
 * the agent touches is recorded here before any paid work begins.
 */
export class IdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();

  constructor(private readonly path: string) {}

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as IdempotencyRecord[];
      this.records = new Map(parsed.map((r) => [r.eventId, r]));
      log.info(`Idempotency store loaded: ${this.records.size} record(s).`);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('Idempotency store not found; starting fresh.');
        return;
      }
      // A corrupt store is worth surfacing loudly, not silently wiping.
      throw new Error(`Failed to load idempotency store at ${this.path}: ${String(err)}`);
    }
  }

  has(eventId: string): boolean {
    return this.records.has(eventId);
  }

  get(eventId: string): IdempotencyRecord | undefined {
    return this.records.get(eventId);
  }

  /** Record a brand-new event. Returns the existing record if already present. */
  async markSeen(eventId: string): Promise<IdempotencyRecord> {
    const existing = this.records.get(eventId);
    if (existing) return existing;
    const record: IdempotencyRecord = {
      eventId,
      firstSeen: new Date().toISOString(),
      status: 'pending',
      txSignatures: [],
    };
    this.records.set(eventId, record);
    await this.persist();
    return record;
  }

  async update(
    eventId: string,
    patch: Partial<Pick<IdempotencyRecord, 'status' | 'note'>> & { addTxSignature?: string },
  ): Promise<void> {
    const record = this.records.get(eventId);
    if (!record) throw new Error(`Cannot update unknown event ${eventId}`);
    if (patch.status) record.status = patch.status;
    if (patch.note !== undefined) record.note = patch.note;
    if (patch.addTxSignature) record.txSignatures.push(patch.addTxSignature);
    await this.persist();
  }

  size(): number {
    return this.records.size;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true });
    const payload = JSON.stringify([...this.records.values()], null, 2);
    // Write to a temp file then rename: a crash mid-write cannot corrupt the store.
    const tmp = `${this.path}.tmp`;
    await fs.writeFile(tmp, payload, 'utf8');
    await fs.rename(tmp, this.path);
  }
}
