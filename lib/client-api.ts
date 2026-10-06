// Browser-side API helper. Pages call these functions; they hit Next.js
// route handlers (same origin), which in turn proxy to the backend.
// The backend base URL is never exposed to client code.

"use client";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  if (res.status === 401 && typeof window !== "undefined" && !path.includes("/api/me")) {
    // Plain fetch helper (no router access): replace so the expired session
    // isn't kept in history. Full navigation also guarantees the middleware
    // gate re-runs on the login page transition.
    if (window.location.pathname !== "/login") window.location.replace("/login");
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => req<T>(path);
const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
const patch = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
const del = <T>(path: string) => req<T>(path, { method: "DELETE" });

export type SessionInfo = {
  loggedIn: boolean;
  label: string | null;
  master: boolean;
  permissions: string[];
  warning: string | null;
};

export const client = {
  session: () => get<SessionInfo>("/api/me"),
  login: (key: string) => post<{ success: boolean; error?: string; warning?: string }>("/api/session", { key }),
  logout: () => post<{ success: boolean }>("/api/session", { logout: true }),
  status: () => get<import("./types").PublicStatus>("/api/status"),
  orionGet: <T>(backendPath: string) => get<T>(`/api/orion${backendPath}`),
  orionPost: <T>(backendPath: string, body?: unknown) => post<T>(`/api/orion${backendPath}`, body),
  orionPatch: <T>(backendPath: string, body?: unknown) => patch<T>(`/api/orion${backendPath}`, body),
  orionDelete: <T>(backendPath: string) => del<T>(`/api/orion${backendPath}`),
  keys: () => get<{ keys: import("./types").OperatorInfo[]; store: string }>("/api/operator-keys"),
  createKey: (body: { label: string; permissions: string[]; expiresDays: number }) =>
    post<{ key: string; keyId: string; warning: string }>("/api/operator-keys", body),
  updateKey: (body: { kid: string; label?: string; permissions?: string[] }) =>
    patch<{ success: boolean }>("/api/operator-keys", body),
  revokeKey: (keyId: string) => del<{ success: boolean }>(`/api/operator-keys?kid=${encodeURIComponent(keyId)}`),
  audit: (limit = 100) => get<{ events: import("./types").AuditEntry[]; source: string }>(`/api/audit?limit=${limit}`),
};
