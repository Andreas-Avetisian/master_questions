<script lang="ts">
  import type { Grade } from "$lib/srs";

  let { onGrade }: { onGrade: (g: Grade) => void } = $props();
</script>

<div class="grade-bar" role="group" aria-label="Grade this recall">
  <button class="again" onclick={() => onGrade(0)} aria-label="Again (failed)">
    Again
    <span class="key">1</span>
  </button>
  <button class="hard" onclick={() => onGrade(3)} aria-label="Hard">
    Hard
    <span class="key">2</span>
  </button>
  <button class="good" onclick={() => onGrade(4)} aria-label="Good">
    Good
    <span class="key">3</span>
  </button>
  <button class="easy" onclick={() => onGrade(5)} aria-label="Easy">
    Easy
    <span class="key">4</span>
  </button>
</div>
