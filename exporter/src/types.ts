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

export type ValidationIssue = {
  level: "error" | "warn";
  file: string;
  message: string;
};
