<script lang="ts">
  import { base } from "$app/paths";
  import { goto } from "$app/navigation";
  import { pb } from "$lib/pb";

  let email = $state("");
  let password = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function onSubmit(e: Event) {
    e.preventDefault();
    error = null;
    busy = true;
    try {
      await pb().collection("users").authWithPassword(email, password);
      await goto(`${base}/`);
    } catch (err) {
      const msg = (err as Error).message ?? "";
      // PocketBase returns a generic 400 on bad creds; surface something useful.
      error = msg.includes("Failed to authenticate")
        ? "Email or password is incorrect."
        : msg || "Sign in failed.";
    } finally {
      busy = false;
    }
  }

  async function resend() {
    if (!email) {
      error = "Enter your email above first.";
      return;
    }
    try {
      await pb().collection("users").requestVerification(email);
      error = "Verification email sent. Check your inbox.";
    } catch (err) {
      error = (err as Error).message ?? "Could not send verification.";
    }
  }
</script>

<h1>Sign in</h1>

<form class="card" onsubmit={onSubmit} style="display:flex; flex-direction:column; gap:0.75rem; max-width:24rem;">
  <label>
    Email
    <input
      type="email"
      bind:value={email}
      required
      autocomplete="email"
      style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg);"
    />
  </label>
  <label>
    Password
    <input
      type="password"
      bind:value={password}
      required
      autocomplete="current-password"
      style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg);"
    />
  </label>

  {#if error}
    <p style="color: var(--danger); margin:0;">{error}</p>
  {/if}

  <button type="submit" disabled={busy} style="background: var(--accent); color: var(--accent-fg); border-color: var(--accent);">
    {busy ? "Signing in…" : "Sign in"}
  </button>

  <p class="muted" style="font-size:0.9em; margin:0;">
    <a href="{base}/signup">Create account</a> ·
    <a href="{base}/reset-password">Forgot password?</a> ·
    <button type="button" onclick={resend} style="background:none; border:none; padding:0; color:var(--accent); cursor:pointer;">Resend verification</button>
  </p>
</form>
