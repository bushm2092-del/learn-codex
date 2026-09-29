import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type User } from "../api/client";
import { AuthContext } from "./context";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setStatus("loading");
    try { const data = await api<User>("/me"); if (current === generation.current) { setUser(data); setStatus("ready"); } }
    catch (error) { if (current !== generation.current) return; setUser(null); setStatus(error instanceof ApiError && error.status === 401 ? "ready" : "error"); }
  }, []);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  return <AuthContext.Provider value={{ user, status, refresh }}>{children}</AuthContext.Provider>;
}
