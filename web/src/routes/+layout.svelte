<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { loadQuestions } from "$lib/data";
  import { getProgressStore, onStoreChange, notifyStoreSwap } from "$lib/progress/factory";
  import { authState } from "$lib/auth";
  import { buildQueue } from "$lib/queue";
  import { onSyncStateChange, type SyncState } from "$lib/sync";
  import type { Question } from "$lib/types";

  let { children } = $props();

  let dueCount = $state<number | null>(null);
  let userEmail = $state<string | null>(null);
  let syncState = $state<SyncState>({ kind: "idle" });

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
    const unsubSync = onSyncStateChange((s) => (syncState = s));
    return () => {
      unsubAuth();
      unsubStore();
      unsubProgress();
      unsubSync();
    };
  });

  async function handleLogout() {
    await authState().logout();
    // authStore.onChange fires → notifyStoreSwap → refresh
  }

  const commitSha = import.meta.env.VITE_COMMIT_SHA ?? "dev";
  const commitShort = commitSha.slice(0, 7);
  const commitUrl =
    commitSha === "dev"
      ? null
      : `https://github.com/Andreas-Avetisian/master_questions/commit/${commitSha}`;
</script>

<nav class="nav">
  <a class="brand" href="{base}/" aria-current={page.url.pathname === `${base}/` ? "page" : undefined}>
    <span class="brand-long">Master Questions</span>
    <span class="brand-short" aria-hidden="true">MQ</span>
  </a>
  <a href="{base}/review" aria-current={page.url.pathname.startsWith(`${base}/review`) ? "page" : undefined}>
    Review
    {#if dueCount !== null && dueCount > 0}
      <span class="badge">{dueCount}</span>
    {/if}
  </a>
  <a href="{base}/browse" aria-current={page.url.pathname.startsWith(`${base}/browse`) ? "page" : undefined}>Browse</a>
  <span class="spacer"></span>
  {#if userEmail}
    <a class="nav-email" href="{base}/account" title={userEmail}>{userEmail}</a>
    <button onclick={handleLogout} style="font-size:0.9em;">Sign out</button>
  {:else}
    <a href="{base}/login" aria-current={page.url.pathname.startsWith(`${base}/login`) ? "page" : undefined}>Sign in</a>
  {/if}
</nav>

<main class="container">
  {@render children()}
</main>

<footer class="site-footer">
  {#if userEmail}
    <span class="sync sync-{syncState.kind}" title={syncState.kind === "error" ? syncState.message : ""}>
      {#if syncState.kind === "syncing"}
        <span class="sync-dot" aria-hidden="true"></span>syncing…
      {:else if syncState.kind === "error"}
        <span class="sync-dot" aria-hidden="true"></span>sync failed
      {:else}
        <span class="sync-dot" aria-hidden="true"></span>synced
      {/if}
    </span>
    <span class="sep">·</span>
  {/if}
  {#if commitUrl}
    build <a href={commitUrl} target="_blank" rel="noopener"><code>{commitShort}</code></a>
  {:else}
    build <code>{commitShort}</code>
  {/if}
</footer>
