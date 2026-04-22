<script lang="ts">
  import type { Source } from "$lib/types";
  let { sources }: { sources: Source[] } = $props();
</script>

{#if sources.length > 0}
  <div style="margin-top:1.25rem; font-size:0.9rem;">
    <strong class="muted">Sources</strong>
    <ul style="margin:0.25rem 0 0; padding-left:1.25rem;">
      {#each sources as s}
        <li>
          {#if s.file}
            <code>{s.file}</code>
          {:else}
            <em class="muted">(source not yet filled in)</em>
          {/if}
          {#if s.pages_raw}
            <span class="muted">— p. {s.pages_raw}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
