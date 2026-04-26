<script lang="ts">
  import { base } from "$app/paths";
  import { onMount, onDestroy } from "svelte";
  import { loadQuestions } from "$lib/data";
  import { getProgressStore } from "$lib/progress/factory";
  import { buildQueue } from "$lib/queue";
  import { bumpIntroduced, bumpReviewed, getDailyCounts } from "$lib/daily";
  import { getSettings } from "$lib/settings";
  import { schedule, type CardProgress, type Grade } from "$lib/srs";
  import type { Question } from "$lib/types";
  import Confetti from "$lib/ui/Confetti.svelte";
  import QuestionCard from "$lib/ui/QuestionCard.svelte";
  import GradeBar from "$lib/ui/GradeBar.svelte";

  let queue = $state<Question[]>([]);
  let progressByQid = $state<Record<number, CardProgress>>({});
  let index = $state(0);
  let revealed = $state(false);
  let ready = $state(false);
  let sessionGraded = $state(0);
  let celebrating = $state(false);

  const current = $derived(queue[index]);
  const currentProgress = $derived(current ? (progressByQid[current.qid] ?? null) : null);
  const reviewBadge = $derived(current ? visitBadge(currentProgress) : undefined);

  function ordinal(n: number): string {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  }

  function visitBadge(progress: CardProgress | null): string {
    if (!progress) return "new";
    return `${ordinal(progress.repetitions + progress.lapses + 1)} visit`;
  }

  async function load() {
    const [{ questions }, progress] = await Promise.all([
      loadQuestions(),
      getProgressStore().all(),
    ]);
    progressByQid = progress;
    const { introducedToday, reviewedToday } = getDailyCounts();
    const { newPerDay, reviewsPerDay } = getSettings();
    const q = buildQueue(questions as Question[], progress, {
      now: new Date(),
      newPerDay,
      reviewsPerDay,
      introducedToday,
      reviewedToday,
    });
    queue = [...q.due, ...q.newCards];
    index = 0;
    revealed = false;
    ready = true;
  }

  async function grade(g: Grade) {
    if (!current || !revealed) return;
    const finishedDailyQueue = index >= queue.length - 1;
    const store = getProgressStore();
    const prev = await store.get(current.qid);
    const updated = schedule(prev, g, new Date(), current.qid);
    await store.put(updated);
    progressByQid = { ...progressByQid, [current.qid]: updated };
    if (prev === null) bumpIntroduced();
    else bumpReviewed();
    sessionGraded++;
    index++;
    revealed = false;
    if (finishedDailyQueue) celebrating = true;
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

{#if celebrating}
  <Confetti onDone={() => (celebrating = false)} />
{/if}

{#if !ready}
  <p class="muted">Loading…</p>
{:else if !current}
  <div class="card">
    <p><strong>All done.</strong> {sessionGraded} cards reviewed this session.</p>
    <p class="muted">Nice work. Take a minute to drink some water 💧</p>
    <p><a href="{base}/">← Back to dashboard</a></p>
  </div>
{:else}
  <p class="muted" style="font-size:0.9em;">
    Card {index + 1} of {queue.length} · {sessionGraded} graded
  </p>

  <QuestionCard question={current} {revealed} {reviewBadge} />

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
