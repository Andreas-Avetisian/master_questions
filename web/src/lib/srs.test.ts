import { describe, expect, it } from "vitest";
import {
  DEFAULT_EASE,
  MIN_EASE,
  RELEARN_MINUTES,
  newCard,
  schedule,
  isDue,
  type CardProgress,
} from "./srs";

const T0 = new Date("2026-01-01T10:00:00Z");

function dayOffset(iso: string | null, from: Date): number {
  if (!iso) return NaN;
  return (new Date(iso).getTime() - from.getTime()) / 86_400_000;
}

describe("schedule — fresh card", () => {
  it("Good grade: interval 1d, reps 1, ease unchanged", () => {
    const c = schedule(null, 4, T0, 1);
    expect(c.interval_days).toBe(1);
    expect(c.repetitions).toBe(1);
    expect(c.ease).toBeCloseTo(DEFAULT_EASE, 5);
    expect(dayOffset(c.next_review_at, T0)).toBeCloseTo(1, 5);
    expect(c.lapses).toBe(0);
  });

  it("Again grade: 10-minute relearning step, lapses incremented", () => {
    const c = schedule(null, 0, T0, 1);
    expect(c.interval_days).toBe(0);
    expect(c.repetitions).toBe(0);
    expect(c.lapses).toBe(1);
    const minsOffset =
      (new Date(c.next_review_at!).getTime() - T0.getTime()) / 60_000;
    expect(minsOffset).toBeCloseTo(RELEARN_MINUTES, 5);
  });
});

describe("schedule — progression", () => {
  it("Good → Good → Good: 1d, 6d, 15d (ease stays 2.5)", () => {
    const a = schedule(null, 4, T0, 1);
    const b = schedule(a, 4, T0);
    expect(b.interval_days).toBe(6);
    expect(b.repetitions).toBe(2);
    const c = schedule(b, 4, T0);
    expect(c.interval_days).toBe(Math.round(6 * DEFAULT_EASE)); // 15
    expect(c.repetitions).toBe(3);
  });

  it("Fail after streak resets interval and reps, keeps adjusted ease", () => {
    let c = schedule(null, 4, T0, 1);
    c = schedule(c, 4, T0);
    c = schedule(c, 4, T0);
    const easeBefore = c.ease;
    const failed = schedule(c, 0, T0);
    expect(failed.interval_days).toBe(0);
    expect(failed.repetitions).toBe(0);
    expect(failed.lapses).toBe(1);
    // ease still adjusted down by failing
    expect(failed.ease).toBeLessThan(easeBefore);
    expect(failed.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });
});

describe("schedule — ease adjustment", () => {
  it("Easy bumps ease up (+0.1)", () => {
    const c = schedule(null, 5, T0, 1);
    expect(c.ease).toBeCloseTo(DEFAULT_EASE + 0.1, 5);
  });

  it("Hard drops ease (-0.14)", () => {
    const c = schedule(null, 3, T0, 1);
    expect(c.ease).toBeCloseTo(DEFAULT_EASE + 0.1 - 2 * (0.08 + 0.04), 5);
  });

  it("Repeated Again clamps to MIN_EASE", () => {
    let c: CardProgress = newCard(1);
    for (let i = 0; i < 20; i++) c = schedule(c, 0, T0);
    expect(c.ease).toBe(MIN_EASE);
  });
});

describe("isDue", () => {
  it("null card: not due (handled as new by queue)", () => {
    expect(isDue(null, T0)).toBe(false);
  });

  it("future review: not due", () => {
    const c = schedule(null, 4, T0, 1);
    expect(isDue(c, T0)).toBe(false);
  });

  it("past review: due", () => {
    const c = schedule(null, 4, T0, 1);
    const later = new Date(T0.getTime() + 2 * 86_400_000);
    expect(isDue(c, later)).toBe(true);
  });

  it("suspended: never due", () => {
    const c = { ...schedule(null, 4, T0, 1), suspended: true };
    const later = new Date(T0.getTime() + 10 * 86_400_000);
    expect(isDue(c, later)).toBe(false);
  });
});
