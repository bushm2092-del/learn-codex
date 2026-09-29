import { createContext, useContext } from "react";
import type { User } from "../api/client";
export const AuthContext = createContext<{ user: User | null; status: "loading" | "ready" | "error"; refresh: () => Promise<void> } | null>(null);
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("AuthProvider required"); return context; }
