<script lang="ts">
  import { base } from "$app/paths";
  import { goto } from "$app/navigation";
  import { pb } from "$lib/pb";
  import { ALLOWED_DOMAIN, isAllowedEmail } from "$lib/auth";

  let email = $state("");
  let password = $state("");
  let password2 = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let sent = $state(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    error = null;

    if (!isAllowedEmail(email)) {
      error = `Only @${ALLOWED_DOMAIN} emails are accepted.`;
      return;
    }
    if (password.length < 8) {
      error = "Password must be at least 8 characters.";
      return;
    }
    if (password !== password2) {
      error = "Passwords do not match.";
      return;
    }

    busy = true;
    try {
      await pb().collection("users").create({
        email,
        password,
        passwordConfirm: password2,
      });
      await pb().collection("users").requestVerification(email);
      sent = true;
    } catch (err) {
      error = (err as Error).message ?? "Signup failed.";
    } finally {
      busy = false;
    }
  }
</script>

<h1>Create account</h1>

{#if sent}
  <div class="card">
    <p><strong>Check your inbox.</strong></p>
    <p>We sent a verification link to <code>{email}</code>. Click it, then come back and <a href="{base}/login">sign in</a>.</p>
  </div>
{:else}
  <form class="card" onsubmit={onSubmit} style="display:flex; flex-direction:column; gap:0.75rem; max-width:24rem;">
    <label>
      Email
      <input
        type="email"
        bind:value={email}
        required
        autocomplete="email"
        placeholder="you@{ALLOWED_DOMAIN}"
        style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg);"
      />
    </label>
    <label>
      Password
      <input
        type="password"
        bind:value={password}
        required
        autocomplete="new-password"
        minlength="8"
        style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg);"
      />
    </label>
    <label>
      Confirm password
      <input
        type="password"
        bind:value={password2}
        required
        autocomplete="new-password"
        style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg); color:var(--fg);"
      />
    </label>

    {#if error}
      <p style="color: var(--danger); margin:0;">{error}</p>
    {/if}

    <button type="submit" disabled={busy} style="background: var(--accent); color: var(--accent-fg); border-color: var(--accent);">
      {busy ? "Creating…" : "Create account"}
    </button>

    <p class="muted" style="font-size:0.9em; margin:0;">
      Already have an account? <a href="{base}/login">Sign in</a>.
    </p>
  </form>
{/if}
