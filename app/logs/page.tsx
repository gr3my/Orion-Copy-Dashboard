"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockLogs, MOCK_BANNER } from "../../lib/mock";
import type { LogEntry } from "../../lib/types";
import { formatDate } from "../../lib/format";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, UnsupportedBox } from "../../components/ui";

export default function LogsPage() {
  return (
    <Gate perm="logs.read">
      <LogsBody />
    </Gate>
  );
}

function LogsBody() {
  const { can } = useSession();
  const [level, setLevel] = useState("all");
  const [component, setComponent] = useState("all");
  const [query, setQuery] = useState("");
  const state = useOrion<LogEntry[]>("/v1/logs?limit=200", can("logs.read"));

  const all = useMemo(() => {
    if (state.status === "ready") return state.data;
    if (state.status === "unavailable" && isMock(state.message)) return mockLogs();
    return [];
  }, [state]);
  const components = useMemo(() => [...new Set(all.map((l) => l.component))], [all]);
  const shown = useMemo(
    () =>
      all.filter(
        (l) =>
          (level === "all" || l.level === level) &&
          (component === "all" || l.component === component) &&
          (!query.trim() || l.message.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    [all, level, component, query]
  );
  const mock = state.status === "unavailable" && state.message ? isMock(state.message) : false;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Logs"
        sub={mock ? MOCK_BANNER : "Backend log tail. Secrets are never rendered."}
        aside={<button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh logs"><RefreshCw size={15} /></button>}
      />
      {mock && <MockBanner />}
      <div className="flex flex-wrap gap-2.5 mb-4">
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="field !w-auto text-sm" aria-label="Severity filter">
          <option value="all">All levels</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <select value={component} onChange={(e) => setComponent(e.target.value)} className="field !w-auto text-sm" aria-label="Component filter">
          <option value="all">All components</option>
          {components.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="field flex items-center gap-2 !w-auto flex-1 min-w-[200px]">
          <Search size={14} className="shrink-0" style={{ color: "var(--muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages…" className="flex-1 bg-transparent text-sm outline-none" aria-label="Search logs" />
        </div>
      </div>
      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !mock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/logs?limit=" />
        </>
      ) : shown.length === 0 ? (
        <div className="card"><EmptyState>No log entries match.</EmptyState></div>
      ) : (
        <div className="card font-mono text-[13px] overflow-x-auto">
          {shown.map((l) => (
            <div key={l.id} className="tbl-row px-5 py-2 flex gap-3 min-w-[640px]">
              <span className="shrink-0" style={{ color: "var(--muted)" }}>{formatDate(l.ts)}</span>
              <span className="shrink-0 w-12" style={{ color: levelColor(l.level) }}>{l.level}</span>
              <span className="shrink-0 w-28 truncate" style={{ color: "var(--muted)" }}>{l.component}</span>
              <span className="min-w-0 break-words">{redact(l.message)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function levelColor(level: LogEntry["level"]): string {
  if (level === "error") return "var(--red)";
  if (level === "warn") return "var(--yellow)";
  return "var(--link)";
}

// Last-line defense: never render something that looks like a credential.
function redact(message: string): string {
  return message.replace(/(api[_-]?key|secret|token|bearer)\s*[:=]\s*\S+/gi, "$1 [redacted]");
}

function isMock(message: string): boolean {
  return message.includes("Mock mode");
}
