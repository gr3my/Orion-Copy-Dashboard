"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockPlayers, MOCK_BANNER } from "../../lib/mock";
import type { PlayerSummary } from "../../lib/types";
import { formatDate, timeAgo } from "../../lib/format";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, StatusPill, UnsupportedBox } from "../../components/ui";

export default function PlayersPage() {
  return (
    <Gate perm="players.read">
      <PlayersBody />
    </Gate>
  );
}

function PlayersBody() {
  const { can } = useSession();
  const [query, setQuery] = useState("");
  const state = useOrion<PlayerSummary[]>("/v1/players", can("players.read"));

  const players = useMemo(() => {
    const list = state.status === "ready" ? state.data : state.status === "unavailable" && isMockMsg(state.message) ? mockPlayers() : [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.displayName.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q));
  }, [state, query]);

  const isMock = state.status === "unavailable" && state.message ? isMockMsg(state.message) : false;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Players"
        sub={isMock ? MOCK_BANNER : "Search by display name or player ID"}
        aside={
          <button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh players">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />
      {isMock && <MockBanner />}
      <div className="field flex items-center gap-2 mb-4">
        <Search size={14} className="shrink-0" style={{ color: "var(--muted)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          className="flex-1 bg-transparent text-sm outline-none"
          aria-label="Search players"
        />
      </div>

      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !isMock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/players?q=" />
        </>
      ) : players.length === 0 ? (
        <div className="card"><EmptyState>{query ? `No players match "${query}".` : "No players found."}</EmptyState></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-3 font-medium">Player</th>
                <th className="px-5 py-3 font-medium">State</th>
                <th className="px-5 py-3 font-medium">Server</th>
                <th className="px-5 py-3 font-medium">Last seen</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.playerId} className="tbl-row">
                  <td className="px-5 py-3">
                    <span className="block font-medium">{p.displayName}</span>
                    <span className="block font-mono text-[12px]" style={{ color: "var(--muted)" }}>{p.playerId}</span>
                  </td>
                  <td className="px-5 py-3"><StatusPill state={p.online} /></td>
                  <td className="px-5 py-3 font-mono text-[13px]">{p.currentServer ?? "—"}</td>
                  <td className="px-5 py-3" title={formatDate(p.lastSeen)}>{timeAgo(p.lastSeen)}</td>
                  <td className="px-5 py-3">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {can("players.moderate") && (
        <p className="text-[12px] mt-4" style={{ color: "var(--muted)" }}>
          Moderation actions live on the Moderation page (POST /v1/players/:id/moderate).
        </p>
      )}
    </>
  );
}

function isMockMsg(message: string): boolean {
  return message.includes("Mock mode");
}
