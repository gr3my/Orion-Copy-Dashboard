import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/config";
import { backend, isMock } from "@/lib/orion-api";
import { mockPublicStatus } from "@/lib/mock";
import type { PublicStatus } from "@/lib/types";

// Public, unauthenticated status snapshot. Exposes only aggregate counts and
// enabled announcements — never player identities, IPs, keys, or logs.
export async function GET() {
  const cfg = serverConfig();
  if (!cfg.publicStatusEnabled) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
  if (isMock()) {
    return NextResponse.json({ ...mockPublicStatus(), enabled: true });
  }
  const started = Date.now();
  const res = await backend.get<Record<string, unknown>>("/status");
  const alt = res.ok ? null : await backend.get<Record<string, unknown>>("/health");
  const data = (res.ok ? res.data : alt && alt.ok ? alt.data : null) as Record<string, unknown> | null;
  if (!data) {
    const status: PublicStatus = {
      enabled: true,
      reachable: false,
      playersOnline: 0,
      activeServers: 0,
      healthyServers: 0,
      activeMatches: 0,
      buildVersion: null,
      capacityUsed: 0,
      capacityTotal: 0,
      maintenance: false,
      announcements: [],
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json({ ...status, latencyMs: Date.now() - started });
  }
  const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const status: PublicStatus = {
    enabled: true,
    reachable: true,
    playersOnline: num(data.playersOnline ?? data.players_online),
    activeServers: num(data.activeServers ?? data.active_servers),
    healthyServers: num(data.healthyServers ?? data.healthy_servers),
    activeMatches: num(data.activeMatches ?? data.active_matches),
    buildVersion: typeof data.buildVersion === "string" ? data.buildVersion : typeof data.version === "string" ? data.version : null,
    capacityUsed: num(data.capacityUsed ?? data.capacity_used),
    capacityTotal: num(data.capacityTotal ?? data.capacity_total),
    maintenance: data.maintenance === true,
    announcements: Array.isArray(data.announcements)
      ? (data.announcements as { id?: unknown; title?: unknown; body?: unknown }[])
          .filter((a) => typeof a.title === "string")
          .map((a) => ({ id: String(a.id ?? a.title), title: String(a.title), body: typeof a.body === "string" ? a.body : "" }))
      : [],
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json({ ...status, latencyMs: Date.now() - started });
}
