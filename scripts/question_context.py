#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import textwrap
from pathlib import Path

import yaml

from infer_source_pages import infer_pages_for_source, inventory_archive_sources, parse_docx_metadata


def split_note(note_path: Path) -> tuple[dict, str]:
    raw = note_path.read_text(encoding="utf-8")
    if not raw.startswith("---\n"):
        return {}, raw

    _, rest = raw.split("---\n", 1)
    frontmatter, body = rest.split("\n---\n", 1)
    data = yaml.safe_load(frontmatter) or {}
    return data, body.lstrip("\n")


def format_yaml(value: object) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True).strip()


def format_archive_matches(source_name: str, inventory: dict[str, list]) -> str:
    locations = inventory.get(source_name, [])
    if not locations:
        return "not found in archive"
    lines = []
    for location in locations:
        if location.member is None:
            lines.append(f"- {location.container.relative_to(REPO_ROOT)}")
        else:
            lines.append(f"- {location.container.relative_to(REPO_ROOT)} :: {location.member}")
    return "\n".join(lines)


def format_inference(qid: int, source_name: str, metadata: dict, inventory: dict[str, list]) -> str:
    locations = inventory.get(source_name, [])
    if not locations:
        return "- source file not found in archive"

    result = infer_pages_for_source(locations[0], metadata["quote"], metadata["title"])
    lines = [f"- suggested pages: {result['pages'] or '(none)'}"]
    lines.append(f"- confidence delta: {result['confidence']:.3f}")
    if result["top"]:
        lines.append("- top matches:")
        for item in result["top"][:3]:
            preview = item["preview"].replace("\n", " ")
            preview = textwrap.shorten(preview, width=180, placeholder="...")
            lines.append(f"  - page {item['index']}: score {item['score']:.3f} :: {preview}")
    return "\n".join(lines)


def build_sources_context(qid: int) -> str:
    note_path = REPO_ROOT / "vault" / f"{qid}.md"
    frontmatter, body = split_note(note_path)
    docx = DOCX_METADATA[qid]

    sections = []
    sections.append(f"Question note: {note_path.relative_to(REPO_ROOT)}")
    sections.append("Current note frontmatter:\n" + format_yaml(frontmatter))
    sections.append("Current note body:\n" + body.strip())
    sections.append("Docx-derived mapping:\n" + format_yaml({
        "qid": qid,
        "title": docx["title"],
        "course": docx["course"],
        "source_files": docx["source_files"],
        "quote": docx["quote"],
    }))

    source_blocks = []
    current_sources = frontmatter.get("sources") or []
    if not current_sources:
        current_sources = [{"file": name, "pages": ""} for name in docx["source_files"]]

    for entry in current_sources:
        source_name = entry.get("file", "")
        if not source_name:
            continue
        block = [f"Source: {source_name}"]
        block.append("Archive matches:\n" + format_archive_matches(source_name, ARCHIVE_INVENTORY))
        block.append("Inference:\n" + format_inference(qid, source_name, docx, ARCHIVE_INVENTORY))
        source_blocks.append("\n".join(block))

    sections.append("Per-source evidence:\n\n" + "\n\n".join(source_blocks))
    return "\n\n".join(sections)


def build_answer_context(qid: int) -> str:
    note_path = REPO_ROOT / "vault" / f"{qid}.md"
    frontmatter, body = split_note(note_path)
    docx = DOCX_METADATA[qid]

    sections = []
    sections.append(f"Question note: {note_path.relative_to(REPO_ROOT)}")
    sections.append("Current note frontmatter:\n" + format_yaml(frontmatter))
    sections.append("Full note body:\n" + body.strip())
    sections.append("Docx quote / key content:\n" + docx["quote"])

    source_blocks = []
    for entry in frontmatter.get("sources") or []:
        source_name = entry.get("file", "")
        if not source_name:
            continue
        block = [f"Source: {source_name}"]
        block.append(f"Current pages in note: {json.dumps(entry.get('pages', ''))}")
        block.append("Archive matches:\n" + format_archive_matches(source_name, ARCHIVE_INVENTORY))
        block.append("Inference:\n" + format_inference(qid, source_name, docx, ARCHIVE_INVENTORY))
        source_blocks.append("\n".join(block))

    if source_blocks:
        sections.append("Current sources and evidence:\n\n" + "\n\n".join(source_blocks))
    return "\n\n".join(sections)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render question-specific context for OpenCode commands.")
    parser.add_argument("mode", choices=["sources", "answer"])
    parser.add_argument("qid", type=int)
    args = parser.parse_args()

    if args.qid not in DOCX_METADATA:
        raise SystemExit(f"Unknown qid {args.qid}")

    if args.mode == "sources":
        print(build_sources_context(args.qid))
        return

    print(build_answer_context(args.qid))


REPO_ROOT = Path(__file__).resolve().parent.parent
DOCX_METADATA = parse_docx_metadata(REPO_ROOT / "Exam_Study_Map_72_Questions.docx")
ARCHIVE_INVENTORY = inventory_archive_sources(REPO_ROOT / "archive")


if __name__ == "__main__":
    main()
