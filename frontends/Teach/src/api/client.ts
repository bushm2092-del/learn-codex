const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
export const loginURL = `${base}/api/v1/auth/github`;
export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}/api/v1${path}`, {
    ...options, credentials: "include",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? "request_failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export type User = { id: number; login: string; avatar_url: string };
export type CheckIn = { chapter_id: string; created_at: string };
export type Comment = { id: number; user_id: number; body: string; created_at: string };
export type Ranking = { user_id: number; login: string; chapters: number; rank: number };
