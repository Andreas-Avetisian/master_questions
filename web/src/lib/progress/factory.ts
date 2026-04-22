import { browser } from "$app/environment";
import { pb } from "../pb";
import type { ProgressStore } from "./types";
import { LocalStorageProgressStore } from "./local";
import { PocketBaseProgressStore } from "./pocketbase";
import { HybridProgressStore } from "./hybrid";

/**
 * Returns the right ProgressStore for the current auth state. Components
 * subscribe via `onStoreChange` so they can re-read when the user logs
 * in or out and the underlying store swaps.
 */

let local: LocalStorageProgressStore | null = null;
let hybrid: HybridProgressStore | null = null;
let lastUserId: string | null = null;
const storeListeners = new Set<() => void>();

function getLocal(): LocalStorageProgressStore {
  if (!local) local = new LocalStorageProgressStore();
  return local;
}

export function getProgressStore(): ProgressStore {
  if (!browser) return getLocal();
  const userId = pb().authStore.record?.id ?? null;

  if (userId) {
    if (userId !== lastUserId || !hybrid) {
      hybrid = new HybridProgressStore(
        getLocal(),
        new PocketBaseProgressStore(),
        (e) => console.warn("[sync]", e),
      );
      lastUserId = userId;
    }
    return hybrid;
  }

  if (lastUserId !== null) {
    // Logged out: drop hybrid ref. Local cache stays (user may grade offline;
    // next login will merge). We intentionally do NOT wipe local to give the
    // user a chance to log back in and sync — they can clear localStorage
    // manually if they want a fresh start.
    hybrid = null;
    lastUserId = null;
  }
  return getLocal();
}

export function onStoreChange(fn: () => void): () => void {
  storeListeners.add(fn);
  return () => storeListeners.delete(fn);
}

/** Called by the layout when the authStore fires onChange. */
export function notifyStoreSwap(): void {
  // Drop both references so the next getProgressStore() rebuilds.
  hybrid = null;
  lastUserId = pb().authStore.record?.id ?? null;
  for (const l of storeListeners) l();
}
