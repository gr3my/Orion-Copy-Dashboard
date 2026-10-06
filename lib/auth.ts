import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { PERMISSIONS, type Permission } from "./types";
import { authStartupGuard } from "./security";

export const SESSION_COOKIE = "orion_session";
export const SESSION_SECONDS = 60 * 60 * 8;

export type Claims = {
  v: 1;
  kid: string;
  label: string;
  master: boolean;
  // Registry revision: bumped on revoke / permission / label changes.
  // Sessions carrying a stale rev are rejected, so revocation and permission
  // changes take effect immediately instead of at cookie expiry.
  rev: number;
  // Bootstrap fingerprint: SHA-256 of the admin key that minted a master
  // session. Rotating ORION_DASHBOARD_ADMIN_KEY changes the fingerprint, so
  // previously issued master cookies stop validating. Never the raw key.
  akf: string;
  permissions: string[];
  iat: number;
  exp: number;
};

export type StoredKey = {
  kid: string;
  label: string;
  keyHash: string;
  permissions: string[];
  rev: number;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

function secret(): string {
  return process.env.ORION_DASHBOARD_SESSION_SECRET || "";
}

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function unb64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function mac(payload: string): string {
  const s = secret();
  if (!s) throw new Error("ORION_DASHBOARD_SESSION_SECRET is not configured");
  return createHmac("sha256", s).update(`session.${payload}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function validClaims(v: unknown): v is Claims {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    c.v === 1 &&
    typeof c.kid === "string" &&
    typeof c.label === "string" &&
    typeof c.master === "boolean" &&
    typeof c.rev === "number" &&
    typeof c.akf === "string" &&
    Array.isArray(c.permissions) &&
    typeof c.iat === "number" &&
    typeof c.exp === "number"
  );
}

export function signClaims(claims: Claims): string {
  const payload = b64url(JSON.stringify(claims));
  return `${payload}.${mac(payload)}`;
}

export function verifySessionToken(token: string): Claims | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  let expected: string;
  try {
    expected = mac(payload);
  } catch {
    return null;
  }
  if (!safeEqual(sig, expected)) return null;
  try {
    const decoded: unknown = JSON.parse(unb64url(payload));
    if (!validClaims(decoded)) return null;
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function createSession(
  claims: Omit<Claims, "iat" | "exp" | "v" | "rev" | "akf"> & { rev?: number; akf?: string },
  ttl = SESSION_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  return signClaims({ v: 1, rev: 0, akf: "", ...claims, iat: now, exp: now + ttl });
}

// Stable fingerprint of the CURRENT bootstrap admin key. Compared (in
// constant time) against the fingerprint embedded in master sessions, so key
// rotation invalidates old master cookies. Null when unconfigured, which
// rejects every outstanding master session.
export function adminKeyFingerprint(): string | null {
  const adminKey = process.env.ORION_DASHBOARD_ADMIN_KEY || "";
  if (!adminKey) return null;
  return createHash("sha256").update(`admin-fingerprint.${adminKey}`).digest("base64url");
}

function registryPath(): string {
  return path.join(process.cwd(), ".data", "operator-keys.json");
}

function sanitizeRecord(raw: unknown): StoredKey | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kid !== "string" || typeof r.keyHash !== "string") return null;
  return {
    kid: r.kid,
    label: typeof r.label === "string" ? r.label : "Operator",
    keyHash: r.keyHash,
    permissions: Array.isArray(r.permissions) ? r.permissions.filter((p): p is string => typeof p === "string") : [],
    rev: typeof r.rev === "number" ? r.rev : 0,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
    revokedAt: typeof r.revokedAt === "string" ? r.revokedAt : null,
    lastUsedAt: typeof r.lastUsedAt === "string" ? r.lastUsedAt : null,
  };
}

async function readRegistryUnsafe(): Promise<StoredKey[]> {
  try {
    const raw = await fs.readFile(registryPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeRecord).filter((r): r is StoredKey => r !== null);
  } catch {
    return [];
  }
}

async function writeRegistryAtomic(keys: StoredKey[]): Promise<void> {
  await fs.mkdir(path.dirname(registryPath()), { recursive: true });
  const tmp = `${registryPath()}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(keys, null, 2), "utf8");
  await fs.rename(tmp, registryPath());
}

// Serializes all registry mutations so concurrent requests cannot interleave
// read-modify-write cycles and lose updates. Reads stay lock-free.
let writeQueue: Promise<void> = Promise.resolve();

function mutateRegistry<T>(mutator: (keys: StoredKey[]) => T | { result: T; write: boolean }): Promise<T> {
  const run = writeQueue.then(async () => {
    const keys = await readRegistryUnsafe();
    const out = mutator(keys);
    const result = typeof out === "object" && out !== null && "write" in (out as object) ? (out as { result: T; write: boolean }).result : (out as T);
    const shouldWrite = typeof out === "object" && out !== null && "write" in (out as object) ? (out as { result: T; write: boolean }).write : true;
    if (shouldWrite) await writeRegistryAtomic(keys);
    return result;
  });
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function normalizePermissions(perms: string[]): string[] {
  const allowed = new Set<string>(PERMISSIONS as readonly string[]);
  return [...new Set(perms.filter((p) => allowed.has(p)))];
}

function recordIsActive(record: StoredKey): boolean {
  if (record.revokedAt) return false;
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

// Strict session check: HMAC + expiry, then live validation. Master sessions
// must present the CURRENT admin-key fingerprint; scoped sessions must match
// a live registry record with equal revision. Anything else is rejected.
export async function readSessionStrict(token: string | undefined): Promise<Claims | null> {
  const claims = token ? verifySessionToken(token) : null;
  if (!claims) return null;
  if (claims.master) {
    const current = adminKeyFingerprint();
    if (!current || !safeEqual(claims.akf, current)) return null;
    return claims;
  }
  const keys = await readRegistryUnsafe();
  const record = keys.find((k) => k.kid === claims.kid);
  if (!record || !recordIsActive(record) || record.rev !== claims.rev) return null;
  // Refresh display label/permissions from the record so the UI reflects the
  // current registry state for the life of a valid revision.
  return { ...claims, label: record.label, permissions: record.permissions };
}

export async function getKeyRecord(kid: string): Promise<StoredKey | null> {
  const keys = await readRegistryUnsafe();
  return keys.find((k) => k.kid === kid) ?? null;
}

export async function authenticateKey(key: string): Promise<Claims | null> {
  const guard = authStartupGuard();
  if (guard.blocked) return null;

  const adminKey = process.env.ORION_DASHBOARD_ADMIN_KEY || "";
  if (adminKey && key.length === adminKey.length) {
    try {
      if (timingSafeEqual(Buffer.from(key), Buffer.from(adminKey))) {
        const now = Math.floor(Date.now() / 1000);
        return { v: 1, kid: "master", label: "Master", master: true, rev: 0, akf: adminKeyFingerprint() ?? "", permissions: ["*"], iat: now, exp: now + SESSION_SECONDS };
      }
    } catch {
      // Fall through to scoped-key lookup.
    }
  }
  const digest = hashKey(key);
  const matched = await mutateRegistry((keys) => {
    const found = keys.find((k) => k.keyHash.length === digest.length && timingSafeEqual(Buffer.from(k.keyHash), Buffer.from(digest)));
    if (!found || !recordIsActive(found)) return { result: null as StoredKey | null, write: false };
    found.lastUsedAt = new Date().toISOString();
    return { result: { ...found }, write: true };
  });
  if (!matched) return null;
  const now = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    kid: matched.kid,
    label: matched.label,
    master: false,
    rev: matched.rev,
    akf: "",
    permissions: matched.permissions,
    iat: now,
    exp: now + SESSION_SECONDS,
  };
}

export async function issueOperatorKey(opts: {
  label: string;
  permissions: string[];
  expiresDays: number;
}): Promise<{ key: string; record: StoredKey }> {
  const raw = `orion_${randomBytes(24).toString("hex")}`;
  const days = Math.max(1, Math.min(90, Math.trunc(opts.expiresDays || 30)));
  const record: StoredKey = {
    kid: randomBytes(8).toString("hex"),
    label: opts.label.trim().slice(0, 80) || "Operator",
    keyHash: hashKey(raw),
    permissions: normalizePermissions(opts.permissions),
    rev: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + days * 86400_000).toISOString(),
    revokedAt: null,
    lastUsedAt: null,
  };
  await mutateRegistry((keys) => {
    keys.push(record);
    return { result: true, write: true };
  });
  return { key: raw, record };
}

export async function listOperatorKeys(): Promise<StoredKey[]> {
  return readRegistryUnsafe();
}

export async function revokeOperatorKey(kid: string): Promise<boolean> {
  return mutateRegistry((keys) => {
    const found = keys.find((k) => k.kid === kid);
    if (!found || found.revokedAt) return { result: false, write: false };
    found.revokedAt = new Date().toISOString();
    found.rev += 1;
    return { result: true, write: true };
  });
}

export async function updateOperatorKey(
  kid: string,
  opts: { label?: string; permissions?: string[] }
): Promise<StoredKey | null> {
  return mutateRegistry((keys) => {
    const found = keys.find((k) => k.kid === kid);
    if (!found || found.revokedAt) return { result: null as StoredKey | null, write: false };
    if (typeof opts.label === "string" && opts.label.trim()) found.label = opts.label.trim().slice(0, 80);
    if (Array.isArray(opts.permissions)) found.permissions = normalizePermissions(opts.permissions);
    // Any mutation invalidates outstanding sessions for this key.
    found.rev += 1;
    return { result: { ...found }, write: true };
  });
}

export function hasPermission(claims: Claims | null, permission: string): boolean {
  if (!claims) return false;
  if (claims.master) return true;
  return claims.permissions.includes("*") || claims.permissions.includes(permission);
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookieHeader(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export type { Permission };
