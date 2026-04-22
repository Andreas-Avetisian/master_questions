<script lang="ts">
  import type { Question } from "$lib/types";
  import SourceList from "./SourceList.svelte";
  import { renderMarkdown } from "$lib/markdown";

  let { question, revealed }: { question: Question; revealed: boolean } = $props();

  let renderedAnswer = $derived(
    question.answer_is_empty ? "" : renderMarkdown(question.answer_markdown),
  );
</script>

<article class="card">
  <div class="muted" style="font-size:0.85em;">
    #{question.qid}
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
