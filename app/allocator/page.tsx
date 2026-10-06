"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { client } from "../../lib/client-api";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockAllocator, MOCK_BANNER } from "../../lib/mock";
import type { AllocatorState } from "../../lib/types";
import { BarRow } from "../../components/charts";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, UnsupportedBox } from "../../components/ui";

export default function AllocatorPage() {
  return (
    <Gate perm="allocator.read">
      <AllocatorBody />
    </Gate>
  );
}

function AllocatorBody() {
  const { can } = useSession();
  const canWrite = can("allocator.write");
  const state = useOrion<AllocatorState>("/v1/allocator", can("allocator.read"));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const data = state.status === "ready" ? state.data : state.status === "unavailable" && isMock(state.message) ? mockAllocator() : null;
  const mock = state.status === "unavailable" && state.message ? isMock(state.message) : false;

  async function spinUp() {
    setBusy(true);
    setNotice(null);
    try {
      await client.orionPost("/v1/allocator", { action: "spin_up" });
      setNotice("Spin-up requested.");
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
        title="Allocator"
        sub={mock ? MOCK_BANNER : "Capacity, queue depth, and spin-up state"}
        aside={
          <>
            {canWrite && !mock && <button onClick={spinUp} disabled={busy || state.status !== "ready"} className="btn-light !py-2 text-sm">{busy ? "Requesting…" : "Request spin-up"}</button>}
            <button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh allocator"><RefreshCw size={15} /></button>
          </>
        }
      />
      {mock && <MockBanner />}
      {notice && <div className="card mb-4 px-4 py-3 text-sm">{notice}</div>}
      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !mock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/allocator" />
        </>
      ) : !data ? (
        <div className="card"><EmptyState>No allocator data.</EmptyState></div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="card px-5 py-4">
            <p className="text-sm font-medium mb-3">Capacity</p>
            <BarRow label="Allocated" used={data.allocated} total={Math.max(data.totalCapacity, 1)} />
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[
                ["Available", String(data.available)],
                ["Queued", String(data.queueDepth)],
                ["Spinning up", String(data.spinningUp)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md px-2 py-2" style={{ background: "var(--surface2)" }}>
                  <p className="text-lg font-medium tabular">{value}</p>
                  <p className="text-[12px]" style={{ color: "var(--muted)" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card px-5 py-4">
            <p className="text-sm font-medium mb-3">Region limits</p>
            {data.regionLimits.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>No region limits reported.</p>
            ) : (
              data.regionLimits.map((r) => <BarRow key={r.region} label={r.region} used={r.used} total={Math.max(r.limit, 1)} />)
            )}
          </div>
        </div>
      )}
    </>
  );
}

function isMock(message: string): boolean {
  return message.includes("Mock mode");
}
