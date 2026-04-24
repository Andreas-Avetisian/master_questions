import type { CardProgress } from "./srs";
import type { Question } from "./types";
import { isDue } from "./srs";

export type QueueOptions = {
  now: Date;
  /** Daily budget for first-time introductions (inflow). */
  newPerDay: number;
  /** Daily budget for due-card reviews (outflow). */
  reviewsPerDay: number;
  /** How many fresh cards have already been introduced today. */
  introducedToday: number;
  /** How many due cards have already been reviewed today. */
  reviewedToday: number;
};

export type QueueBuckets = {
  due: Question[]; // reviewed previously, next_review_at <= now
  newCards: Question[]; // never reviewed, up to remaining new budget
  total: number;
};

/**
 * Build the review queue for a given deck + progress snapshot.
 *
 * - Skips questions with `answer_is_empty: true` (nothing to recall).
 * - Dues come first, sorted ascending by next_review_at (or qid for stability).
 * - Then up to `newPerDay - introducedToday` never-reviewed cards by qid.
 * - Dues are capped at `reviewsPerDay - reviewedToday` so a backlog doesn't
 *   drown the user on any single day.
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

  const remainingNew = Math.max(0, opts.newPerDay - opts.introducedToday);
  const remainingReviews = Math.max(0, opts.reviewsPerDay - opts.reviewedToday);
  const cappedDue = due.slice(0, remainingReviews);
  const cappedNew = newCards.slice(0, remainingNew);

  return {
    due: cappedDue,
    newCards: cappedNew,
    total: cappedDue.length + cappedNew.length,
  };
}
