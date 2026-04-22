import { browser } from "$app/environment";
import type { CardProgress, ProgressStore } from "./types";

const KEY = "mq:progress:v1";

type Stored = Record<number, CardProgress>;

function readAll(): Stored {
  if (!browser) return {};
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Stored;
    }
  } catch {
    // fall through to empty
  }
  return {};
}

export class LocalStorageProgressStore implements ProgressStore {
  private cache: Stored | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();

  private load(): Stored {
    if (this.cache == null) this.cache = readAll();
    return this.cache;
  }

  private scheduleWrite(): void {
    if (!browser) return;
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      localStorage.setItem(KEY, JSON.stringify(this.cache ?? {}));
      this.writeTimer = null;
    }, 100);
  }

  async get(qid: number): Promise<CardProgress | null> {
    return this.load()[qid] ?? null;
  }

  async put(p: CardProgress): Promise<void> {
    const store = this.load();
    store[p.qid] = p;
    this.scheduleWrite();
    for (const l of this.listeners) l();
  }

  async all(): Promise<Record<number, CardProgress>> {
    return { ...this.load() };
  }

  /** Subscribe to put() notifications. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

let singleton: LocalStorageProgressStore | null = null;

export function getProgressStore(): LocalStorageProgressStore {
  if (!singleton) singleton = new LocalStorageProgressStore();
  return singleton;
}
