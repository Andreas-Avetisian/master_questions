<script lang="ts">
  import type { Question } from "$lib/types";
  import SourceList from "./SourceList.svelte";
  import { renderMarkdown } from "$lib/markdown";

  let {
    question,
    revealed,
    reviewBadge,
  }: { question: Question; revealed: boolean; reviewBadge?: string } = $props();

  let renderedAnswer = $derived(
    question.answer_is_empty ? "" : renderMarkdown(question.answer_markdown),
  );
</script>

<article class="card">
  <div class="muted" style="font-size:0.85em;">
    #{question.qid}
    {#if reviewBadge}
      <span class="badge-pill review-badge">{reviewBadge}</span>
    {/if}
    {#each question.courses as c}
      <span class="badge-pill">{c}</span>
    {/each}
  </div>
  <h1 class="question-h1">{question.question}</h1>

  {#if revealed}
    {#if question.answer_is_empty}
      <p class="muted"><em>Answer not written yet.</em></p>
    {:else}
      <div class="answer">
        {@html renderedAnswer}
      </div>
    {/if}
    <SourceList sources={question.sources} />
  {/if}
</article>
