import { browser } from "$app/environment";
import { pb, currentUser, type AuthUser } from "./pb";

/**
 * Reactive auth state backed by PocketBase's authStore.
 *
 * Svelte 5 doesn't offer a "global rune" out of the box, so this is a
 * tiny observer: components import `authState` and call `subscribe` in
 * onMount, then read `authState.user` inside a `$derived` or `$effect`.
 *
 * We avoid `writable` stores to keep the dep surface small and match
 * the Svelte-5 runes style used elsewhere in the app.
 */
type Listener = (user: AuthUser | null) => void;

class AuthState {
  private listeners = new Set<Listener>();
  private _user: AuthUser | null = null;

  constructor() {
    if (browser) {
      this._user = currentUser();
      pb().authStore.onChange(() => {
        this._user = currentUser();
        for (const l of this.listeners) l(this._user);
      }, false);
    }
  }

  get user(): AuthUser | null {
    return this._user;
  }

  get loggedIn(): boolean {
    return this._user !== null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this._user);
    return () => this.listeners.delete(fn);
  }

  async logout(): Promise<void> {
    pb().authStore.clear();
  }
}

let singleton: AuthState | null = null;

export function authState(): AuthState {
  if (!singleton) singleton = new AuthState();
  return singleton;
}

export const ALLOWED_DOMAIN = "ustp-students.at";

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}
