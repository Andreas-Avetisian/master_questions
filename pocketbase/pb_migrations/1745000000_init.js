/// <reference path="../pb_data/types.d.ts" />

/**
 * Initial schema for the Master Questions study app.
 *
 * - Configures the built-in `users` auth collection to restrict signup
 *   to the @ustp-students.at domain.
 * - Creates the `review_progress` base collection for spaced-repetition
 *   state, with row-level access rules that scope every operation to the
 *   authenticated user.
 *
 * Tested against PocketBase 0.23.x. If the field/config API shape changes
 * in a future release, verify against the running admin UI and adjust.
 */
migrate(
  (app) => {
    // ---- users (built-in auth collection) ----
    const users = app.findCollectionByNameOrId("users");

    // Restrict signup to the school domain. Verification + password reset
    // flows are enabled by default; leave templates at PocketBase defaults
    // for now — the app URL is set via the admin-UI Meta settings at deploy.
    users.passwordAuth.enabled = true;
    users.passwordAuth.identityFields = ["email"];
    users.passwordAuth.onlyDomains = ["ustp-students.at"];

    app.save(users);

    // ---- review_progress ----
    const col = new Collection({
      name: "review_progress",
      type: "base",
      fields: [
        {
          name: "user",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: "qid", type: "number", required: true, min: 1, onlyInt: true },
        { name: "ease", type: "number", required: true },
        { name: "interval_days", type: "number", required: true, min: 0 },
        { name: "repetitions", type: "number", required: true, min: 0, onlyInt: true },
        { name: "lapses", type: "number", required: true, min: 0, onlyInt: true },
        { name: "last_reviewed_at", type: "date" },
        { name: "next_review_at", type: "date" },
        { name: "suspended", type: "bool" },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_review_progress_user_qid ON review_progress (user, qid)",
      ],
      // Row-level access: users can only read/write their own rows.
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule: "user = @request.auth.id",
      updateRule: "user = @request.auth.id",
      deleteRule: "user = @request.auth.id",
    });

    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("review_progress");
    app.delete(col);
    // Note: we intentionally do not revert the users.onlyDomains change on
    // down-migration — reopening signup to all domains on a rollback would
    // be a security regression. Revert manually if truly desired.
  },
);
