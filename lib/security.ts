// Shared server-side security helpers: secret validation, client-IP
// resolution, same-origin checks, a bounded rate limiter, and credential
// redaction. Single source of truth so every route behaves consistently.

import "server-only";

import type { NextRequest } from "next/server";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// ── Secret validation ────────────────────────────────────────────────────
// Minimums: session secret >= 32 chars (use `openssl rand -hex 32` → 64),
// admin key >= 20 chars of real entropy.

const PLACEHOLDERS = new Set(
  [
    "",
    "change_me",
    "changeme",
    "replace_me",
    "replace-me",
    "your_secret",
    "your_api_key",
    "your_admin_key",
    "secret",
    "password",
    "admin",
    "test",
    "example",
    "placeholder",
  ].map((s) => s.toLowerCase())
);

export function isPlaceholderSecret(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (PLACEHOLDERS.has(v.toLowerCase())) return true;
  // Catch CHANGE_ME-ish variants regardless of separators/case.
  const squashed = v.toLowerCase().replace(/[^a-z]/g, "");
  if (squashed === "changeme" || squashed === "replacewithsecret" || squashed.startsWith("yourexample")) return true;
  return false;
}

export type SecretCheck = { ok: true } | { ok: false; error: string };

export function validateSecret(name: string, value: string, minLength: number): SecretCheck {
  if (isPlaceholderSecret(value)) {
    return {
      ok: false,
      error: `${name} is missing or still a placeholder. Generate a real value (see .env.example) and restart.`,
    };
  }
  if (value.trim().length < minLength) {
    return {
      ok: false,
      error: `${name} is too short (${value.trim().length} chars, minimum ${minLength}). Generate a longer random value and restart.`,
    };
  }
  return { ok: true };
}

// Hard gate for production; warning-only in development so local UI work
// with throwaway secrets is still possible (warned loudly in the response).
export function authStartupGuard(): { blocked: boolean; error?: string; devWarning?: string } {
  const sessionSecret = process.env.ORION_DASHBOARD_SESSION_SECRET || "";
  const adminKey = process.env.ORION_DASHBOARD_ADMIN_KEY || "";
  const sessionCheck = validateSecret("ORION_DASHBOARD_SESSION_SECRET", sessionSecret, 32);
  const adminCheck = validateSecret("ORION_DASHBOARD_ADMIN_KEY", adminKey, 20);
  const failed = !sessionCheck.ok ? sessionCheck : !adminCheck.ok ? adminCheck : null;
  if (!failed) return { blocked: false };
  if (isProduction()) return { blocked: true, error: failed.error };
  return { blocked: false, devWarning: `DEV ONLY — insecure credentials: ${failed.error}` };
}

// ── Client IP ────────────────────────────────────────────────────────────
// Proxy headers are untrusted by default. Set ORION_TRUST_PROXY_HEADERS=true
// only when a reverse proxy strips client-supplied forwarding headers
// (documented in README).
//
// Honesty note: this runtime does not expose a reliable direct peer IP, so
// when proxy headers are untrusted every direct client shares ONE fallback
// bucket. That keeps global brute-force protection (shared budget) without
// pretending per-IP precision exists. Accurate per-client limiting requires
// a trusted reverse proxy that supplies forwarding headers.

export const DIRECT_CLIENT_BUCKET = "direct:unidentified";

export function trustProxyHeaders(): boolean {
  return (process.env.ORION_TRUST_PROXY_HEADERS ?? "false") === "true";
}

export function clientIp(req: NextRequest): string {
  if (trustProxyHeaders()) {
    const forwarded = (
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    )?.slice(0, 64);
    if (forwarded) return `proxy:${forwarded}`;
  }
  return DIRECT_CLIENT_BUCKET;
}

// ── Same-origin (CSRF) ───────────────────────────────────────────────────

export function sameOrigin(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) return true;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host")?.split(",")[0]?.trim().toLowerCase();
  if (!origin || !host) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  // Compare against the Host header, not req.nextUrl: Next may normalize
  // nextUrl to the listen address (e.g. localhost) while Host preserves what
  // the browser actually addressed.
  if (parsed.host.toLowerCase() !== host) return false;
  const requestProto = (
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(/:$/, "")
  ).toLowerCase();
  if (requestProto === "https" && parsed.protocol !== "https:") return false;
  return true;
}

