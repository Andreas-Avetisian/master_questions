/**
 * User preferences for the SRS queue. Per-device (localStorage).
 *
 * - newPerDay: fresh-card inflow cap. Controls pipeline growth.
 * - reviewsPerDay: due-card outflow cap. Safety valve for backlog days.
 */

const KEY = "mq:settings";

export const DEFAULT_NEW_PER_DAY = 5;
export const DEFAULT_REVIEWS_PER_DAY = 15;
export const MIN_LIMIT = 0;
export const MAX_LIMIT = 500;

export type Settings = {
  newPerDay: number;
  reviewsPerDay: number;
};

function defaults(): Settings {
  return {
    newPerDay: DEFAULT_NEW_PER_DAY,
    reviewsPerDay: DEFAULT_REVIEWS_PER_DAY,
  };
}

function clamp(n: unknown, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.round(v)));
}

export function getSettings(): Settings {
  if (typeof localStorage === "undefined") return defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      newPerDay: clamp(parsed.newPerDay, DEFAULT_NEW_PER_DAY),
      reviewsPerDay: clamp(parsed.reviewsPerDay, DEFAULT_REVIEWS_PER_DAY),
    };
  } catch {
    return defaults();
  }
}

export function setSettings(s: Settings): void {
  if (typeof localStorage === "undefined") return;
  const next: Settings = {
    newPerDay: clamp(s.newPerDay, DEFAULT_NEW_PER_DAY),
    reviewsPerDay: clamp(s.reviewsPerDay, DEFAULT_REVIEWS_PER_DAY),
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  for (const fn of listeners) fn();
}

const listeners = new Set<() => void>();

export function onSettingsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
