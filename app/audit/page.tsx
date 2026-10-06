"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { client } from "../../lib/client-api";
import type { AuditEntry } from "../../lib/types";
import { formatDate } from "../../lib/format";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, PageHeader } from "../../components/ui";

export default function AuditPage() {
  return (
    <Gate perm="audit.read">
      <AuditBody />
    </Gate>
  );
}

function AuditBody() {
  const [events, setEvents] = useState<AuditEntry[] | null>(null);
  const [source, setSource] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    client
      .audit(200)
      .then((r) => {
        setEvents(r.events);
        setSource(r.source);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // Mount-time fetch only; updates land in async callbacks. The Refresh
    // button reuses load() as an event handler.
    let live = true;
    client
      .audit(200)
      .then((r) => {
        if (!live) return;
        setEvents(r.events);
        setSource(r.source);
        setErr(null);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!live) return;
        setErr(e.message);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Audit Log"
        sub={source === "mock" ? "Development mock trail" : source === "unsupported" ? "Backend has no audit endpoint — showing empty trail" : "Authentication, control, moderation, and key changes"}
        aside={<button onClick={load} className="btn-dark" aria-label="Refresh audit log"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>}
      />
      {err && <ErrorBox message={err} onRetry={load} />}
      {loading || !events ? (
        <div className="card px-5 py-5"><div className="skeleton h-5 w-2/3" /></div>
      ) : events.length === 0 ? (
        <div className="card"><EmptyState>No audit events recorded yet.</EmptyState></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Target</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="tbl-row">
                  <td className="px-5 py-3 whitespace-nowrap">{formatDate(e.ts)}</td>
                  <td className="px-5 py-3 font-mono text-[13px]">{e.actor}</td>
                  <td className="px-5 py-3 font-mono text-[13px]">{e.action}</td>
                  <td className="px-5 py-3 font-mono text-[13px]">{e.target ?? "—"}</td>
                  <td className="px-5 py-3"><span className="pill">{e.origin ?? "backend"}</span></td>
                  <td className="px-5 py-3 tabular">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] mt-4" style={{ color: "var(--muted)" }}>
        Passwords, session secrets, API keys, and bearer tokens are never written to this log.
      </p>
    </>
  );
}
