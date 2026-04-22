import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { resolve } from "node:path";

const here = import.meta.dirname;

export default defineConfig({
  plugins: [sveltekit()],
  // The `web/static` directory is a symlink to repo-root `data/`, so
  // questions.json and assets/ are served at `/` in dev and copied into
  // build/ at deploy time — no duplicate files in the repo.
  server: {
    fs: {
      allow: [resolve(here, ".."), resolve(here, "../exporter")],
    },
  },
});
