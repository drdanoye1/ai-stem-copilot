"use client";
import { create } from "zustand";
import { authApi, type User } from "@/lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitializing: true,

  setAuth: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("math_copilot_token", token);
      localStorage.setItem("math_copilot_user", JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true, isInitializing: false });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("math_copilot_token");
      localStorage.removeItem("math_copilot_user");
    }
    set({ token: null, user: null, isAuthenticated: false, isInitializing: false });
  },

  fetchMe: async () => {
    if (typeof window === "undefined") {
      set({ isInitializing: false });
      return;
    }
    const token = localStorage.getItem("math_copilot_token");
    if (!token) {
      set({ isInitializing: false });
      return;
    }
    try {
      const { data } = await authApi.me();
      set({ user: data, token, isAuthenticated: true, isInitializing: false });
    } catch {
      localStorage.removeItem("math_copilot_token");
      localStorage.removeItem("math_copilot_user");
      set({ user: null, token: null, isAuthenticated: false, isInitializing: false });
    }
  },
}));
