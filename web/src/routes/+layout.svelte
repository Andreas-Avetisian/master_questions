<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { loadQuestions } from "$lib/data";
  import { getProgressStore } from "$lib/progress/local";
  import { buildQueue } from "$lib/queue";
  import type { Question } from "$lib/types";

  let { children } = $props();

  let dueCount = $state<number | null>(null);

  async function refresh() {
    const [{ questions }, progress] = await Promise.all([
      loadQuestions(),
      getProgressStore().all(),
    ]);
    const bucket = buildQueue(questions as Question[], progress, {
      now: new Date(),
      newPerDay: 10,
    });
    dueCount = bucket.total;
  }

  onMount(() => {
    refresh();
    const store = getProgressStore();
    return store.subscribe(() => refresh());
  });
</script>

<nav class="nav">
  <a href="{base}/" aria-current={page.url.pathname === `${base}/` ? "page" : undefined}>Master Questions</a>
  <a href="{base}/review" aria-current={page.url.pathname.startsWith(`${base}/review`) ? "page" : undefined}>
    Review
    {#if dueCount !== null && dueCount > 0}
      <span class="badge">{dueCount}</span>
    {/if}
  </a>
  <a href="{base}/browse" aria-current={page.url.pathname.startsWith(`${base}/browse`) ? "page" : undefined}>Browse</a>
  <span class="spacer"></span>
</nav>

<main class="container">
  {@render children()}
</main>
