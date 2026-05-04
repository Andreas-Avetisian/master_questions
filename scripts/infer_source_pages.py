#!/usr/bin/env python3

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import tempfile
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


STOPWORDS = {
    "about", "above", "after", "again", "against", "algorithm", "also", "among", "an",
    "and", "another", "are", "around", "because", "been", "being", "between", "briefly",
    "can", "case", "cases", "common", "concrete", "context", "could", "course", "data",
    "describe", "different", "discuss", "each", "example", "examples", "explain", "field",
    "fields", "following", "for", "form", "from", "general", "given", "how", "important",
    "include", "including", "into", "its", "lecture", "main", "method", "methods", "more",
    "name", "not", "one", "other", "part", "parts", "please", "point", "points", "problem",
    "problems", "process", "provide", "question", "questions", "rather", "regarding", "role",
    "section", "should", "slides", "some", "source", "specific", "state", "than", "that",
    "the", "their", "them", "there", "these", "they", "this", "those", "three", "through",
    "together", "typical", "under", "using", "what", "when", "where", "which", "while", "with",
    "within", "without", "why", "would", "your",
}

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


@dataclass(frozen=True)
class SourceLocation:
    container: Path
    member: str | None


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return normalize_whitespace(text)


def tokenize(text: str) -> list[str]:
    return [
        token
        for token in normalize_text(text).split()
        if len(token) >= 4 and token not in STOPWORDS and not token.isdigit()
    ]


def keep_parenthetical(value: str) -> str:
    return f"({value})" if re.search(r"\.(?:pdf|pptx|docx)", value, re.I) else ""


def extract_source_files(source_text: str) -> list[str]:
    source_text = re.sub(r"\(([^)]*)\)", lambda m: keep_parenthetical(m.group(1)), source_text)
    files: list[str] = []
    seen: set[str] = set()
    for match in re.finditer(r"([A-Za-z0-9][A-Za-z0-9_ .()\-+]*?\.(?:pdf|pptx|docx))", source_text, re.I):
        file_name = normalize_whitespace(match.group(1))
        file_name = re.sub(r"^\(+", "", file_name)
        file_name = re.sub(r"\)+$", "", file_name)
        file_name = re.sub(r"^(?:and|or)\s+", "", file_name, flags=re.I)
        if file_name not in seen:
            seen.add(file_name)
            files.append(file_name)
    return files


