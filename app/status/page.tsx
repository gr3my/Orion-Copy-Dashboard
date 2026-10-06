"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { client } from "../../lib/client-api";
import type { PublicStatus } from "../../lib/types";
import { ErrorBox, LoadingRows, StatCard, StatusPill } from "../../components/ui";

export default function StatusPage() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    client
      .status()
      .then((s) => {
        setStatus(s);
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
      .status()
      .then((s) => {
        if (!live) return;
        setStatus(s);
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
    <div className="mx-auto max-w-[900px] pt-8 pb-20">
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <p className="eyebrow mb-2">Public status</p>
          <h1 className="text-3xl font-medium tracking-tight">Service status</h1>
        </div>
        <button onClick={load} className="btn-dark" aria-label="Refresh status">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {err && <ErrorBox message={err} onRetry={load} />}

      {loading && !status ? (
        <LoadingRows count={4} />
      ) : status && status.enabled === false ? (
        <div className="card px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
          The public status page is disabled on this deployment.
        </div>
      ) : status ? (
        <>
          <div className="flex items-center gap-3 mb-5">
            <StatusPill state={!status.reachable ? "offline" : status.maintenance ? "degraded" : "online"} />
            <span className="text-[13px]" style={{ color: "var(--muted)" }}>
              {!status.reachable
                ? "Backend unreachable — showing last known snapshot."
                : status.maintenance
                  ? "Maintenance mode"
                  : "All systems nominal"}
              {status.buildVersion && ` · build ${status.buildVersion}`}
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Players online" value={String(status.playersOnline)} />
            <StatCard label="Active servers" value={`${status.healthyServers}/${status.activeServers}`} hint="healthy / total" />
            <StatCard label="Active matches" value={String(status.activeMatches)} />
            <StatCard label="Capacity" value={`${status.capacityUsed}/${status.capacityTotal}`} hint="used / total" />
          </div>
          <h2 className="text-lg font-medium mb-3">Announcements</h2>
          {status.announcements.length === 0 ? (
            <div className="card px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>No announcements right now.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {status.announcements.map((a) => (
                <div key={a.id} className="card px-5 py-4">
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.body && <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{a.body}</p>}
                </div>
              ))}
            </div>
          )}
          <p className="text-[12px] mt-6" style={{ color: "var(--muted)" }}>
            Operators: <Link href="/login" className="underline underline-offset-2">sign in</Link> for the full panel.
          </p>
        </>
      ) : null}
    </div>
  );
}
