import { browser } from "$app/environment";
import type { CardProgress, ProgressStore } from "./types";
import type { LocalStorageProgressStore } from "./local";
import type { PocketBaseProgressStore } from "./pocketbase";
import { buildMergePlan } from "./merge";
import { syncTracker } from "../sync";

/**
 * Combines a local cache with a remote PocketBase store.
 *
 * Read path: local first (instant, no network).
 * Write path: local immediately, remote best-effort in the background.
 * Reconcile: on construction we run `mergeFromRemote()` once to pull
 *   everything from PocketBase, resolve per qid, and upsert winners on
 *   both sides. Subsequent grades write-through to both.
 *
 * A background failure does not break the UI — the next successful write
 * (or the next construction) retries. This keeps the app usable when the
 * PB server is briefly unreachable.
 */
export class HybridProgressStore implements ProgressStore {
  private merging: Promise<void>;
  private onlineHandler: (() => void) | null = null;

  constructor(
    private local: LocalStorageProgressStore,
    private remote: PocketBaseProgressStore,
    private onError: (e: unknown) => void = () => {},
  ) {
    this.merging = this.mergeFromRemote();
    if (browser) {
      this.onlineHandler = () => {
        // Best-effort: on reconnect, re-merge. Any writes that silently
        // failed while offline are still "local-newer" and will push.
        this.mergeFromRemote();
      };
      window.addEventListener("online", this.onlineHandler);
    }
  }

  /** Release the online listener. Called when the store is swapped out. */
  dispose(): void {
    if (this.onlineHandler && browser) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  /** Run once per session; awaitable so callers can surface "syncing…". */
  async waitForInitialMerge(): Promise<void> {
    return this.merging;
  }

  private async mergeFromRemote(): Promise<void> {
    syncTracker.mergeStart();
    let mergeErr: unknown = null;
    try {
      this.remote.invalidate();
      const [localAll, remoteAll] = await Promise.all([
        this.local.all(),
        this.remote.all(),
      ]);
      const plan = buildMergePlan(localAll, remoteAll);
      for (const p of plan.toPull) {
        await this.local.put(p);
      }
      for (const p of plan.toPush) {
        try {
          await this.remote.put(p);
        } catch (e) {
          mergeErr = e;
          this.onError(e);
        }
      }
    } catch (e) {
      mergeErr = e;
      this.onError(e);
    } finally {
      syncTracker.mergeEnd(mergeErr);
    }
  }

  async get(qid: number): Promise<CardProgress | null> {
    return this.local.get(qid);
  }

  async all(): Promise<Record<number, CardProgress>> {
    return this.local.all();
  }

  async put(p: CardProgress): Promise<void> {
    await this.local.put(p);
    syncTracker.putStart();
    this.remote.put(p).then(
      () => syncTracker.putEnd(null),
      (e) => {
        this.onError(e);
        syncTracker.putEnd(e);
      },
    );
  }

  subscribe(fn: () => void): () => void {
    return this.local.subscribe(fn);
  }
}
