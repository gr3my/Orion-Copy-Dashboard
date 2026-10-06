import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  hasPermission,
  issueOperatorKey,
  listOperatorKeys,
  readSessionStrict,
  revokeOperatorKey,
  updateOperatorKey,
} from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { sameOrigin } from "@/lib/security";
import type { Claims } from "@/lib/auth";

async function session(req: NextRequest): Promise<Claims | null> {
  return readSessionStrict(req.cookies.get(SESSION_COOKIE)?.value);
}

function preview(kid: string): string {
  return `kid_${kid.slice(0, 8)}…`;
}

function canRead(claims: Claims): boolean {
  return hasPermission(claims, "apikeys.read") || hasPermission(claims, "operators.read");
}

function canWrite(claims: Claims): boolean {
  return hasPermission(claims, "apikeys.write") || hasPermission(claims, "operators.write");
}

export async function GET(req: NextRequest) {
  const claims = await session(req);
  if (!claims) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canRead(claims)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const keys = await listOperatorKeys();
  return NextResponse.json({
    store: "local-hashed-registry",
    keys: keys.map((k) => ({
      keyId: k.kid,
      label: k.label,
      permissions: k.permissions,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      revoked: k.revokedAt != null,
      preview: preview(k.kid),
    })),
  });
}

export async function POST(req: NextRequest) {
  const claims = await session(req);
  if (!claims) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canWrite(claims)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    label?: string;
    permissions?: string[];
    expiresDays?: number;
  } | null;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "Label is required." }, { status: 400 });
  const { key, record } = await issueOperatorKey({
    label,
    permissions: Array.isArray(body?.permissions) ? body.permissions : [],
    expiresDays: typeof body?.expiresDays === "number" ? body.expiresDays : 30,
  });
  await recordAuditEvent({
    action: "operator-key.create",
    actor: claims.kid,
    target: record.kid,
    status: 200,
    meta: { label: record.label, permissions: record.permissions },
  }).catch(() => undefined);
  return NextResponse.json({
    key,
    keyId: record.kid,
    warning: "Copy this key now. It is shown only once and stored only as a hash.",
  });
}

export async function PATCH(req: NextRequest) {
  const claims = await session(req);
  if (!claims) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canWrite(claims)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    kid?: string;
    label?: string;
    permissions?: string[];
  } | null;
  const kid = typeof body?.kid === "string" ? body.kid.trim() : "";
  if (!kid) return NextResponse.json({ error: "kid is required." }, { status: 400 });
  const updated = await updateOperatorKey(kid, { label: body?.label, permissions: body?.permissions });
  if (!updated) return NextResponse.json({ error: "Key not found or revoked." }, { status: 404 });
  await recordAuditEvent({
    action: "operator-key.update",
    actor: claims.kid,
    target: kid,
    status: 200,
    meta: { label: updated.label, permissions: updated.permissions },
  }).catch(() => undefined);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const claims = await session(req);
  if (!claims) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canWrite(claims)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const kid = req.nextUrl.searchParams.get("kid") || "";
  if (!kid) return NextResponse.json({ error: "kid is required." }, { status: 400 });
  if (kid === claims.kid) {
    return NextResponse.json({ error: "You cannot revoke the key you are signed in with." }, { status: 400 });
  }
  const ok = await revokeOperatorKey(kid);
  if (!ok) return NextResponse.json({ error: "Key not found or already revoked." }, { status: 404 });
  await recordAuditEvent({ action: "operator-key.revoke", actor: claims.kid, target: kid, status: 200 }).catch(() => undefined);
  return NextResponse.json({ success: true });
}
