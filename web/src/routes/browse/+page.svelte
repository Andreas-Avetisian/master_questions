<script lang="ts">
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { loadQuestions, courses as coursesList } from "$lib/data";
  import type { Question } from "$lib/types";

  let questions = $state<Question[]>([]);
  let available = $state<string[]>([]);
  let activeCourse = $state<string | null>(null);

  const filtered = $derived(
    activeCourse
      ? questions.filter((q) => q.courses.includes(activeCourse!))
      : questions,
  );

  onMount(async () => {
    const data = await loadQuestions();
    questions = (data.questions as Question[]).slice().sort((a, b) => a.qid - b.qid);
    available = coursesList(questions);
  });
</script>

<h1>Browse</h1>

<div class="filter-row" role="group" aria-label="Filter by course">
  <button
    aria-pressed={activeCourse === null}
    onclick={() => (activeCourse = null)}>All ({questions.length})</button>
  {#each available as c}
    <button
      aria-pressed={activeCourse === c}
      onclick={() => (activeCourse = c)}>{c}</button>
  {/each}
</div>

<ul class="q-list">
  {#each filtered as q (q.qid)}
    <li>
      <span class="qid">#{q.qid}</span>
      <a href="{base}/browse/{q.qid}" style="flex:1;">{q.question}</a>
      {#if q.answer_is_empty}
        <span class="badge-pill badge-empty">not written yet</span>
      {/if}
      {#each q.courses as c}
        <span class="badge-pill">{c}</span>
      {/each}
    </li>
  {/each}
</ul>

{#if filtered.length === 0 && questions.length > 0}
  <p class="muted">No questions match this filter.</p>
{/if}