def extract_docx_plain_text(docx_path: Path) -> str:
    result = subprocess.run(
        ["pandoc", "-t", "plain", str(docx_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.replace("\r\n", "\n").replace("\r", "\n")


def parse_docx_metadata(docx_path: Path) -> dict[int, dict]:
    text = extract_docx_plain_text(docx_path)
    metadata: dict[int, dict] = {}
    pattern = re.compile(r"Question\s+(\d+)\n\n(.*?)(?=\nQuestion\s+\d+\n\n|\nNotes on methodology:|\Z)", re.S)
    for match in pattern.finditer(text):
        qid = int(match.group(1))
        block = match.group(2)
        title_match = re.match(r"(.*?)\n\nCourse:", block, re.S)
        course_match = re.search(r"Course:\s*(.+?)\n\nSource file:", block, re.S)
        source_match = re.search(r"Source file:\s*(.+?)\n\nQuote / key content:", block, re.S)
        quote_match = re.search(r"Quote / key content:\s*(.+?)(?:\n\nNotes:|\Z)", block, re.S)
        if not (title_match and course_match and source_match and quote_match):
            continue
        metadata[qid] = {
            "title": normalize_whitespace(title_match.group(1)),
            "course": normalize_whitespace(course_match.group(1)),
            "source_files": extract_source_files(normalize_whitespace(source_match.group(1))),
            "quote": normalize_whitespace(quote_match.group(1)),
        }
    return metadata


def inventory_archive_sources(archive_dir: Path) -> dict[str, list[SourceLocation]]:
    inventory: dict[str, list[SourceLocation]] = defaultdict(list)
    for standalone in archive_dir.glob("*.pdf"):
        inventory[standalone.name].append(SourceLocation(container=standalone, member=None))
    for zip_path in archive_dir.glob("*.zip"):
        with zipfile.ZipFile(zip_path) as zf:
            for member in zf.namelist():
                if member.endswith("/"):
                    continue
                name = Path(member).name
                if re.search(r"\.(?:pdf|pptx|docx)$", name, re.I):
                    inventory[name].append(SourceLocation(container=zip_path, member=member))
    return inventory


def read_source_bytes(location: SourceLocation) -> bytes:
    if location.member is None:
        return location.container.read_bytes()
    with zipfile.ZipFile(location.container) as zf:
        return zf.read(location.member)


def pdf_pages(data: bytes) -> list[str]:
    with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
        tmp.write(data)
        tmp.flush()
        result = subprocess.run(
            ["pdftotext", "-layout", tmp.name, "-"],
            check=True,
            capture_output=True,
        )
    text = result.stdout.decode("utf-8", "ignore")
    pages = [normalize_whitespace(page) for page in text.split("\f")]
    return [page for page in pages if page]


def pptx_slides(data: bytes) -> list[str]:
    slides: list[tuple[int, str]] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for name in sorted(zf.namelist()):
            match = re.match(r"ppt/slides/slide(\d+)\.xml", name)
            if not match:
                continue
            root = ET.fromstring(zf.read(name))
            text = " ".join(t.text or "" for t in root.iterfind(f".//{A_NS}t"))
            slides.append((int(match.group(1)), normalize_whitespace(text)))
    slides.sort(key=lambda item: item[0])
    return [text for _, text in slides]


def docx_pages(data: bytes) -> list[str]:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
        paragraphs: list[str] = []
        for para in root.iterfind(f".//{W_NS}p"):
            text = " ".join(t.text or "" for t in para.iterfind(f".//{W_NS}t"))
            text = normalize_whitespace(text)
            if text:
                paragraphs.append(text)
    return [normalize_whitespace(" ".join(paragraphs))] if paragraphs else []


def source_units(location: SourceLocation) -> list[str]:
    suffix = (Path(location.member).suffix if location.member else location.container.suffix).lower()
    data = read_source_bytes(location)
    if suffix == ".pdf":
        return pdf_pages(data)
    if suffix == ".pptx":
        return pptx_slides(data)
    if suffix == ".docx":
        return docx_pages(data)
    return []


def score_unit(unit_text: str, quote: str, title: str) -> float:
    quote_tokens = set(tokenize(quote))
    title_tokens = set(tokenize(title))
    unit_tokens = set(tokenize(unit_text))
    if not unit_tokens:
        return 0.0

    quote_score = len(unit_tokens & quote_tokens) / max(len(quote_tokens), 1)
    title_score = len(unit_tokens & title_tokens) / max(len(title_tokens), 1)

    norm_quote = normalize_text(quote)
    norm_unit = normalize_text(unit_text)
    phrase_bonus = 0.0
    for n in (5, 4, 3):
        words = norm_quote.split()
        grams = [" ".join(words[i : i + n]) for i in range(0, max(len(words) - n + 1, 0))]
        if any(gram in norm_unit for gram in grams if len(gram) > 12):
            phrase_bonus = 0.2 if n >= 4 else 0.1
            break

    return quote_score * 0.75 + title_score * 0.25 + phrase_bonus


def infer_pages_for_source(location: SourceLocation, quote: str, title: str) -> dict:
    units = source_units(location)
    scored = []
    for idx, unit in enumerate(units, start=1):
        score = score_unit(unit, quote, title)
        if score > 0:
            scored.append({"index": idx, "score": score, "preview": unit[:180]})

    scored.sort(key=lambda item: item["score"], reverse=True)
    if not scored:
        return {"pages": "", "confidence": 0.0, "top": []}

    best = scored[0]["score"]
    cutoff = max(best * 0.72, 0.22)
    chosen = sorted(item["index"] for item in scored if item["score"] >= cutoff)

    # Collapse to a compact range string.
    ranges = []
    if chosen:
        start = end = chosen[0]
        for value in chosen[1:]:
            if value == end + 1:
                end = value
            else:
                ranges.append((start, end))
                start = end = value
        ranges.append((start, end))

    page_str = ", ".join(f"{a}-{b}" if a != b else str(a) for a, b in ranges)
    second = scored[1]["score"] if len(scored) > 1 else 0.0
    confidence = best - second + (0.15 if best >= 0.4 else 0.0)
    return {
        "pages": page_str,
        "confidence": confidence,
        "top": scored[:5],
    }


def read_note(note_path: Path) -> tuple[list[str], str]:
    raw = note_path.read_text(encoding="utf-8")
    if raw.startswith("---\n"):
        _, rest = raw.split("---\n", 1)
        frontmatter, body = rest.split("\n---\n", 1)
        return frontmatter.splitlines(), body.lstrip("\n")
    return [], raw


def update_note_pages(note_path: Path, inferred_pages: dict[str, str]) -> None:
    lines, body = read_note(note_path)
    output: list[str] = []
    current_file: str | None = None
    for line in lines:
        file_match = re.match(r"\s*- file: '(.+)'\s*$", line)
        if file_match:
            current_file = file_match.group(1)
            output.append(line)
            continue
        pages_match = re.match(r"(\s*pages:\s*)\".*\"\s*$", line)
        if pages_match and current_file in inferred_pages:
            output.append(f'{pages_match.group(1)}"{inferred_pages[current_file]}"')
        else:
            output.append(line)
    note_path.write_text("---\n" + "\n".join(output) + "\n---\n\n" + body, encoding="utf-8")


def iter_qids(selection: str | None, metadata: dict[int, dict]) -> Iterable[int]:
    if not selection:
        return sorted(metadata)
    qids: list[int] = []
    for part in selection.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            qids.extend(range(int(start), int(end) + 1))
        else:
            qids.append(int(part))
    return qids


def main() -> None:
    parser = argparse.ArgumentParser(description="Infer likely source pages/slides for question notes.")
    parser.add_argument("--repo", default=".", help="Repository root")
    parser.add_argument("--qids", help="Comma-separated qids or ranges, e.g. 1,5,10-12")
    parser.add_argument("--write", action="store_true", help="Write high-confidence pages back into note frontmatter")
    parser.add_argument("--min-confidence", type=float, default=0.18, help="Minimum confidence delta to write pages")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    docx_path = repo / "Exam_Study_Map_72_Questions.docx"
    archive_dir = repo / "archive"
    vault_dir = repo / "vault"

    metadata = parse_docx_metadata(docx_path)
    inventory = inventory_archive_sources(archive_dir)

    report: dict[int, dict] = {}
    for qid in iter_qids(args.qids, metadata):
        entry = metadata[qid]
        per_source = {}
        writable_pages: dict[str, str] = {}
        for source_name in entry["source_files"]:
            locations = inventory.get(source_name, [])
            if not locations:
                per_source[source_name] = {"error": "source file not found in archive"}
                continue
            result = infer_pages_for_source(locations[0], entry["quote"], entry["title"])
            per_source[source_name] = result
            if args.write and result["pages"] and result["confidence"] >= args.min_confidence:
                writable_pages[source_name] = result["pages"]

        report[qid] = {
            "title": entry["title"],
            "course": entry["course"],
            "sources": per_source,
        }

        if args.write and writable_pages:
            update_note_pages(vault_dir / f"{qid}.md", writable_pages)

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
