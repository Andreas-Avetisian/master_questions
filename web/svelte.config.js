import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "index.html", // SPA mode — simplest for GH Pages with client routing
      precompress: false,
      strict: true,
    }),
    paths: {
      base: process.env.BASE_PATH ?? "",
    },
    // Version name flows into `$service-worker`'s `version` export and the
    // SW uses it as its cache key, so a new deploy invalidates old caches.
    version: {
      name: process.env.VITE_COMMIT_SHA ?? `dev-${Date.now()}`,
    },
  },
};

export default config;
