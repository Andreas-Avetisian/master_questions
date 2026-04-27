<script lang="ts">
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { loadQuestions } from "$lib/data";
  import { getProgressStore, onStoreChange } from "$lib/progress/factory";
  import { buildQueue } from "$lib/queue";
  import { getDailyCounts, onDailyChange } from "$lib/daily";
  import { getSettings, onSettingsChange } from "$lib/settings";
  import type { Question } from "$lib/types";

  let totalQuestions = $state(0);
  let answered = $state(0);
  let unwritten = $state(0);
  let dueCount = $state(0);
  let newToday = $state(0);
  let reviewedEver = $state(0);
  let introducedToday = $state(0);
  let reviewedToday = $state(0);
  let newPerDay = $state(0);
  let reviewsPerDay = $state(0);

  async function refresh() {
    const { questions } = await loadQuestions();
    totalQuestions = questions.length;
    answered = (questions as Question[]).filter((q) => !q.answer_is_empty).length;
    unwritten = totalQuestions - answered;

    const progress = await getProgressStore().all();
    reviewedEver = Object.keys(progress).length;

    const counts = getDailyCounts();
    introducedToday = counts.introducedToday;
    reviewedToday = counts.reviewedToday;

    const s = getSettings();
    newPerDay = s.newPerDay;
    reviewsPerDay = s.reviewsPerDay;

    const q = buildQueue(questions as Question[], progress, {
      now: new Date(),
      newPerDay,
      reviewsPerDay,
      introducedToday,
      reviewedToday,
    });
    dueCount = q.due.length;
    newToday = q.newCards.length;
  }

  onMount(() => {
    refresh();
    const unsubProgress = getProgressStore().subscribe(refresh);
    const unsubStore = onStoreChange(refresh);
    const unsubDaily = onDailyChange(refresh);
    const unsubSettings = onSettingsChange(refresh);
    return () => {
      unsubProgress();
      unsubStore();
      unsubDaily();
      unsubSettings();
    };
  });
</script>

<h1>Master Questions</h1>
<p class="muted">A study tool for the 72 exam notes in this repo.</p>

<div class="card">
  <h2 style="margin-top:0">Today</h2>
  <h3 style="margin:0.75em 0 0.25em; font-size:1rem;">Available to study now</h3>
  <ul style="list-style:none; padding:0; margin:0;">
    <li>Due review cards: <strong>{dueCount}</strong></li>
    <li>New cards: <strong>{newToday}</strong></li>
  </ul>
  <h3 style="margin:0.9em 0 0.25em; font-size:1rem;">Today’s progress</h3>
  <ul class="muted" style="list-style:none; padding:0; margin:0; font-size:0.9rem;">
    <li>New cards studied: {introducedToday} / {newPerDay} daily limit</li>
    <li>Review cards studied: {reviewedToday} / {reviewsPerDay} daily limit</li>
  </ul>
  {#if dueCount + newToday > 0}
    <p><a href="{base}/review"><button style="background: var(--accent); color: var(--accent-fg); border-color: var(--accent);">Start review →</button></a></p>
  {:else}
    <p class="muted">Nothing due. Come back later or explore in <a href="{base}/browse">Browse</a>.</p>
  {/if}
</div>

<div class="card">
  <h3 style="margin-top:0">Deck</h3>
  <ul style="list-style:none; padding:0; margin:0;">
    <li>{totalQuestions} total questions</li>
    <li>{answered} with answers</li>
    <li>{unwritten} still being written <span class="muted">(hidden from review)</span></li>
    <li>{reviewedEver} reviewed at least once</li>
  </ul>
</div>

<p class="muted" style="margin-top:2rem; font-size:0.9rem;">
  Keyboard: <span class="kbd">Space</span> reveal · <span class="kbd">1</span> Again · <span class="kbd">2</span> Hard · <span class="kbd">3</span> Good · <span class="kbd">4</span> Easy
</p>
