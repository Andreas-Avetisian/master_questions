import { describe, expect, it } from "vitest";
import { buildQueue } from "./queue";
import { schedule, type CardProgress } from "./srs";
import type { Question } from "./types";

const T0 = new Date("2026-01-01T10:00:00Z");

function q(qid: number, empty = false, courses = ["X"]): Question {
  return {
    qid,
    courses,
    question: `Q${qid}`,
    answer_markdown: empty ? "" : "answer",
    answer_is_empty: empty,
    sources: [{ file: "f.pdf", pages_raw: "1" }],
    images: [],
  };
}

const baseOpts = {
  now: T0,
  newPerDay: 10,
  reviewsPerDay: 100,
  introducedToday: 0,
  reviewedToday: 0,
};

describe("buildQueue", () => {
  it("treats never-reviewed cards as new, capped at newPerDay", () => {
    const deck = [q(1), q(2), q(3), q(4), q(5)];
    const res = buildQueue(deck, {}, { ...baseOpts, newPerDay: 2 });
    expect(res.due.length).toBe(0);
    expect(res.newCards.map((x) => x.qid)).toEqual([1, 2]);
    expect(res.total).toBe(2);
  });

  it("skips answer_is_empty cards entirely", () => {
    const deck = [q(1, true), q(2), q(3, true)];
    const res = buildQueue(deck, {}, { ...baseOpts, newPerDay: 99 });
    expect(res.newCards.map((x) => x.qid)).toEqual([2]);
  });

  it("puts due cards before new cards, sorted by next_review_at", () => {
    const deck = [q(1), q(2), q(3)];
    const progress: Record<number, CardProgress> = {};
    const p1 = schedule(null, 4, new Date("2025-12-30T10:00:00Z"), 1);
    const p2 = schedule(null, 4, new Date("2025-12-29T10:00:00Z"), 2);
    progress[1] = p1; // next_review ~2025-12-31
    progress[2] = p2; // next_review ~2025-12-30
    // q3 still never-reviewed
    const res = buildQueue(deck, progress, baseOpts);
    expect(res.due.map((x) => x.qid)).toEqual([2, 1]); // earliest next_review first
    expect(res.newCards.map((x) => x.qid)).toEqual([3]);
  });

  it("subtracts introducedToday from the new budget", () => {
    const deck = [q(1), q(2), q(3), q(4), q(5)];
    const res = buildQueue(deck, {}, {
      ...baseOpts,
      newPerDay: 3,
      introducedToday: 2,
    });
    expect(res.newCards.map((x) => x.qid)).toEqual([1]); // 3 - 2 = 1 slot left
  });

  it("returns zero new cards once the budget is spent", () => {
    const deck = [q(1), q(2), q(3)];
    const res = buildQueue(deck, {}, {
      ...baseOpts,
      newPerDay: 5,
      introducedToday: 5,
    });
    expect(res.newCards.length).toBe(0);
  });

  it("caps due cards at reviewsPerDay minus reviewedToday", () => {
    const deck = [q(1), q(2), q(3), q(4)];
    const progress: Record<number, CardProgress> = {};
    for (let i = 1; i <= 4; i++) {
      progress[i] = schedule(null, 4, new Date("2025-12-20T10:00:00Z"), i);
    }
    const res = buildQueue(deck, progress, {
      ...baseOpts,
      reviewsPerDay: 3,
      reviewedToday: 1,
    });
    expect(res.due.length).toBe(2); // 3 - 1 = 2 review slots left
  });

  it("floors remaining budgets at zero, never negative", () => {
    const deck = [q(1), q(2)];
    const res = buildQueue(deck, {}, {
      ...baseOpts,
      newPerDay: 1,
      introducedToday: 99,
    });
    expect(res.newCards.length).toBe(0);
  });
});
