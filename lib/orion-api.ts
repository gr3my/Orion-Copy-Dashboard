// Server-side backend client. All requests to the game/control backend go
// through here so the browser never sees internal URLs or credentials.
// See docs/API.md for the expected endpoint contract.

import "server-only";

import { serverConfig } from "./config";

export type BackendResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function baseUrl(): string {
  return serverConfig().apiUrl;
}

export function isMock(): boolean {
  return serverConfig().mock;
}

async function request<T>(method: string, backendPath: string, body?: unknown, timeoutMs = 8000): Promise<BackendResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl()}${backendPath}`, {
      method,
      headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 300) || `Backend responded ${res.status}` };
    }
    const data = (await res.json().catch(() => null)) as T;
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "Backend timed out" : "Backend unreachable";
    return { ok: false, status: 502, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export const backend = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

// Allowlist of backend paths the dashboard proxy will forward, with the
// dashboard permission required for each. Anything not listed is rejected
// with 404 so internal backend routes are never exposed by accident.
export type ProxyRule = { method: string; pattern: RegExp; permission: string };

export const PROXY_RULES: ProxyRule[] = [
  { method: "GET", pattern: /^\/status$/, permission: "overview.read" },
  { method: "GET", pattern: /^\/health$/, permission: "overview.read" },
  { method: "GET", pattern: /^\/v1\/overview$/, permission: "overview.read" },
  { method: "GET", pattern: /^\/v1\/players(\?.*)?$/, permission: "players.read" },
  { method: "GET", pattern: /^\/v1\/players\/[^/]+$/, permission: "players.read" },
  { method: "POST", pattern: /^\/v1\/players\/[^/]+\/moderate$/, permission: "players.moderate" },
  { method: "GET", pattern: /^\/v1\/servers(\?.*)?$/, permission: "servers.read" },
  { method: "GET", pattern: /^\/v1\/servers\/[^/]+$/, permission: "servers.read" },
  { method: "POST", pattern: /^\/v1\/servers\/[^/]+\/(drain|restart|stop|remove)$/, permission: "servers.control" },
  { method: "GET", pattern: /^\/v1\/stations(\?.*)?$/, permission: "overview.read" },
  { method: "GET", pattern: /^\/v1\/matches(\?.*)?$/, permission: "matches.read" },
  { method: "GET", pattern: /^\/v1\/allocator$/, permission: "allocator.read" },
  { method: "PATCH", pattern: /^\/v1\/allocator$/, permission: "allocator.write" },
  { method: "GET", pattern: /^\/v1\/moderation(\?.*)?$/, permission: "players.moderate" },
  { method: "POST", pattern: /^\/v1\/moderation$/, permission: "players.moderate" },
  { method: "POST", pattern: /^\/v1\/moderation\/[^/]+\/revoke$/, permission: "players.moderate" },
  { method: "GET", pattern: /^\/v1\/announcements(\?.*)?$/, permission: "announcements.read" },
  { method: "POST", pattern: /^\/v1\/announcements$/, permission: "announcements.write" },
  { method: "PATCH", pattern: /^\/v1\/announcements\/[^/]+$/, permission: "announcements.write" },
  { method: "DELETE", pattern: /^\/v1\/announcements\/[^/]+$/, permission: "announcements.write" },
  { method: "GET", pattern: /^\/v1\/config$/, permission: "config.read" },
  { method: "PATCH", pattern: /^\/v1\/config$/, permission: "config.write" },
  { method: "GET", pattern: /^\/v1\/metrics(\?.*)?$/, permission: "overview.read" },
  { method: "GET", pattern: /^\/v1\/logs(\?.*)?$/, permission: "logs.read" },
  { method: "GET", pattern: /^\/v1\/audit(\?.*)?$/, permission: "audit.read" },
  { method: "GET", pattern: /^\/v1\/system$/, permission: "system.read" },
];

export function findRule(method: string, path: string): ProxyRule | null {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return PROXY_RULES.find((r) => r.method === method.toUpperCase() && r.pattern.test(normalized)) ?? null;
}
