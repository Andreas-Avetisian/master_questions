/// <reference path="../pb_data/types.d.ts" />

/**
 * PocketBase number fields with `required: true` reject the value 0 as
 * "blank" — a long-standing PB gotcha. Our SRS legitimately stores 0 for
 * lapses, repetitions, and interval_days (new/failed cards), so every
 * grade was being rejected with HTTP 400 and silently logged by the
 * Hybrid store's best-effort writer.
 *
 * Keep `required` on `qid` (qids start at 1, never 0) and drop it on the
 * numeric SRS fields. They stay typed and indexed; missing values default
 * to 0 server-side, which matches a fresh card.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId("review_progress");
    for (const name of ["ease", "interval_days", "repetitions", "lapses"]) {
      const f = col.fields.getByName(name);
      if (!f) throw new Error(`field ${name} not found on review_progress`);
      f.required = false;
    }
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("review_progress");
    for (const name of ["ease", "interval_days", "repetitions", "lapses"]) {
      const f = col.fields.getByName(name);
      if (!f) continue;
      f.required = true;
    }
    app.save(col);
  },
);