export function isSecureRequest(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:" || isProduction();
}

// ── Bounded rate limiter ─────────────────────────────────────────────────
// Fixed window per key. The hard cap is enforced AT INSERTION TIME, never
// only during a periodic sweep: when full, expired entries are dropped
// first, then the oldest buckets (Map preserves insertion order, so the
// first key is the oldest). Size can never exceed maxKeys, even under a
// burst of unique keys.

export type RateLimiter = {
  limited: (key: string) => boolean;
  size: () => number;
};

export function createRateLimiter(opts: { windowMs: number; max: number; maxKeys: number }): RateLimiter {
  const hits = new Map<string, { count: number; reset: number }>();

  function makeRoom(now: number) {
    if (hits.size < opts.maxKeys) return;
    for (const [k, v] of hits) {
      if (v.reset <= now) hits.delete(k);
      if (hits.size < opts.maxKeys) return;
    }
    while (hits.size >= opts.maxKeys) {
      const oldest = hits.keys().next();
      if (oldest.done) return;
      hits.delete(oldest.value);
    }
  }

  return {
    limited(key: string) {
      const now = Date.now();
      const entry = hits.get(key);
      if (entry && entry.reset > now) {
        entry.count += 1;
        return entry.count > opts.max;
      }
      if (entry) hits.delete(key); // expired: drop before re-inserting
      makeRoom(now);
      hits.set(key, { count: 1, reset: now + opts.windowMs });
      return false;
    },
    size: () => hits.size,
  };
}

// ── Credential redaction ─────────────────────────────────────────────────
// Defense in depth: applied server-side BEFORE anything reaches the browser.

const SECRET_VALUE = "[redacted]";

const AUTHORIZATION_PATTERN =
  /authorization\s*:\s*(?:bearer|basic)\s+[A-Za-z0-9\-._~+/=]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const ASSIGNMENT_PATTERN =
  /((?:api[_-]?key|client[_-]?secret|session[_-]?secret|admin[_-]?key|password|passwd|pwd|bearer|token|secret|access[_-]?token|refresh[_-]?token|auth[_-]?token)\s*[:=]\s*)(["']?)[^\s"'&,;]+(["']?)/gi;
const QUERY_PARAM_PATTERN = /([?&](?:token|api[_-]?key|key|secret)\s*=\s*)[^&\s"'&,;]+/gi;

export function redactSecretsText(message: string): string {
  // String (not callback) replacements: avoids confusing capture groups with
  // the offset/source trailing arguments String.replace appends.
  let out = message;
  out = out.replace(AUTHORIZATION_PATTERN, `authorization: ${SECRET_VALUE}`);
  out = out.replace(JWT_PATTERN, SECRET_VALUE);
  out = out.replace(ASSIGNMENT_PATTERN, `$1$2${SECRET_VALUE}$3`);
  out = out.replace(QUERY_PARAM_PATTERN, `$1${SECRET_VALUE}`);
  return out;
}

const SENSITIVE_FIELD = /key|secret|token|password|passwd|credential|authorization|bearer|cookie|session/i;
export function redactSecretsDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value === "string") return redactSecretsText(value);
  if (Array.isArray(value)) return value.map((v) => redactSecretsDeep(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_FIELD.test(k) ? SECRET_VALUE : redactSecretsDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

// ── Fallback sensitive key-name detector ─────────────────────────────────
// Used when serializing config for browsers: regardless of backend metadata,
// names that strongly indicate credentials are treated as sensitive. Bare
// "key" alone is deliberately NOT matched (turkey/keyboard/monkey…).

const SECRET_NAME_PATTERN =
  /password|passwd|secret|tokens?|private[_-]?key|client[_-]?secret|session[_-]?secret|admin[_-]?key|server[_-]?key|signing[_-]?key|bearer|api[_-]?key/i;

export function looksLikeSecretKey(name: string): boolean {
  return SECRET_NAME_PATTERN.test(name);
}

export function isConfiguredValue(value: unknown): boolean {
  return typeof value === "string" ? value.length > 0 : value !== null && value !== undefined;
}
