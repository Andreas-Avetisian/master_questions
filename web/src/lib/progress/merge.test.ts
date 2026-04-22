import { describe, expect, it } from "vitest";
import { buildMergePlan, resolveOne } from "./merge";
import type { CardProgress } from "./types";

function card(qid: number, ts: string | null): CardProgress {
  return {
    qid,
    ease: 2.5,
    interval_days: 1,
    repetitions: 1,
    lapses: 0,
    last_reviewed_at: ts,
    next_review_at: ts,
    suspended: false,
  };
}

describe("resolveOne", () => {
  it("both null: no-op", () => {
    expect(resolveOne(null, null)).toEqual({ kind: "none" });
  });
  it("only local: push", () => {
    const l = card(1, "2026-01-02");
    expect(resolveOne(l, null)).toEqual({ kind: "push", winner: l });
  });
  it("only remote: pull", () => {
    const r = card(1, "2026-01-02");
    expect(resolveOne(null, r)).toEqual({ kind: "pull", winner: r });
  });
  it("newer local wins (push)", () => {
    const l = card(1, "2026-02-02T10:00:00Z");
    const r = card(1, "2026-01-02T10:00:00Z");
    expect(resolveOne(l, r)).toEqual({ kind: "push", winner: l });
  });
  it("newer remote wins (pull)", () => {
    const l = card(1, "2026-01-02T10:00:00Z");
    const r = card(1, "2026-02-02T10:00:00Z");
    expect(resolveOne(l, r)).toEqual({ kind: "pull", winner: r });
  });
  it("equal timestamps: no-op (prefer local, avoid round-trip)", () => {
    const l = card(1, "2026-02-02T10:00:00Z");
    const r = card(1, "2026-02-02T10:00:00Z");
    expect(resolveOne(l, r)).toEqual({ kind: "none" });
  });
  it("null local ts < any remote ts", () => {
    const l = card(1, null);
    const r = card(1, "2026-01-01T00:00:00Z");
    expect(resolveOne(l, r)).toEqual({ kind: "pull", winner: r });
  });
});

describe("buildMergePlan", () => {
  it("disjoint keys: each side contributes", () => {
    const local = { 1: card(1, "2026-01-01T00:00:00Z") };
    const remote = { 2: card(2, "2026-01-02T00:00:00Z") };
    const plan = buildMergePlan(local, remote);
    expect(plan.toPush.map((c) => c.qid)).toEqual([1]);
    expect(plan.toPull.map((c) => c.qid)).toEqual([2]);
  });

  it("overlapping keys: resolved per qid", () => {
    const local = {
      1: card(1, "2026-01-05T00:00:00Z"), // newer → push
      2: card(2, "2026-01-01T00:00:00Z"), // older → pulled
    };
    const remote = {
      1: card(1, "2026-01-02T00:00:00Z"),
      2: card(2, "2026-01-05T00:00:00Z"),
    };
    const plan = buildMergePlan(local, remote);
    expect(plan.toPush.map((c) => c.qid).sort()).toEqual([1]);
    expect(plan.toPull.map((c) => c.qid).sort()).toEqual([2]);
  });

  it("equal timestamps produce no ops", () => {
    const local = { 1: card(1, "2026-01-05T00:00:00Z") };
    const remote = { 1: card(1, "2026-01-05T00:00:00Z") };
    expect(buildMergePlan(local, remote)).toEqual({ toPush: [], toPull: [] });
  });
});
