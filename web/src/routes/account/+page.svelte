<script lang="ts">
  import { base } from "$app/paths";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { pb } from "$lib/pb";
  import { authState } from "$lib/auth";
  import type { AuthUser } from "$lib/pb";

  let user = $state<AuthUser | null>(null);
  let message = $state<string | null>(null);
  let error = $state<string | null>(null);

  onMount(() => {
    const auth = authState();
    return auth.subscribe((u) => {
      user = u;
      if (!u) goto(`${base}/login`);
    });
  });

  async function resendVerification() {
    if (!user) return;
    try {
      await pb().collection("users").requestVerification(user.email);
      message = "Verification email sent. Check your inbox.";
    } catch (err) {
      error = (err as Error).message ?? "Could not send verification.";
    }
  }

  async function signOut() {
    await authState().logout();
    await goto(`${base}/`);
  }
</script>

<h1>Account</h1>

{#if user}
  <div class="card">
    <p><strong>Email:</strong> {user.email}</p>
    <p><strong>Verified:</strong> {user.verified ? "yes" : "no"}</p>
    {#if !user.verified}
      <p class="muted">
        You need to verify your email before some features work.
        <button type="button" onclick={resendVerification}>Resend verification email</button>
      </p>
    {/if}
    {#if message}<p style="color: var(--ok);">{message}</p>{/if}
    {#if error}<p style="color: var(--danger);">{error}</p>{/if}
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Sync</h3>
    <p class="muted">
      Your study progress syncs automatically to the server while you're signed in.
      Signing out keeps your local progress on this device.
    </p>
    <button onclick={signOut}>Sign out</button>
  </div>
{:else}
  <p class="muted">Loading…</p>
{/if}
