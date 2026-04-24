<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { loadQuestions } from "$lib/data";
  import { getProgressStore, onStoreChange, notifyStoreSwap } from "$lib/progress/factory";
  import { authState } from "$lib/auth";
  import { buildQueue } from "$lib/queue";
  import { getDailyCounts, onDailyChange } from "$lib/daily";
  import { getSettings, onSettingsChange } from "$lib/settings";
  import { onSyncStateChange, type SyncState } from "$lib/sync";
  import type { Question } from "$lib/types";

  let { children } = $props();

  let dueCount = $state<number | null>(null);
  let userEmail = $state<string | null>(null);
  let syncState = $state<SyncState>({ kind: "idle" });
  let updateReady = $state(false);
  let waitingWorker: ServiceWorker | null = null;

  async function refresh() {
    const [{ questions }, progress] = await Promise.all([
      loadQuestions(),
      getProgressStore().all(),
    ]);
    const { introducedToday, reviewedToday } = getDailyCounts();
    const { newPerDay, reviewsPerDay } = getSettings();
    const bucket = buildQueue(questions as Question[], progress, {
      now: new Date(),
      newPerDay,
      reviewsPerDay,
      introducedToday,
      reviewedToday,
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
    const unsubDaily = onDailyChange(() => refresh());
    const unsubSettings = onSettingsChange(() => refresh());
    const unsubSync = onSyncStateChange((s) => (syncState = s));
    registerServiceWorker();
    return () => {
      unsubAuth();
      unsubStore();
      unsubProgress();
      unsubDaily();
      unsubSettings();
      unsubSync();
    };
  });

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      // If a newer worker is already waiting at load time, surface it.
      if (reg.waiting) markWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            markWaiting(nw);
          }
        });
      });
    });
    // When the new worker takes over, reload so the page runs against it.
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  function markWaiting(w: ServiceWorker) {
    waitingWorker = w;
    updateReady = true;
  }

  function applyUpdate() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }

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

{#if updateReady}
  <div class="update-banner" role="status">
    <span>A new version is available.</span>
    <button onclick={applyUpdate}>Reload</button>
  </div>
{/if}

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
  <a href="{base}/settings" aria-current={page.url.pathname.startsWith(`${base}/settings`) ? "page" : undefined}>Settings</a>
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
