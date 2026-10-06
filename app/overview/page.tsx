"use client";

import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockAllocator, mockMatches, mockOverview, mockServers, MOCK_BANNER } from "../../lib/mock";
import type { OverviewSummary } from "../../lib/types";
import { formatNumber } from "../../lib/format";
import { BarRow } from "../../components/charts";
import { Gate } from "../../components/gate";
import { ErrorBox, LoadingRows, MockBanner, PageHeader, StatCard, StatusPill, UnsupportedBox } from "../../components/ui";

export default function OverviewPage() {
  return (
    <Gate perm="overview.read">
      <OverviewBody />
    </Gate>
  );
}

function OverviewBody() {
  const { can } = useSession();
  const state = useOrion<OverviewSummary>("/v1/overview", can("overview.read"));

  if (state.status === "loading") {
    return (
      <>
        <PageHeader eyebrow="Operator" title="Overview" />
        <LoadingRows />
      </>
    );
  }

  if (state.status === "unavailable") {
    const mock = state.message.includes("Mock mode") || state.message.includes("mock");
    if (mock) return <MockOverview />;
    return (
      <>
        <PageHeader eyebrow="Operator" title="Overview" sub="Live backend summary" />
        <ErrorBox message={state.message} />
        <UnsupportedBox endpoint="GET /v1/overview" />
      </>
    );
  }

  const s = state.data;
  return (
    <>
      <PageHeader eyebrow="Operator" title="Overview" sub={s.backendReachable ? `Backend reachable${s.backendLatencyMs != null ? ` · ${s.backendLatencyMs} ms` : ""}` : "Backend unreachable"} />
      {!s.backendReachable && <ErrorBox message="Backend is unreachable. Check ORION_API_URL and the server logs." />}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Players online" value={formatNumber(s.playersOnline)} />
        <StatCard label="Active matches" value={formatNumber(s.activeMatches)} />
        <StatCard label="Active servers" value={formatNumber(s.activeServers)} />
        <StatCard label="Unhealthy servers" value={formatNumber(s.unhealthyServers)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="card px-5 py-4">
          <p className="text-sm font-medium mb-3">Capacity</p>
          <BarRow label="Players vs capacity" used={s.playersOnline} total={Math.max(s.totalCapacity, 1)} />
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>Total capacity {formatNumber(s.totalCapacity)}</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-sm font-medium mb-3">Build</p>
          <p className="font-mono text-sm">{s.buildVersion ?? "unknown"}</p>
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>Reported by the connected backend.</p>
        </div>
      </div>
    </>
  );
}

function MockOverview() {
  const s = mockOverview();
  const servers = mockServers();
  const matches = mockMatches();
  const alloc = mockAllocator();
  return (
    <>
      <PageHeader eyebrow="Operator" title="Overview" sub={MOCK_BANNER} />
      <MockBanner />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Players online" value={formatNumber(s.playersOnline)} />
        <StatCard label="Active matches" value={formatNumber(s.activeMatches)} />
        <StatCard label="Active servers" value={formatNumber(s.activeServers)} />
        <StatCard label="Unhealthy servers" value={formatNumber(s.unhealthyServers)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="card px-5 py-4">
          <p className="text-sm font-medium mb-3">Capacity</p>
          <BarRow label="Players vs capacity" used={alloc.allocated} total={alloc.totalCapacity} />
        </div>
        <div className="card px-5 py-4">
          <p className="text-sm font-medium mb-3">Servers</p>
          {servers.map((sv) => (
            <div key={sv.serverId} className="flex items-center gap-2 py-1.5 text-sm">
              <StatusPill state={sv.healthy && sv.status === "online"} />
              <span className="flex-1 truncate">{sv.label}</span>
              <span className="tabular" style={{ color: "var(--muted)" }}>{sv.playerCount}/{sv.capacity}</span>
            </div>
          ))}
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>{matches.length} mock matches active.</p>
        </div>
      </div>
    </>
  );
}

