import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "./api";
import type { SessionUser } from "./types";

interface SessionCtx {
  user: SessionUser | null;
  ready: boolean;
  refresh: () => void;
  setUser: (u: SessionUser | null) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setUser(api.getSessionUser());
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, refresh, setUser, signOut }),
    [user, ready, refresh, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Whether a role may enter a given area. Mirrors server-side checks in api.ts. */
export function areaAccess(role: SessionUser["role"] | undefined, area: "portal" | "departments" | "management" | "admin"): boolean {
  if (!role) return false;
  switch (area) {
    case "portal":
      return true;
    case "departments":
      return ["SUPER_ADMIN", "DEPT_HEAD", "DEPT_MEMBER"].includes(role);
    case "management":
      return ["SUPER_ADMIN", "MANAGEMENT"].includes(role);
    case "admin":
      return role === "SUPER_ADMIN";
  }
}
