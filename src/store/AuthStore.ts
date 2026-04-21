// src/store/AuthStore.ts
// Session behaviour:
//   - Token lives in localStorage (survives tab switches, page refreshes).
//   - A "session alive" flag lives in sessionStorage (cleared by browser on full close).
//   - On app boot: if the flag is gone the browser was fully closed → wipe the token.
//   - Result: stay logged in while browser is open; re-login required after full browser close.

import { create } from "zustand";
import type { AuthToken, UserProfile } from "@/services/api";
import { saveToken, clearToken, loadToken } from "@/services/api";

const SESSION_FLAG = "weave_session_alive";

// ── On every app boot: enforce "expire on browser close" ──────────────────────
function resolveInitialToken(): AuthToken | null {
  const token = loadToken();
  if (!token) return null;

  const sessionAlive = sessionStorage.getItem(SESSION_FLAG);
  if (!sessionAlive) {
    // Browser was fully closed since last login → treat as logged out
    clearToken();
    return null;
  }

  return token;
}

// Plant / refresh the flag (called on login and on every page load while logged in)
function markSessionAlive() {
  sessionStorage.setItem(SESSION_FLAG, "1");
}

// ── Store ─────────────────────────────────────────────────────────────────────
interface AuthState {
  token: AuthToken | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: AuthToken) => void;
  setProfile: (profile: UserProfile) => void;
  logout: () => void;
  refreshSession: () => void;
}

const initialToken = resolveInitialToken();

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: initialToken,
  profile: null,
  isAuthenticated: !!initialToken,

  setAuth: (token) => {
    saveToken(token);
    markSessionAlive();
    set({ token, isAuthenticated: true });
  },

  setProfile: (profile) => set({ profile }),

  logout: () => {
    clearToken();
    sessionStorage.removeItem(SESSION_FLAG);
    set({ token: null, profile: null, isAuthenticated: false });
  },

  // Call this on any authenticated page load to keep session alive
  refreshSession: () => {
    if (get().token) markSessionAlive();
  },
}));

// Keep session flag alive on every page/tab visibility change
// (prevents expiry on tab switch if sessionStorage were ever reset)
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const { token, refreshSession } = useAuthStore.getState();
      if (token) refreshSession();
    }
  });
}