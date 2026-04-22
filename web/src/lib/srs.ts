/**
 * SM-2 scheduler (Anki-style). Pure, deterministic, no I/O.
 *
 * Grade semantics (subset of the original 0..5 scale):
 *   0 — Again: recall failed
 *   3 — Hard : recall succeeded but with difficulty
 *   4 — Good : recall succeeded
 *   5 — Easy : recall effortless
 *
 * On failure we use a 10-minute relearning step before promoting back to days.
 */

export type Grade = 0 | 3 | 4 | 5;

export type CardProgress = {
  qid: number;
  ease: number; // default 2.5
  interval_days: number; // 0 for new / in-relearning
  repetitions: number;
  lapses: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  suspended: boolean;
};

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const RELEARN_MINUTES = 10;

export function newCard(qid: number): CardProgress {
  return {
    qid,
    ease: DEFAULT_EASE,
    interval_days: 0,
    repetitions: 0,
    lapses: 0,
    last_reviewed_at: null,
    next_review_at: null,
    suspended: false,
  };
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

function addMinutes(from: Date, mins: number): Date {
  return new Date(from.getTime() + mins * 60_000);
}

function adjustEase(ease: number, grade: Grade): number {
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  return Math.max(MIN_EASE, ease + delta);
}

export function schedule(
  prev: CardProgress | null,
  grade: Grade,
  now: Date,
  qid?: number,
): CardProgress {
  const base = prev ?? newCard(qid ?? 0);
  const ease = adjustEase(base.ease, grade);

  if (grade < 3) {
    return {
      ...base,
      ease,
      interval_days: 0,
      repetitions: 0,
      lapses: base.lapses + 1,
      last_reviewed_at: now.toISOString(),
      next_review_at: addMinutes(now, RELEARN_MINUTES).toISOString(),
    };
  }

  const reps = base.repetitions + 1;
  let interval: number;
  if (base.interval_days === 0 || reps === 1) interval = 1;
  else if (reps === 2) interval = 6;
  else interval = Math.max(1, Math.round(base.interval_days * ease));

  return {
    ...base,
    ease,
    interval_days: interval,
    repetitions: reps,
    lapses: base.lapses,
    last_reviewed_at: now.toISOString(),
    next_review_at: addDays(now, interval).toISOString(),
  };
}

export function isDue(p: CardProgress | null, now: Date): boolean {
  if (!p) return false; // new cards are handled separately by the queue builder
  if (p.suspended) return false;
  if (!p.next_review_at) return true;
  return new Date(p.next_review_at).getTime() <= now.getTime();
}
