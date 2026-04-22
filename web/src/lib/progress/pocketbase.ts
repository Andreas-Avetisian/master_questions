import type { ClientResponseError } from "pocketbase";
import { pb } from "../pb";
import type { CardProgress, ProgressStore } from "./types";

const COLLECTION = "review_progress";

type Row = CardProgress & {
  id: string;
  user: string;
  created?: string;
  updated?: string;
};

/**
 * PocketBase-backed progress store. Each row is owned by the logged-in user;
 * `user = @request.auth.id` rules enforce this server-side.
 *
 * The SDK throws `ClientResponseError` on 404; we treat those as "no record"
 * instead of propagating. Other errors bubble up so callers can log them.
 */
export class PocketBaseProgressStore implements ProgressStore {
  private rowIdByQid = new Map<number, string>();
  private cache: Record<number, CardProgress> | null = null;

  private get userId(): string {
    const id = pb().authStore.record?.id;
    if (!id) throw new Error("PocketBaseProgressStore used while logged out");
    return id;
  }

  async all(): Promise<Record<number, CardProgress>> {
    if (this.cache) return { ...this.cache };
    const rows = await pb()
      .collection(COLLECTION)
      .getFullList<Row>({ filter: `user = "${this.userId}"`, batch: 500 });
    const out: Record<number, CardProgress> = {};
    this.rowIdByQid.clear();
    for (const r of rows) {
      this.rowIdByQid.set(r.qid, r.id);
      out[r.qid] = stripMeta(r);
    }
    this.cache = out;
    return { ...out };
  }

  async get(qid: number): Promise<CardProgress | null> {
    if (this.cache) return this.cache[qid] ?? null;
    try {
      const row = await pb()
        .collection(COLLECTION)
        .getFirstListItem<Row>(`user = "${this.userId}" && qid = ${qid}`);
      this.rowIdByQid.set(row.qid, row.id);
      return stripMeta(row);
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async put(p: CardProgress): Promise<void> {
    const body = { ...p, user: this.userId };
    const existing = this.rowIdByQid.get(p.qid);
    if (existing) {
      await pb().collection(COLLECTION).update(existing, body);
    } else {
      // Try create; if we raced ourselves (unique (user,qid)) fall back to update.
      try {
        const row = await pb().collection(COLLECTION).create<Row>(body);
        this.rowIdByQid.set(p.qid, row.id);
      } catch (e) {
        if (isUniqueConflict(e)) {
          const row = await pb()
            .collection(COLLECTION)
            .getFirstListItem<Row>(`user = "${this.userId}" && qid = ${p.qid}`);
          this.rowIdByQid.set(row.qid, row.id);
          await pb().collection(COLLECTION).update(row.id, body);
        } else {
          throw e;
        }
      }
    }
    if (this.cache) this.cache[p.qid] = p;
  }

  /** Drop the in-memory cache so the next read hits the server. */
  invalidate(): void {
    this.cache = null;
    this.rowIdByQid.clear();
  }

  // Required by the ProgressStore interface. Remote-only events would need
  // realtime subscriptions; in practice this store is only used wrapped by
  // HybridProgressStore, which owns notification fan-out via the local cache.
  subscribe(_fn: () => void): () => void {
    return () => {};
  }
}

function stripMeta(row: Row): CardProgress {
  const {
    qid,
    ease,
    interval_days,
    repetitions,
    lapses,
    last_reviewed_at,
    next_review_at,
    suspended,
  } = row;
  return {
    qid,
    ease,
    interval_days,
    repetitions,
    lapses,
    last_reviewed_at: last_reviewed_at || null,
    next_review_at: next_review_at || null,
    suspended: Boolean(suspended),
  };
}

function isNotFound(e: unknown): boolean {
  return (e as ClientResponseError)?.status === 404;
}

function isUniqueConflict(e: unknown): boolean {
  // PocketBase returns 400 with a validation error on unique violations.
  const err = e as ClientResponseError;
  return err?.status === 400 && /unique|already exists/i.test(err?.message ?? "");
}
