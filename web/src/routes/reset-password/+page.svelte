<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { pb } from "$lib/pb";

  let mode = $state<"request" | "confirm">("request");
  let email = $state("");
  let password = $state("");
  let password2 = $state("");
  let token = $state<string | null>(null);
  let busy = $state(false);
  let message = $state<string | null>(null);
  let error = $state<string | null>(null);

  onMount(() => {
    const t = page.url.searchParams.get("token");
    if (t) {
      token = t;
      mode = "confirm";
    }
  });

  async function requestReset(e: Event) {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      await pb().collection("users").requestPasswordReset(email);
      message = "If an account exists for this email, we sent a reset link.";
    } catch (err) {
      error = (err as Error).message ?? "Could not request reset.";
    } finally {
      busy = false;
    }
  }

  async function confirmReset(e: Event) {
    e.preventDefault();
    if (!token) return;
    if (password !== password2) {
      error = "Passwords do not match.";
      return;
    }
    if (password.length < 8) {
      error = "Password must be at least 8 characters.";
      return;
    }
    busy = true;
    error = null;
    try {
      await pb().collection("users").confirmPasswordReset(token, password, password2);
      message = "Password updated. You can now sign in.";
      mode = "request";
      password = "";
      password2 = "";
    } catch (err) {
      error = (err as Error).message ?? "Reset failed.";
    } finally {
      busy = false;
    }
  }
</script>

<h1>Reset password</h1>

{#if mode === "request"}
  <form class="card" onsubmit={requestReset} style="display:flex; flex-direction:column; gap:0.75rem; max-width:24rem;">
    <p class="muted" style="margin:0;">Enter your email. If an account exists, we'll send a reset link.</p>
    <label>
      Email
      <input type="email" bind:value={email} required autocomplete="email"
             style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg);" />
    </label>
    {#if error}<p style="color: var(--danger); margin:0;">{error}</p>{/if}
    {#if message}<p style="color: var(--ok); margin:0;">{message}</p>{/if}
    <button type="submit" disabled={busy} style="background: var(--accent); color: var(--accent-fg); border-color: var(--accent);">
      {busy ? "Sending…" : "Send reset link"}
    </button>
    <p class="muted" style="font-size:0.9em; margin:0;"><a href="{base}/login">Back to sign in</a></p>
  </form>
{:else}
  <form class="card" onsubmit={confirmReset} style="display:flex; flex-direction:column; gap:0.75rem; max-width:24rem;">
    <label>
      New password
      <input type="password" bind:value={password} required autocomplete="new-password" minlength="8"
             style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg);" />
    </label>
    <label>
      Confirm new password
      <input type="password" bind:value={password2} required autocomplete="new-password"
             style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg);" />
    </label>
    {#if error}<p style="color: var(--danger); margin:0;">{error}</p>{/if}
    {#if message}<p style="color: var(--ok); margin:0;">{message}</p>{/if}
    <button type="submit" disabled={busy} style="background: var(--accent); color: var(--accent-fg); border-color: var(--accent);">
      {busy ? "Saving…" : "Set new password"}
    </button>
  </form>
{/if}
