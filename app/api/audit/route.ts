import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, hasPermission, readSessionStrict } from "@/lib/auth";
import { readLocalAudit } from "@/lib/audit";
import { backend, isMock } from "@/lib/orion-api";
import { mockAudit } from "@/lib/mock";
import type { AuditEntry } from "@/lib/types";

// Merges the dashboard's own security-event trail (local, newest first) with
// the backend trail when available. Local events carry origin "dashboard".
export async function GET(req: NextRequest) {
  const claims = await readSessionStrict(req.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!hasPermission(claims, "audit.read")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get("limit") || 100)));
  const local = await readLocalAudit(limit);

  if (isMock()) {
    return NextResponse.json({ events: [...local, ...mockAudit()], source: "mock+dashboard" });
  }

  const res = await backend.get<{ events?: unknown }>(`/v1/audit?limit=${limit}`);
  if (!res.ok) {
    return NextResponse.json({ events: local, source: local.length > 0 ? "dashboard" : "unsupported", error: res.error }, { status: 200 });
  }
  const backendEvents = Array.isArray((res.data as { events?: unknown }).events)
    ? (res.data as { events: AuditEntry[] }).events.map((e) => ({ ...e, origin: "backend" }))
    : [];
  return NextResponse.json({ events: [...local, ...backendEvents].slice(0, limit), source: "backend+dashboard" });
}
