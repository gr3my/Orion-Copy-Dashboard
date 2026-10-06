"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { client } from "../../lib/client-api";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockModeration, MOCK_BANNER } from "../../lib/mock";
import type { ModerationRecord } from "../../lib/types";
import { formatDate } from "../../lib/format";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, UnsupportedBox } from "../../components/ui";

export default function ModerationPage() {
  return (
    <Gate perm="players.moderate">
      <ModerationBody />
    </Gate>
  );
}

function ModerationBody() {
  const { can } = useSession();
  const state = useOrion<ModerationRecord[]>("/v1/moderation", can("players.moderate"));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ playerId: "", action: "warn", reason: "", minutes: "60" });

  const records = state.status === "ready" ? state.data : state.status === "unavailable" && isMock(state.message) ? mockModeration() : [];
  const mock = state.status === "unavailable" && state.message ? isMock(state.message) : false;

  async function submit() {
    if (!form.playerId.trim() || !form.reason.trim() || busy || mock) return;
    setBusy(true);
    setNotice(null);
    try {
      await client.orionPost("/v1/moderation", {
        player_id: form.playerId.trim(),
        action: form.action,
        reason: form.reason.trim(),
        duration_minutes: Number(form.minutes) || 0,
      });
      setNotice("Moderation action recorded.");
      setForm({ playerId: "", action: "warn", reason: "", minutes: "60" });
      state.reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await client.orionPost(`/v1/moderation/${encodeURIComponent(id)}/revoke`, {});
      setNotice("Record revoked.");
      state.reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Moderation"
        sub={mock ? MOCK_BANNER : "Bans, kicks, mutes, and warnings with operator attribution"}
        aside={<button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh moderation"><RefreshCw size={15} /></button>}
      />
      {mock && <MockBanner />}
      {notice && <div className="card mb-4 px-4 py-3 text-sm">{notice}</div>}

      <div className="card px-5 py-4 mb-4">
        <p className="text-sm font-medium mb-3">New action</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <input value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} placeholder="Player ID" className="field" aria-label="Player ID" />
          <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="field" aria-label="Action">
            <option value="warn">Warn</option>
            <option value="mute">Mute</option>
            <option value="kick">Kick</option>
            <option value="ban">Ban</option>
          </select>
          <input value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="Minutes (0 = permanent)" className="field" inputMode="numeric" aria-label="Duration minutes" />
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason (required)" className="field" aria-label="Reason" />
          <button onClick={submit} disabled={busy || mock || !form.playerId.trim() || !form.reason.trim()} className="btn-light justify-center">Apply</button>
        </div>
      </div>

      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !mock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/moderation" />
        </>
      ) : records.length === 0 ? (
        <div className="card"><EmptyState>No moderation records.</EmptyState></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-3 font-medium">Player</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Operator</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium text-right">State</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="tbl-row">
                  <td className="px-5 py-3">
                    <span className="block font-medium">{r.playerName}</span>
                    <span className="block font-mono text-[12px]" style={{ color: "var(--muted)" }}>{r.playerId}</span>
                  </td>
                  <td className="px-5 py-3"><span className="pill">{r.action}</span></td>
                  <td className="px-5 py-3 max-w-[280px] truncate" title={r.reason}>{r.reason}</td>
                  <td className="px-5 py-3">{r.operator}</td>
                  <td className="px-5 py-3" title={r.expiresAt ? `Expires ${formatDate(r.expiresAt)}` : undefined}>{formatDate(r.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    {r.active && !mock ? (
                      <button onClick={() => revoke(r.id)} disabled={busy} className="btn-dark !py-1 !px-2.5 !text-[12px]">Revoke</button>
                    ) : (
                      <span className="text-[12px]" style={{ color: "var(--muted)" }}>{r.active ? "active" : "closed"}</span>
                    )}
                  </td>
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
