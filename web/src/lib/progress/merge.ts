import type { CardProgress } from "./types";

export type MergeAction =
  | { kind: "none" }
  | { kind: "push"; winner: CardProgress } // local is newer, send to remote
  | { kind: "pull"; winner: CardProgress }; // remote is newer, save locally

/**
 * Resolve one qid's local vs remote progress with last-write-wins on
 * `last_reviewed_at`. If timestamps are equal (including both null), the
 * local copy is preferred — no-op.
 */
export function resolveOne(
  local: CardProgress | null,
  remote: CardProgress | null,
): MergeAction {
  if (!local && !remote) return { kind: "none" };
  if (local && !remote) return { kind: "push", winner: local };
  if (!local && remote) return { kind: "pull", winner: remote };
  const lt = toTs(local!.last_reviewed_at);
  const rt = toTs(remote!.last_reviewed_at);
  if (lt === rt) return { kind: "none" };
  return lt > rt
    ? { kind: "push", winner: local! }
    : { kind: "pull", winner: remote! };
}

function toTs(s: string | null): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

export type MergePlan = {
  toPush: CardProgress[];
  toPull: CardProgress[];
};

/** Build a merge plan across every qid that exists on either side. */
export function buildMergePlan(
  local: Record<number, CardProgress>,
  remote: Record<number, CardProgress>,
): MergePlan {
  const qids = new Set<number>();
  for (const k of Object.keys(local)) qids.add(Number(k));
  for (const k of Object.keys(remote)) qids.add(Number(k));

  const toPush: CardProgress[] = [];
  const toPull: CardProgress[] = [];
  for (const qid of qids) {
    const action = resolveOne(local[qid] ?? null, remote[qid] ?? null);
    if (action.kind === "push") toPush.push(action.winner);
    else if (action.kind === "pull") toPull.push(action.winner);
  }
  return { toPush, toPull };
}
