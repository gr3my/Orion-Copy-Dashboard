"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockMatches, MOCK_BANNER } from "../../lib/mock";
import type { MatchSession } from "../../lib/types";
import { formatDate } from "../../lib/format";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, UnsupportedBox } from "../../components/ui";

export default function MatchesPage() {
  return (
    <Gate perm="matches.read">
      <MatchesBody />
    </Gate>
  );
}

function MatchesBody() {
  const { can } = useSession();
  const [mode, setMode] = useState("all");
  const state = useOrion<MatchSession[]>("/v1/matches", can("matches.read"));

  const all = useMemo(() => {
    if (state.status === "ready") return state.data;
    if (state.status === "unavailable" && isMock(state.message)) return mockMatches();
    return [];
  }, [state]);
  const modes = useMemo(() => [...new Set(all.map((m) => m.mode).filter(Boolean))] as string[], [all]);
  const shown = useMemo(() => (mode === "all" ? all : all.filter((m) => m.mode === mode)), [all, mode]);
  const mock = state.status === "unavailable" && state.message ? isMock(state.message) : false;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Matches"
        sub={mock ? MOCK_BANNER : "Active sessions without exposing connection credentials"}
        aside={
          <>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="field !w-auto text-sm" aria-label="Filter by mode">
              <option value="all">All modes</option>
              {modes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh matches"><RefreshCw size={15} /></button>
          </>
        }
      />
      {mock && <MockBanner />}
      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !mock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/matches" />
        </>
      ) : shown.length === 0 ? (
        <div className="card"><EmptyState>No matches found.</EmptyState></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-3 font-medium">Session</th>
                <th className="px-5 py-3 font-medium">Players</th>
                <th className="px-5 py-3 font-medium">Mode</th>
                <th className="px-5 py-3 font-medium">Region</th>
                <th className="px-5 py-3 font-medium">State</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.sessionId} className="tbl-row">
                  <td className="px-5 py-3">
                    <span className="block font-mono text-[13px]">{m.sessionId}</span>
                    {m.serverId && <span className="block font-mono text-[12px]" style={{ color: "var(--muted)" }}>{m.serverId}</span>}
                  </td>
                  <td className="px-5 py-3 tabular">{m.playerCount}/{m.maxPlayers}</td>
                  <td className="px-5 py-3">{m.mode ?? "—"}</td>
                  <td className="px-5 py-3">{m.region ?? "—"}</td>
                  <td className="px-5 py-3"><span className="pill">{m.state}</span></td>
                  <td className="px-5 py-3">{formatDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function isMock(message: string): boolean {
  return message.includes("Mock mode");
}
