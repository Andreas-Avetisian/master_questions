<script lang="ts">
  import { base } from "$app/paths";
  import { onMount, onDestroy } from "svelte";
  import { loadQuestions } from "$lib/data";
  import { getProgressStore } from "$lib/progress/factory";
  import { buildQueue } from "$lib/queue";
  import { schedule, type Grade } from "$lib/srs";
  import type { Question } from "$lib/types";
  import QuestionCard from "$lib/ui/QuestionCard.svelte";
  import GradeBar from "$lib/ui/GradeBar.svelte";

  let queue = $state<Question[]>([]);
  let index = $state(0);
  let revealed = $state(false);
  let ready = $state(false);
  let sessionGraded = $state(0);

  const current = $derived(queue[index]);

  async function load() {
    const [{ questions }, progress] = await Promise.all([
      loadQuestions(),
      getProgressStore().all(),
    ]);
    const q = buildQueue(questions as Question[], progress, {
      now: new Date(),
      newPerDay: 10,
    });
    queue = [...q.due, ...q.newCards];
    index = 0;
    revealed = false;
    ready = true;
  }

  async function grade(g: Grade) {
    if (!current || !revealed) return;
    const store = getProgressStore();
    const prev = await store.get(current.qid);
    const updated = schedule(prev, g, new Date(), current.qid);
    await store.put(updated);
    sessionGraded++;
    index++;
    revealed = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!current) return;
    if (e.key === " ") {
      e.preventDefault();
      if (!revealed) revealed = true;
      return;
    }
    if (!revealed) return;
    const map: Record<string, Grade> = { "1": 0, "2": 3, "3": 4, "4": 5 };
    const g = map[e.key];
    if (g !== undefined) {
      e.preventDefault();
      grade(g);
    }
  }

  onMount(() => {
    load();
    window.addEventListener("keydown", onKey);
  });
  onDestroy(() => {
    if (typeof window !== "undefined") window.removeEventListener("keydown", onKey);
  });
</script>

<h1>Review</h1>

{#if !ready}
  <p class="muted">Loading…</p>
{:else if !current}
  <div class="card">
    <p><strong>All done.</strong> {sessionGraded} cards reviewed this session.</p>
    <p><a href="{base}/">← Back to dashboard</a></p>
  </div>
{:else}
  <p class="muted" style="font-size:0.9em;">
    Card {index + 1} of {queue.length} · {sessionGraded} graded
  </p>

  <QuestionCard question={current} {revealed} />

  {#if !revealed}
    <button
      style="width:100%; padding:0.9rem; background: var(--accent); color: var(--accent-fg); border-color: var(--accent);"
      onclick={() => (revealed = true)}>
      Reveal answer
      <span class="kbd" style="margin-left:0.5em;">Space</span>
    </button>
  {:else}
    <GradeBar onGrade={grade} />
  {/if}
{/if}
