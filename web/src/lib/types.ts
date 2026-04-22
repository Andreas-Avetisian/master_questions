// Shape of data/questions.json. Kept in sync with exporter/src/types.ts.
// Imported via relative path would pull exporter into the Vite graph; since
// these are small value-types and the exporter owns the canonical schema,
// we re-declare them here and rely on `npm run export` running against the
// same TS types to catch drift.

export type Source = {
  file: string;
  pages_raw: string;
};

export type Question = {
  qid: number;
  courses: string[];
  question: string;
  answer_markdown: string;
  answer_is_empty: boolean;
  sources: Source[];
  images: string[];
};

export type ExportOutput = {
  version: 1;
  generatedAt: string;
  questions: Question[];
};
