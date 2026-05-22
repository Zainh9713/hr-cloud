import { create } from "zustand";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        throw new Error("Not logged in");
      }
      const data = await res.json();
      set({ user: data.user, isAuthenticated: true, loading: false });
    } catch (err: any) {
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      set({ user: data.user, isAuthenticated: true, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      set({ user: data.user, isAuthenticated: true, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Ignored
    } finally {
      set({ user: null, isAuthenticated: false, loading: false, error: null });
    }
  }
}));
