import PocketBase from "pocketbase";
import { browser } from "$app/environment";

const url = import.meta.env.VITE_PB_URL ?? "http://localhost:8090";

// A single PocketBase client per browser tab. SSR gets a throwaway instance
// that will never be used (the app is fully client-rendered via adapter-static
// SPA fallback), but the import doesn't blow up.
let instance: PocketBase | null = null;

export function pb(): PocketBase {
  if (!instance) {
    instance = new PocketBase(url);
    if (browser) {
      // Persist auth across reloads via localStorage (the SDK default store
      // already does this; call is here as a seam for test overrides).
      instance.autoCancellation(false);
    }
  }
  return instance;
}

export type AuthUser = {
  id: string;
  email: string;
  verified: boolean;
};

export function currentUser(): AuthUser | null {
  const m = pb().authStore.record;
  if (!m) return null;
  return {
    id: m.id,
    email: (m.email as string) ?? "",
    verified: Boolean(m.verified),
  };
}
