import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiJson } from "../api/client";
import { setToken as persistToken, getToken } from "../lib/storage";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  index_number?: string | null;
  target_gpa?: number | null;
  target_attendance?: number;
  notify_deadlines?: boolean;
  deadline_reminder_days?: number;
};

type AuthCtx = {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTok] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      setTok(null);
      return;
    }
    try {
      const res = await apiJson<{ user: AuthUser | null }>("/me", { token: t });
      if (!res.user) {
        await persistToken(null);
        setTok(null);
        setUser(null);
        return;
      }
      setTok(t);
      setUser(res.user);
    } catch {
      await persistToken(null);
      setTok(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        if (t) await refreshUser();
        else setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<AuthUser & { token?: string; error?: string }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (res.error || !res.token) {
        setError(res.error || "Login failed");
        return;
      }
      await persistToken(res.token);
      setTok(res.token);
      const { token: _t, error: _e, ...pub } = res;
      setUser(pub as AuthUser);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiJson("/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      })) as AuthUser & { token?: string; error?: string };
      if (res.error || !res.token) {
        setError(res.error || "Registration failed");
        return;
      }
      await persistToken(res.token);
      setTok(res.token);
      const { token: _t, error: _e, ...pub } = res;
      setUser(pub as AuthUser);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await persistToken(null);
    setTok(null);
    setUser(null);
    try {
      await apiJson("/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      loading,
      error,
      login,
      register,
      logout,
      refreshUser,
      clearError: () => setError(null),
    }),
    [user, token, ready, loading, error, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
