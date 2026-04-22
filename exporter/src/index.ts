#!/usr/bin/env node
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseNote } from "./parse.ts";
import { scanAndRewriteImages } from "./images.ts";
import { validateExport } from "./schema.ts";
import type { ExportOutput, Question, ValidationIssue } from "./types.ts";

type Args = {
  vault: string;
  out: string;
  strict: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { vault: "vault", out: "data/questions.json", strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vault") args.vault = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--strict") args.strict = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: export-vault [--vault <dir>] [--out <path>] [--strict]",
      );
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function printIssues(issues: ValidationIssue[]): void {
  for (const i of issues) {
    const tag = i.level === "error" ? "ERROR" : "warn ";
    const stream = i.level === "error" ? process.stderr : process.stderr;
    stream.write(`  ${tag} ${i.file}: ${i.message}\n`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const vaultDir = resolve(args.vault);
  const outPath = resolve(args.out);
  const assetsDir = join(dirname(outPath), "assets");

  const files = readdirSync(vaultDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const questions: Question[] = [];
  const allIssues: ValidationIssue[] = [];
  const seenQids = new Map<number, string>();
  const imageSources = new Map<string, string>(); // basename -> absolute source path

  for (const f of files) {
    const full = join(vaultDir, f);
    const result = parseNote(full);
    if (Array.isArray(result)) {
      allIssues.push(...result);
      continue;
    }
    const { question, issues } = result;

    const prev = seenQids.get(question.qid);
    if (prev !== undefined) {
      allIssues.push({
        level: "error",
        file: f,
        message: `duplicate qid ${question.qid} (also in ${prev})`,
      });
    } else {
      seenQids.set(question.qid, f);
    }

    const imgScan = scanAndRewriteImages(question.answer_markdown, vaultDir, f);
    question.answer_markdown = imgScan.rewritten;
    question.images = imgScan.images;

    for (const img of imgScan.images) {
      imageSources.set(img, join(vaultDir, img));
    }

    allIssues.push(...issues, ...imgScan.issues);
    questions.push(question);
  }

  const errors = allIssues.filter((i) => i.level === "error");
  const warns = allIssues.filter((i) => i.level === "warn");

  if (warns.length > 0) {
    process.stderr.write(`Warnings (${warns.length}):\n`);
    printIssues(warns);
  }
  if (errors.length > 0) {
    process.stderr.write(`\nErrors (${errors.length}):\n`);
    printIssues(errors);
    process.stderr.write("\nexport aborted\n");
    process.exit(1);
  }
  if (args.strict && warns.length > 0) {
    process.stderr.write("\n--strict: warnings treated as errors, aborting\n");
    process.exit(1);
  }

  questions.sort((a, b) => a.qid - b.qid);

  const output: ExportOutput = {
    version: 1,
    generatedAt: new Date().toISOString(),
    questions,
  };

  if (!validateExport(output)) {
    process.stderr.write("Internal schema check failed:\n");
    process.stderr.write(JSON.stringify(validateExport.errors, null, 2) + "\n");
    process.exit(1);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");

  if (imageSources.size > 0) {
    mkdirSync(assetsDir, { recursive: true });
    for (const [name, src] of imageSources) {
      copyFileSync(src, join(assetsDir, name));
    }
  }

  const answered = questions.filter((q) => !q.answer_is_empty).length;
  process.stderr.write(
    `\nExported ${questions.length} questions ` +
      `(${answered} answered, ${questions.length - answered} empty), ` +
      `${imageSources.size} images → ${outPath}\n`,
  );
}

main();
