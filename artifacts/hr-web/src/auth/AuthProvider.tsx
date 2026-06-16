import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe, login as apiLogin, logout as apiLogout } from "../api/auth";
import type { Actor } from "../api/schemas";
import { clearToken, getToken, setToken } from "../lib/token";
import { setUnauthorizedHandler } from "../lib/api-client";

type AuthState = {
  actor: Actor | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [actor, setActor] = useState<Actor | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  const resetSession = useCallback(() => {
    clearToken();
    setActor(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  // Wire the 401 interceptor to drop the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setActor(null);
      setStatus("anonymous");
      queryClient.clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  // On mount, if a token exists, resolve the current actor.
  useEffect(() => {
    let cancelled = false;
    if (!getToken()) {
      setStatus("anonymous");
      return;
    }
    fetchMe()
      .then((a) => {
        if (cancelled) return;
        setActor(a);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        setActor(null);
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.token);
    const a = await fetchMe();
    setActor(a);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* best-effort; clear locally regardless */
    }
    resetSession();
  }, [resetSession]);

  const value = useMemo<AuthState>(
    () => ({
      actor,
      status,
      login,
      logout,
      isAdmin: actor?.role === "admin" || actor?.role === "super_admin",
    }),
    [actor, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
