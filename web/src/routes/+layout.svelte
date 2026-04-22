<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { loadQuestions } from "$lib/data";
  import { getProgressStore, onStoreChange, notifyStoreSwap } from "$lib/progress/factory";
  import { authState } from "$lib/auth";
  import { buildQueue } from "$lib/queue";
  import type { Question } from "$lib/types";

  let { children } = $props();

  let dueCount = $state<number | null>(null);
  let userEmail = $state<string | null>(null);

  async function refresh() {
    const [{ questions }, progress] = await Promise.all([
      loadQuestions(),
      getProgressStore().all(),
    ]);
    const bucket = buildQueue(questions as Question[], progress, {
      now: new Date(),
      newPerDay: 10,
    });
    dueCount = bucket.total;
  }

  onMount(() => {
    refresh();
    const auth = authState();
    const unsubAuth = auth.subscribe((u) => {
      userEmail = u?.email ?? null;
      notifyStoreSwap();
    });
    const unsubStore = onStoreChange(() => refresh());
    const unsubProgress = getProgressStore().subscribe(() => refresh());
    return () => {
      unsubAuth();
      unsubStore();
      unsubProgress();
    };
  });

  async function handleLogout() {
    await authState().logout();
    // authStore.onChange fires → notifyStoreSwap → refresh
  }
</script>

<nav class="nav">
  <a href="{base}/" aria-current={page.url.pathname === `${base}/` ? "page" : undefined}>Master Questions</a>
  <a href="{base}/review" aria-current={page.url.pathname.startsWith(`${base}/review`) ? "page" : undefined}>
    Review
    {#if dueCount !== null && dueCount > 0}
      <span class="badge">{dueCount}</span>
    {/if}
  </a>
  <a href="{base}/browse" aria-current={page.url.pathname.startsWith(`${base}/browse`) ? "page" : undefined}>Browse</a>
  <span class="spacer"></span>
  {#if userEmail}
    <a href="{base}/account" title={userEmail}>{userEmail}</a>
    <button onclick={handleLogout} style="font-size:0.9em;">Sign out</button>
  {:else}
    <a href="{base}/login" aria-current={page.url.pathname.startsWith(`${base}/login`) ? "page" : undefined}>Sign in</a>
  {/if}
</nav>

<main class="container">
  {@render children()}
</main>
