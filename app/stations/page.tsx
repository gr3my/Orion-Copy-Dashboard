"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockStations, MOCK_BANNER } from "../../lib/mock";
import type { StationLobby } from "../../lib/types";
import { formatDate } from "../../lib/format";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, StatusPill, UnsupportedBox } from "../../components/ui";

export default function StationsPage() {
  return (
    <Gate perm="overview.read">
      <StationsBody />
    </Gate>
  );
}

function StationsBody() {
  const { can } = useSession();
  const [onlineOnly, setOnlineOnly] = useState(false);
  const state = useOrion<StationLobby[]>("/v1/stations", can("overview.read"));

  const list = state.status === "ready" ? state.data : state.status === "unavailable" && isMock(state.message) ? mockStations() : [];
  const shown = onlineOnly ? list.filter((s) => s.online) : list;
  const mock = state.status === "unavailable" && state.message ? isMock(state.message) : false;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Stations / Lobbies"
        sub={mock ? MOCK_BANNER : "Lounges and lobbies reported by the backend"}
        aside={<button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh stations"><RefreshCw size={15} /></button>}
      />
      {mock && <MockBanner />}
      <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer" style={{ color: "var(--muted)" }}>
        <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
        Only show online
      </label>
      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !mock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/stations" />
        </>
      ) : shown.length === 0 ? (
        <div className="card"><EmptyState>No stations found.</EmptyState></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((s) => (
            <div key={s.stationId} className="card px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-10 w-10 rounded-md flex items-center justify-center font-semibold shrink-0" style={{ background: "var(--surface2)", border: "1px solid var(--line)" }}>
                  {(s.name || "S")[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="font-mono text-[12px] truncate" style={{ color: "var(--muted)" }}>{s.stationId}</p>
                </div>
                <StatusPill state={s.online} />
              </div>
              <div className="flex gap-4 mt-3 text-[13px] tabular" style={{ color: "var(--muted)" }}>
                <span>{s.playerCount} players</span>
                <span>{s.serverCount} servers</span>
                {s.region && <span>{s.region}</span>}
              </div>
              {s.updatedAt && <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>Updated {formatDate(s.updatedAt)}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function isMock(message: string): boolean {
  return message.includes("Mock mode");
}
