<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { pb } from "$lib/pb";

  let status = $state<"pending" | "ok" | "error">("pending");
  let message = $state("");

  onMount(async () => {
    const token = page.url.searchParams.get("token");
    if (!token) {
      status = "error";
      message = "Missing verification token.";
      return;
    }
    try {
      await pb().collection("users").confirmVerification(token);
      status = "ok";
    } catch (err) {
      status = "error";
      message = (err as Error).message ?? "Verification failed.";
    }
  });
</script>

<h1>Email verification</h1>

<div class="card">
  {#if status === "pending"}
    <p class="muted">Verifying…</p>
  {:else if status === "ok"}
    <p><strong>Your email is verified.</strong></p>
    <p><a href="{base}/login">Sign in →</a></p>
  {:else}
    <p style="color: var(--danger);">{message}</p>
    <p><a href="{base}/login">Back to sign in</a></p>
  {/if}
</div>
