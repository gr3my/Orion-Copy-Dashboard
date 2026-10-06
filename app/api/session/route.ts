import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authenticateKey,
  clearCookieHeader,
  createSession,
  readSessionStrict,
  sessionCookieHeader,
} from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import {
  authStartupGuard,
  clientIp,
  createRateLimiter,
  isSecureRequest,
  sameOrigin,
} from "@/lib/security";

const loginLimiter = createRateLimiter({ windowMs: 60_000, max: 10, maxKeys: 2000 });

export async function POST(req: NextRequest) {
  const guard = authStartupGuard();
  if (guard.blocked) {
    return NextResponse.json({ success: false, error: guard.error }, { status: 503 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ success: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { key?: string; logout?: boolean } | null;

  if (body?.logout) {
    const prior = await readSessionStrict(req.cookies.get(SESSION_COOKIE)?.value);
    const res = NextResponse.json({ success: true });
    res.headers.set("Set-Cookie", clearCookieHeader(isSecureRequest(req)));
    if (prior) {
      await recordAuditEvent({ action: "session.logout", actor: prior.kid, target: null, status: 200 }).catch(() => undefined);
    }
    return res;
  }

  const ip = clientIp(req);
  if (loginLimiter.limited(`login:${ip}`)) {
    return NextResponse.json({ success: false, error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  }

  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) return NextResponse.json({ success: false, error: "Operator key is required." }, { status: 400 });

  const claims = await authenticateKey(key);
  if (!claims) {
    await recordAuditEvent({
      action: "session.login",
      actor: "unknown",
      target: null,
      status: 401,
      meta: { result: "failed", ip },
    }).catch(() => undefined);
    return NextResponse.json({ success: false, error: "That key didn't work. Check it and try again." }, { status: 401 });
  }
  const token = createSession({ kid: claims.kid, label: claims.label, master: claims.master, rev: claims.rev, akf: claims.akf, permissions: claims.permissions });
  await recordAuditEvent({
    action: "session.login",
    actor: claims.kid,
    target: null,
    status: 200,
    meta: { result: "success", master: claims.master, ip },
  }).catch(() => undefined);
  const res = NextResponse.json({ success: true, ...(guard.devWarning ? { warning: guard.devWarning } : {}) });
  res.headers.set("Set-Cookie", sessionCookieHeader(token, isSecureRequest(req)));
  return res;
}

export async function DELETE(req: NextRequest) {
  const prior = await readSessionStrict(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ success: true });
  res.headers.set("Set-Cookie", clearCookieHeader(isSecureRequest(req)));
  if (prior) {
    await recordAuditEvent({ action: "session.logout", actor: prior.kid, target: null, status: 200 }).catch(() => undefined);
  }
  return res;
}

export { SESSION_COOKIE };
