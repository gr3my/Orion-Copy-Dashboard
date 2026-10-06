"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { client } from "../../lib/client-api";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockServers, MOCK_BANNER } from "../../lib/mock";
import type { GameServer } from "../../lib/types";
import { formatDate, formatUptime } from "../../lib/format";
import { Gate } from "../../components/gate";
import { ConfirmDialog, EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, StatusPill, UnsupportedBox } from "../../components/ui";

const ACTIONS = [
  { key: "drain", label: "Drain", body: "Stop sending new players to this server?" },
  { key: "restart", label: "Restart", body: "Restart this game server? Connected players will be disconnected." },
  { key: "stop", label: "Stop", body: "Stop this game server? Connected players will be disconnected." },
  { key: "remove", label: "Remove", body: "Remove this server registration? This cannot be undone." },
] as const;

export default function ServersPage() {
  return (
    <Gate perm="servers.read">
      <ServersBody />
    </Gate>
  );
}

function ServersBody() {
  const { can } = useSession();
  const canControl = can("servers.control");
  const state = useOrion<GameServer[]>("/v1/servers", can("servers.read"));
  const [region, setRegion] = useState("all");
  const [pending, setPending] = useState<{ server: GameServer; action: (typeof ACTIONS)[number] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const servers = useMemo(() => {
    const list = state.status === "ready" ? state.data : state.status === "unavailable" && isMockMsg(state.message) ? mockServers() : [];
    return region === "all" ? list : list.filter((s) => s.region === region);
  }, [state, region]);

  const regions = useMemo(() => [...new Set(servers.map((s) => s.region))], [servers]);
  const isMock = state.status === "unavailable" && state.message ? isMockMsg(state.message) : false;

  async function runAction() {
    if (!pending) return;
    setBusy(true);
    setNotice(null);
    try {
      await client.orionPost(`/v1/servers/${encodeURIComponent(pending.server.serverId)}/${pending.action.key}`, {});
      setNotice(`${pending.action.label} sent to ${pending.server.label}.`);
      setPending(null);
      state.reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Servers"
        sub={isMock ? MOCK_BANNER : "Health, capacity, and control for registered game servers"}
        aside={
          <>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="field !w-auto text-sm" aria-label="Filter by region">
              <option value="all">All regions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh servers"><RefreshCw size={15} /></button>
          </>
        }
      />
      {isMock && <MockBanner />}
      {notice && <div className="card mb-4 px-4 py-3 text-sm">{notice}</div>}

      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !isMock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/servers" />
        </>
      ) : servers.length === 0 ? (
        <div className="card"><EmptyState>No servers registered.</EmptyState></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-3 font-medium">Server</th>
                <th className="px-5 py-3 font-medium">Health</th>
                <th className="px-5 py-3 font-medium">Players</th>
                <th className="px-5 py-3 font-medium">Region</th>
                <th className="px-5 py-3 font-medium">Build</th>
                <th className="px-5 py-3 font-medium">Uptime</th>
                <th className="px-5 py-3 font-medium">Heartbeat</th>
                {canControl && <th className="px-5 py-3 font-medium text-right">Control</th>}
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.serverId} className="tbl-row">
                  <td className="px-5 py-3">
                    <span className="block font-medium">{s.label}</span>
                    <span className="block font-mono text-[12px]" style={{ color: "var(--muted)" }}>
                      {s.serverId}{s.gamePort != null ? ` :${s.gamePort}` : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3"><StatusPill state={s.healthy && s.status === "online"} /></td>
                  <td className="px-5 py-3 tabular">{s.playerCount}/{s.capacity}</td>
                  <td className="px-5 py-3">{s.region}</td>
                  <td className="px-5 py-3 font-mono text-[13px]">{s.buildVersion ?? "—"}</td>
                  <td className="px-5 py-3">{formatUptime(s.uptimeSeconds)}</td>
                  <td className="px-5 py-3" title={formatDate(s.lastHeartbeat)}>{s.lastHeartbeat ? formatDate(s.lastHeartbeat) : "—"}</td>
                  {canControl && (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        {ACTIONS.map((a) => (
                          <button key={a.key} onClick={() => setPending({ server: s, action: a })} className="btn-dark !py-1 !px-2.5 !text-[12px]" disabled={isMock}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pending && (
        <ConfirmDialog
          title={`${pending.action.label} ${pending.server.label}?`}
          body={pending.action.body}
          confirmLabel={pending.action.label}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={runAction}
        />
      )}
    </>
  );
}

function isMockMsg(message: string): boolean {
  return message.includes("Mock mode");
}
