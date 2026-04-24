<script lang="ts">
  import { onMount } from "svelte";
  import {
    DEFAULT_NEW_PER_DAY,
    DEFAULT_REVIEWS_PER_DAY,
    MAX_LIMIT,
    MIN_LIMIT,
    getSettings,
    setSettings,
  } from "$lib/settings";

  let newPerDay = $state(DEFAULT_NEW_PER_DAY);
  let reviewsPerDay = $state(DEFAULT_REVIEWS_PER_DAY);
  let saved = $state(false);

  onMount(() => {
    const s = getSettings();
    newPerDay = s.newPerDay;
    reviewsPerDay = s.reviewsPerDay;
  });

  function save() {
    setSettings({ newPerDay, reviewsPerDay });
    saved = true;
    setTimeout(() => (saved = false), 1500);
  }

  function reset() {
    newPerDay = DEFAULT_NEW_PER_DAY;
    reviewsPerDay = DEFAULT_REVIEWS_PER_DAY;
    setSettings({ newPerDay, reviewsPerDay });
    saved = true;
    setTimeout(() => (saved = false), 1500);
  }
</script>

<h1>Settings</h1>

<div class="card">
  <h2 style="margin-top:0;">Daily limits</h2>
  <p class="muted">
    Controls how the review queue is paced. New-per-day throttles how fast fresh
    cards enter the pipeline; reviews-per-day caps how many due cards you'll see on
    any one day (the rest roll into tomorrow).
  </p>

  <form onsubmit={(e) => { e.preventDefault(); save(); }}>
    <label style="display:block; margin:1em 0;">
      <div><strong>New cards per day</strong></div>
      <div class="muted" style="font-size:0.85rem;">Fresh questions introduced each day.</div>
      <input
        type="number"
        min={MIN_LIMIT}
        max={MAX_LIMIT}
        step="1"
        bind:value={newPerDay}
        style="margin-top:0.25em; width:6em;"
      />
    </label>

    <label style="display:block; margin:1em 0;">
      <div><strong>Reviews per day</strong></div>
      <div class="muted" style="font-size:0.85rem;">Max due-card reviews shown per day.</div>
      <input
        type="number"
        min={MIN_LIMIT}
        max={MAX_LIMIT}
        step="1"
        bind:value={reviewsPerDay}
        style="margin-top:0.25em; width:6em;"
      />
    </label>

    <div style="display:flex; gap:0.5em; align-items:center; margin-top:1em;">
      <button
        type="submit"
        style="background: var(--accent); color: var(--accent-fg); border-color: var(--accent);">
        Save
      </button>
      <button type="button" onclick={reset}>Reset to defaults</button>
      {#if saved}<span class="muted" style="color: var(--ok);">Saved.</span>{/if}
    </div>
  </form>
</div>
