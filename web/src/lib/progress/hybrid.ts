import type { CardProgress, ProgressStore } from "./types";
import type { LocalStorageProgressStore } from "./local";
import type { PocketBaseProgressStore } from "./pocketbase";
import { buildMergePlan } from "./merge";

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

  constructor(
    private local: LocalStorageProgressStore,
    private remote: PocketBaseProgressStore,
    private onError: (e: unknown) => void = () => {},
  ) {
    this.merging = this.mergeFromRemote();
  }

  /** Run once per session; awaitable so callers can surface "syncing…". */
  async waitForInitialMerge(): Promise<void> {
    return this.merging;
  }

  private async mergeFromRemote(): Promise<void> {
    try {
      const [localAll, remoteAll] = await Promise.all([
        this.local.all(),
        this.remote.all(),
      ]);
      const plan = buildMergePlan(localAll, remoteAll);
      // Pull remote winners into local first — cheap, no network.
      for (const p of plan.toPull) {
        await this.local.put(p);
      }
      // Push local winners to remote — may fail individually; log & continue.
      for (const p of plan.toPush) {
        try {
          await this.remote.put(p);
        } catch (e) {
          this.onError(e);
        }
      }
    } catch (e) {
      // Remote unreachable during initial sync is survivable; grade-through
      // writes will retry. Surface so the UI can show "offline" if it cares.
      this.onError(e);
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
    this.remote.put(p).catch(this.onError);
  }

  subscribe(fn: () => void): () => void {
    return this.local.subscribe(fn);
  }
}
