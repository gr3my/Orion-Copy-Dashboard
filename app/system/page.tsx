"use client";

import { RefreshCw } from "lucide-react";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, PageHeader, StatusPill, UnsupportedBox } from "../../components/ui";

type SystemInfo = {
  dashboardVersion: string;
  backendVersion: string | null;
  gameVersion: string | null;
  uptimeSeconds: number | null;
  environment: string | null;
  backendReachable: boolean;
  apiHealth: string | null;
  services: { name: string; state: string }[];
};

export default function SystemPage() {
  return (
    <Gate perm="system.read">
      <SystemBody />
    </Gate>
  );
}

function SystemBody() {
  const { can } = useSession();
  const state = useOrion<SystemInfo>("/v1/system", can("system.read"));

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="System"
        sub="Dashboard and backend identity, connectivity, and service state"
        aside={<button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh system info"><RefreshCw size={15} /></button>}
      />
      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/system" />
          <div className="card px-5 py-4 mt-3">
            <p className="text-sm font-medium mb-2">Dashboard</p>
            <dl className="text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <dt style={{ color: "var(--muted)" }}>Version</dt><dd className="font-mono">0.1.0</dd>
              <dt style={{ color: "var(--muted)" }}>Environment</dt><dd className="font-mono">{process.env.NODE_ENV}</dd>
            </dl>
          </div>
        </>
      ) : state.data ? (
        <>
          <div className="card px-5 py-4 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <StatusPill state={state.data.backendReachable} />
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {state.data.backendReachable ? "Backend reachable" : "Backend unreachable"}
                {state.data.apiHealth && ` · ${state.data.apiHealth}`}
              </span>
            </div>
            <dl className="text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <dt style={{ color: "var(--muted)" }}>Dashboard version</dt><dd className="font-mono">{state.data.dashboardVersion}</dd>
              <dt style={{ color: "var(--muted)" }}>Backend version</dt><dd className="font-mono">{state.data.backendVersion ?? "—"}</dd>
              <dt style={{ color: "var(--muted)" }}>Game version</dt><dd className="font-mono">{state.data.gameVersion ?? "—"}</dd>
              <dt style={{ color: "var(--muted)" }}>Environment</dt><dd className="font-mono">{state.data.environment ?? "—"}</dd>
            </dl>
          </div>
          {state.data.services.length > 0 && (
            <div className="card px-5 py-4">
              <p className="text-sm font-medium mb-3">Services</p>
              {state.data.services.map((s) => (
                <div key={s.name} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="flex-1 font-mono text-[13px]">{s.name}</span>
                  <span className="pill">{s.state}</span>
                </div>
              ))}
            </div>
          )}
          {state.data.services.length === 0 && (
            <div className="card"><EmptyState>No dependent services reported.</EmptyState></div>
          )}
        </>
      ) : null}
    </>
  );
}
