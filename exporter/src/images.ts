import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { ValidationIssue } from "./types.ts";

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export type ImageScan = {
  /** Filenames (basename only) the note references, in order of first appearance, de-duplicated. */
  images: string[];
  /** answer_markdown with image paths rewritten to `assets/<filename>`. */
  rewritten: string;
  issues: ValidationIssue[];
};

/**
 * Scan the answer body for markdown image references, verify each target
 * exists in `vaultDir`, and rewrite the path to `assets/<basename>`.
 *
 * External URLs (http/https/data:) are left untouched.
 */
export function scanAndRewriteImages(
  answerMarkdown: string,
  vaultDir: string,
  noteFile: string,
): ImageScan {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const images: string[] = [];

  const rewritten = answerMarkdown.replace(IMG_RE, (whole, alt, path) => {
    if (/^(https?:|data:)/i.test(path)) return whole;

    const filename = basename(path);
    const abs = join(vaultDir, path);
    if (!existsSync(abs)) {
      issues.push({
        level: "error",
        file: noteFile,
        message: `image not found in vault: ${path}`,
      });
      return whole;
    }
    if (!seen.has(filename)) {
      seen.add(filename);
      images.push(filename);
    }
    return `![${alt}](assets/${filename})`;
  });

  return { images, rewritten, issues };
}
