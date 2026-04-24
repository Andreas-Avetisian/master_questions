/**
 * Per-day counters for the SRS queue budgets.
 *
 * Stored in localStorage so counts survive reloads but reset at local
 * midnight. Counters are per-device; syncing across devices would need a
 * server-side record.
 */

const KEY = "mq:daily-counters";

type Counters = { date: string; new: number; reviews: number };

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function empty(): Counters {
  return { date: todayKey(), new: 0, reviews: 0 };
}

function read(): Counters {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const c = JSON.parse(raw) as Counters;
    if (c.date !== todayKey()) return empty();
    return c;
  } catch {
    return empty();
  }
}

function write(c: Counters): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(c));
  notify();
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function onDailyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export type DailyCounts = {
  introducedToday: number;
  reviewedToday: number;
};

export function getDailyCounts(): DailyCounts {
  const c = read();
  return { introducedToday: c.new, reviewedToday: c.reviews };
}

export function bumpIntroduced(): void {
  const c = read();
  c.new += 1;
  write(c);
}

export function bumpReviewed(): void {
  const c = read();
  c.reviews += 1;
  write(c);
}
