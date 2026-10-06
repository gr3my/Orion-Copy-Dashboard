"use client";

import { RefreshCw } from "lucide-react";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockMetrics, MOCK_BANNER } from "../../lib/mock";
import type { MetricSeries } from "../../lib/types";
import { Sparkline } from "../../components/charts";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, UnsupportedBox } from "../../components/ui";

export default function MetricsPage() {
  return (
    <Gate perm="overview.read">
      <MetricsBody />
    </Gate>
  );
}

function MetricsBody() {
  const { can } = useSession();
  const state = useOrion<{ series: MetricSeries[] }>("/v1/metrics", can("overview.read"));

  const series = state.status === "ready" ? state.data.series : state.status === "unavailable" && isMock(state.message) ? mockMetrics() : [];
  const mock = state.status === "unavailable" && state.message ? isMock(state.message) : false;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Metrics"
        sub={mock ? MOCK_BANNER : "Operational time series from the backend"}
        aside={<button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh metrics"><RefreshCw size={15} /></button>}
      />
      {mock && <MockBanner />}
      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !mock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/metrics" />
        </>
      ) : series.length === 0 ? (
        <div className="card"><EmptyState>No metric series reported.</EmptyState></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {series.map((s) => (
            <div key={s.key} className="card px-5 py-4">
              <Sparkline series={s} />
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
