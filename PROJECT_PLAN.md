# Master Questions Plan

## Goal

Build a simple study tool for the 72 exam questions in this repo.

- The markdown notes in `vault/` are the only source of truth.
- The final app should help students learn the questions efficiently with spaced repetition.
- The system should stay simple, self-hosted where needed, and easy to maintain.

## Current Source Of Truth

- `vault/1.md` to `vault/72.md` are the canonical question notes.
- One note equals one study card.
- `qid` is the stable review key.
- Notes may belong to one or more courses/modules.
- Notes may reference one or more source files.

## Note Schema

Each note should follow this structure:

```md
---
qid: 24
courses:
  - DT
  - IMPD
sources:
  - file: VO_03_Design-Thinking-Recap.pdf
    pages: "8-9"
  - file: 241104_Design Thinking_Module1.pdf
    pages: "3, 26-28"
---

# Describe all steps of the Design Thinking Process. Discuss why the Process is to be conducted as a repeating cycle rather than a linear programme.

Answer text...

![Useful diagram](assets/24-diagram.png)
```

Rules:

- `qid` is required and unique.
- `courses` is always a YAML list.
- `sources` is always a YAML list.
- Each source has `file` and `pages`.
- `pages` refers to actual PDF page numbers.
- The first `#` heading is the question.
- Everything after the first H1 is the answer.
- Images are allowed only via standard Markdown image syntax.
- Obsidian-specific embeds like `![[image.png]]` are not part of the canonical format.

## Content And App Split

The app should not edit or own the question content.

- `vault/*.md` remains canonical.
- A build/export step converts the notes into static app data.
- The backend stores only user auth and review progress.

This keeps authoring and app state separate.

## Planned Export Format

The exporter should validate the vault and generate static JSON for the frontend.

Expected responsibilities:

- load all `vault/*.md` notes
- validate required metadata
- extract question text from the first H1
- extract the answer body as markdown
- preserve source metadata
- preserve image references
- emit app-ready JSON such as `questions.json`

High-level output shape:

```json
{
  "version": 1,
  "questions": [
    {
      "qid": 24,
      "courses": ["DT", "IMPD"],
      "question": "Describe all steps of the Design Thinking Process...",
      "answer_markdown": "Answer text...",
      "sources": [
        {
          "file": "VO_03_Design-Thinking-Recap.pdf",
          "pages_raw": "8-9"
        }
      ]
    }
  ]
}
```

## Backend Plan

Use PocketBase as the backend for auth and review progress.

Why PocketBase:

- simple self-hosted deployment
- traditional email/password auth
- built-in verification and password reset flows
- easier access control than the earlier CouchDB idea

PocketBase should store only:

- users
- per-user review progress

It should not become a second content source.

### Planned Collections

`users`

- PocketBase auth collection
- email/password signup
- verified email required
- password reset enabled
- signup restricted to `@ustp-students.at`

`review_progress`

- `user`
- `qid`
- `state`
- `ease`
- `interval_days`
- `repetitions`
- `lapses`
- `last_reviewed_at`
- `next_review_at`
- `suspended`

Constraints:

- unique on `user + qid`
- users can only read and write their own progress rows

## Frontend Plan

The frontend should be a static site or PWA.

- host on GitHub Pages
- load exported question data from static JSON
- allow public reading of question and answer content
- require login only for saving and syncing progress
- compute due cards client-side
- use a simple spaced-repetition flow

Suggested study flow:

1. show question
2. reveal answer
3. grade recall with buttons like `Again`, `Hard`, `Good`, `Easy`
4. update `review_progress`

## Authoring Workflow

Question development is intended to happen one note at a time.

Project-local OpenCode commands live in `.opencode/commands/`.

Planned workflow:

1. Run `/sources <qid>`
2. Run `/qreview <qid>`
3. Review and confirm the proposed source/page changes
4. Give feedback if the source/page selection is ambiguous
5. Run `/answer <qid>`
6. Draft or refine the answer body for that same question

This keeps source selection and answer writing separate, which reduces drift and makes it easier to work through the 72 notes systematically.

## Hosting Plan

- `study.qtq.at` -> GitHub Pages frontend
- `study-api.qtq.at` -> PocketBase on `satelite`
- Mailcow SMTP -> verification and password reset emails

Operational notes:

- restrict PocketBase CORS to the frontend origin
- back up PocketBase data regularly
- keep the vault in Git as the long-term source of truth

## Decisions Already Made

- the vault is canonical
- one note equals one review card
- `qid` is the review key
- `courses` is a list, not a slash-separated string
- `sources` is a list of objects
- `pages` uses actual PDF page numbers
- images use standard Markdown only
- PocketBase is preferred over CouchDB for the app backend
- signup should be limited to `@ustp-students.at`

## Current Status

Done:

- 72 question notes exist in `vault/`
- metadata structure is present in the notes
- `Exam_Study_Map_72_Questions.docx` is in the repo
- course archives are in `archive/`
- some answers are already being written
- helper scripts exist for metadata bootstrapping and source-page inference

Not done yet:

- all `sources[].pages` still need to be reviewed and filled
- no validator/exporter is implemented yet
- no frontend app exists yet
- no PocketBase setup exists yet
- no deployment config exists yet

## Recommended Next Steps

1. Finish the vault metadata, especially `sources[].pages`.
2. Continue filling question answers in the notes.
3. Build a validator/exporter from `vault/*.md` to static JSON.
4. Define PocketBase collections and auth restrictions.
5. Build the frontend study app against exported JSON and PocketBase.
6. Deploy GitHub Pages, PocketBase, and SMTP config.

## Non-Goals For V1

- no complicated knowledge graph between overlapping questions
- no second CMS or admin content editor
- no CouchDB/PouchDB sync layer
- no overengineered collaboration workflow beyond Git and the vault

The main idea is simple: keep the notes in markdown, export them for the app, and use PocketBase only for users and spaced-repetition progress.
