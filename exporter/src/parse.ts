import { readFileSync } from "node:fs";
import { basename } from "node:path";
import matter from "gray-matter";
import type { Question, Source, ValidationIssue } from "./types.ts";

export type ParsedNote = {
  question: Question;
  issues: ValidationIssue[];
};

const H1_RE = /^#\s+(.+?)\s*$/m;
const OBSIDIAN_EMBED_RE = /!\[\[[^\]]+\]\]/;

export function parseNote(filePath: string): ParsedNote | ValidationIssue[] {
  const raw = readFileSync(filePath, "utf8");
  const name = basename(filePath);
  const issues: ValidationIssue[] = [];
  const err = (message: string): ValidationIssue => ({
    level: "error",
    file: name,
    message,
  });
  const warn = (message: string): ValidationIssue => ({
    level: "warn",
    file: name,
    message,
  });

  if (!raw.startsWith("---")) {
    return [err("no YAML frontmatter at top of file")];
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e) {
    return [err(`YAML parse failed: ${(e as Error).message}`)];
  }

  const fm = parsed.data as Record<string, unknown>;
  const body = parsed.content;
  const errors: ValidationIssue[] = [];

  // qid
  const qid = fm.qid;
  if (typeof qid !== "number" || !Number.isInteger(qid)) {
    errors.push(err("`qid` missing or not an integer"));
  }

  // filename <-> qid consistency
  const stem = name.replace(/\.md$/, "");
  if (/^\d+$/.test(stem) && typeof qid === "number") {
    if (Number(stem) !== qid) {
      errors.push(
        err(`filename qid (${stem}) does not match frontmatter qid (${qid})`),
      );
    }
  } else if (!/^\d+$/.test(stem)) {
    issues.push(warn(`filename does not follow <qid>.md convention`));
  }

  // courses
  const courses = fm.courses;
  if (!Array.isArray(courses) || courses.length === 0) {
    errors.push(err("`courses` missing or not a non-empty list"));
  } else if (!courses.every((c) => typeof c === "string" && c.length > 0)) {
    errors.push(err("`courses` entries must be non-empty strings"));
  }

  // sources
  const sourcesRaw = fm.sources;
  const sources: Source[] = [];
  if (!Array.isArray(sourcesRaw) || sourcesRaw.length === 0) {
    errors.push(err("`sources` missing or not a non-empty list"));
  } else {
    for (let i = 0; i < sourcesRaw.length; i++) {
      const s = sourcesRaw[i] as Record<string, unknown>;
      if (!s || typeof s !== "object") {
        errors.push(err(`sources[${i}] is not an object`));
        continue;
      }
      const file = s.file;
      const pages = s.pages;
      // `file:` with no value parses as null — treat null and empty string as
      // an authoring placeholder (warn, continue) rather than fatal. Anything
      // non-string that isn't null is still a hard error.
      let fileStr: string;
      if (file === null || file === undefined) {
        fileStr = "";
        issues.push(warn(`sources[${i}].file is empty`));
      } else if (typeof file !== "string") {
        errors.push(err(`sources[${i}].file must be a string`));
        continue;
      } else {
        fileStr = file;
        if (fileStr.length === 0) {
          issues.push(warn(`sources[${i}].file is empty`));
        }
      }
      // Same treatment for pages: null/empty -> warn, wrong type -> fatal.
      let pagesStr: string;
      if (pages === null || pages === undefined) {
        pagesStr = "";
        issues.push(warn(`sources[${i}].pages is empty`));
      } else if (typeof pages === "number") {
        pagesStr = String(pages);
      } else if (typeof pages === "string") {
        pagesStr = pages;
        if (pagesStr.trim().length === 0) {
          issues.push(warn(`sources[${i}].pages is empty`));
        }
      } else {
        errors.push(err(`sources[${i}].pages must be a string or number`));
        continue;
      }
      sources.push({ file: fileStr, pages_raw: pagesStr });
    }
  }

  // H1 + body split
  const h1Match = body.match(H1_RE);
  if (!h1Match) {
    errors.push(err("no H1 heading (`# ...`) found in body"));
  }

  // Obsidian embeds are banned
  if (OBSIDIAN_EMBED_RE.test(body)) {
    errors.push(err("Obsidian-style `![[...]]` embed found; use `![alt](path)` instead"));
  }

  if (errors.length > 0) {
    return [...errors, ...issues];
  }

  // Safe to assert non-null after the error gate above.
  const question = h1Match![1];
  const h1Index = body.indexOf(h1Match![0]);
  const afterH1 = body.slice(h1Index + h1Match![0].length);
  const answer_markdown = afterH1.replace(/^\s*\n/, "").trimEnd();
  const answer_is_empty = answer_markdown.length === 0;
  if (answer_is_empty) {
    issues.push(warn("answer body is empty"));
  }

  const result: Question = {
    qid: qid as number,
    courses: courses as string[],
    question,
    answer_markdown,
    answer_is_empty,
    sources,
    images: [], // filled in by images.ts
  };

  return { question: result, issues };
}
