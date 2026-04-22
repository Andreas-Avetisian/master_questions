import { browser } from "$app/environment";
import { base } from "$app/paths";
import type { ExportOutput, Question } from "./types";

let cache: Promise<ExportOutput> | null = null;

export function loadQuestions(): Promise<ExportOutput> {
  if (!browser) {
    // During SSR/prerender we don't have fetch timing; return an empty shell.
    // The static adapter emits an SPA shell anyway; real data loads client-side.
    return Promise.resolve({ version: 1, generatedAt: "", questions: [] });
  }
  if (!cache) {
    cache = fetch(`${base}/questions.json`).then(async (r) => {
      if (!r.ok) throw new Error(`questions.json: ${r.status}`);
      return (await r.json()) as ExportOutput;
    });
  }
  return cache;
}

export function byQid(questions: Question[]): Map<number, Question> {
  const m = new Map<number, Question>();
  for (const q of questions) m.set(q.qid, q);
  return m;
}

export function courses(questions: Question[]): string[] {
  const s = new Set<string>();
  for (const q of questions) for (const c of q.courses) s.add(c);
  return [...s].sort();
}
