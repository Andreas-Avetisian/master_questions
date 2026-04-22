import type { CardProgress } from "./srs";
import type { Question } from "./types";
import { isDue } from "./srs";

export type QueueOptions = {
  now: Date;
  newPerDay: number;
};

export type QueueBuckets = {
  due: Question[]; // reviewed previously, next_review_at <= now
  newCards: Question[]; // never reviewed, up to newPerDay
  total: number;
};

/**
 * Build the review queue for a given deck + progress snapshot.
 *
 * - Skips questions with `answer_is_empty: true` (nothing to recall).
 * - Dues come first, sorted ascending by next_review_at (or qid for stability).
 * - Then up to `newPerDay` never-reviewed cards by ascending qid.
 */
export function buildQueue(
  questions: Question[],
  progress: Record<number, CardProgress>,
  opts: QueueOptions,
): QueueBuckets {
  const due: Question[] = [];
  const newCards: Question[] = [];

  for (const q of questions) {
    if (q.answer_is_empty) continue;
    const p = progress[q.qid];
    if (!p) {
      newCards.push(q);
    } else if (isDue(p, opts.now)) {
      due.push(q);
    }
  }

  due.sort((a, b) => {
    const pa = progress[a.qid]?.next_review_at ?? "";
    const pb = progress[b.qid]?.next_review_at ?? "";
    if (pa === pb) return a.qid - b.qid;
    return pa < pb ? -1 : 1;
  });
  newCards.sort((a, b) => a.qid - b.qid);

  const cappedNew = newCards.slice(0, Math.max(0, opts.newPerDay));

  return {
    due,
    newCards: cappedNew,
    total: due.length + cappedNew.length,
  };
}
