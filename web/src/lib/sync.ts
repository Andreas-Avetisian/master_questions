export type SyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "error"; message: string };

let merging = 0;
let pending = 0;
let lastError: string | null = null;

let state: SyncState = { kind: "idle" };
const listeners = new Set<(s: SyncState) => void>();

function derive(): SyncState {
  if (merging > 0 || pending > 0) return { kind: "syncing" };
  if (lastError) return { kind: "error", message: lastError };
  return { kind: "idle" };
}

function publish(): void {
  const next = derive();
  if (same(state, next)) return;
  state = next;
  for (const l of listeners) l(state);
}

function same(a: SyncState, b: SyncState): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "error" && b.kind === "error") return a.message === b.message;
  return true;
}

export function getSyncState(): SyncState {
  return state;
}

export function onSyncStateChange(fn: (s: SyncState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/** Hybrid reports into these — keep the surface small. */
export const syncTracker = {
  mergeStart(): void {
    merging++;
    publish();
  },
  mergeEnd(error: unknown | null): void {
    merging = Math.max(0, merging - 1);
    if (error) lastError = formatError(error);
    else lastError = null;
    publish();
  },
  putStart(): void {
    pending++;
    publish();
  },
  putEnd(error: unknown | null): void {
    pending = Math.max(0, pending - 1);
    if (error) lastError = formatError(error);
    else if (lastError && pending === 0) lastError = null;
    publish();
  },
  /** Called when the active store swaps (login/logout). Resets counters. */
  reset(): void {
    merging = 0;
    pending = 0;
    lastError = null;
    publish();
  },
};

function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
