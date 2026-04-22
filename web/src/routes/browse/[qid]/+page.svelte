<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { loadQuestions } from "$lib/data";
  import type { Question } from "$lib/types";
  import QuestionCard from "$lib/ui/QuestionCard.svelte";

  let question = $state<Question | null | undefined>(undefined);

  const qid = $derived(Number(page.params.qid));

  onMount(async () => {
    const { questions } = await loadQuestions();
    question = (questions as Question[]).find((q) => q.qid === qid) ?? null;
  });
</script>

<p><a href="{base}/browse">← All questions</a></p>

{#if question === undefined}
  <p class="muted">Loading…</p>
{:else if question === null}
  <p>Question #{qid} not found.</p>
{:else}
  <QuestionCard {question} revealed={true} />
{/if}
