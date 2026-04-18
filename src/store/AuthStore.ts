// src/store/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthToken, UserProfile } from "@/services/api";
import { saveToken, clearToken, loadToken } from "@/services/api";

interface AuthState {
  token: AuthToken | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: AuthToken) => void;
  setProfile: (profile: UserProfile) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: loadToken(),
      profile: null,
      isAuthenticated: !!loadToken(),

      setAuth: (token) => {
        saveToken(token);
        set({ token, isAuthenticated: true });
      },

      setProfile: (profile) => set({ profile }),

      logout: () => {
        clearToken();
        set({ token: null, profile: null, isAuthenticated: false });
      },
    }),
    {
      name: "weave-auth",
      partialize: (state) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);