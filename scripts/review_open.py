#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
EXTRACTED = ROOT / "extracted"


def load_frontmatter(note: Path) -> dict:
    raw = note.read_text(encoding="utf-8")
    if not raw.startswith("---\n"):
        return {}
    _, rest = raw.split("---\n", 1)
    fm, _ = rest.split("\n---\n", 1)
    return yaml.safe_load(fm) or {}


def first_page(pages: str | None) -> int | None:
    if not pages:
        return None
    m = re.search(r"\d+", str(pages))
    return int(m.group(0)) if m else None


def find_pdf(filename: str) -> Path | None:
    hits = list(EXTRACTED.rglob(filename))
    return hits[0] if hits else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("qid")
    args = ap.parse_args()

    note = ROOT / "vault" / f"{args.qid}.md"
    if not note.exists():
        print(f"missing: {note}", file=sys.stderr)
        return 1

    fm = load_frontmatter(note)

    raw = note.read_text(encoding="utf-8")
    h1 = next(
        (line for line in raw.splitlines() if line.startswith("# ")),
        f"(no H1 found in vault/{args.qid}.md)",
    )
    print(f"Q{args.qid}: {h1.lstrip('# ').strip()}\n")

    sources = fm.get("sources") or []
    if not sources:
        print("no sources in frontmatter")
        return 0

    for src in sources:
        name = src.get("file")
        if not name:
            continue
        pdf = find_pdf(name)
        page = first_page(src.get("pages"))
        if not pdf:
            print(f"not found in extracted/: {name}")
            continue
        cmd = ["okular"]
        if page:
            cmd += ["-p", str(page)]
        cmd.append(str(pdf))
        print(f"opening: {name} at page {page or '?'}")
        subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

    review = ROOT / "reviews" / f"{args.qid}.md"
    print(f"\n--- reviews/{args.qid}.md ---")
    if review.exists():
        print(review.read_text(encoding="utf-8"))
    else:
        print("(no review file — /sources was not run for this question)")

    print(f"\n--- vault/{args.qid}.md ---")
    print(note.read_text(encoding="utf-8"))

    return 0


if __name__ == "__main__":
    sys.exit(main())
