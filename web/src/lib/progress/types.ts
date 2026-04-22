import type { CardProgress } from "../srs";
export type { CardProgress };

export interface ProgressStore {
  get(qid: number): Promise<CardProgress | null>;
  put(p: CardProgress): Promise<void>;
  all(): Promise<Record<number, CardProgress>>;
  /** Called after every successful put(). Returns an unsubscribe. */
  subscribe(fn: () => void): () => void;
}
