"use client";

import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, aside, sub }: { eyebrow: string; title: string; aside?: ReactNode; sub?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-4 mb-6">
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        {sub && <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
      {aside && <div className="flex items-center gap-2 shrink-0">{aside}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card px-5 py-4 min-w-0">
      <p className="text-[13px]" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-2xl font-medium tabular mt-1 truncate">{value}</p>
      {hint && <p className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>{hint}</p>}
    </div>
  );
}

export function LoadingRows({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tbl-row px-5 py-5">
          <div className="skeleton h-5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="tbl-row px-5 py-10 text-center text-[15px]" style={{ color: "var(--muted)" }}>
      {children}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card mb-4 px-4 py-3 text-sm flex items-center gap-3" style={{ color: "var(--red)" }}>
      <span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="btn-dark !py-1.5 !px-3 text-xs">Retry</button>}
    </div>
  );
}

export function UnsupportedBox({ endpoint, docs = "/docs/API.md" }: { endpoint: string; docs?: string }) {
  return (
    <div className="card px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
      <p className="font-medium" style={{ color: "var(--text)" }}>Not supported by this backend</p>
      <p className="mt-1">
        Expected endpoint <code className="font-mono text-[13px]">{endpoint}</code> is not available.
        The panel stays ready for when your server implements it.
      </p>
      <p className="mt-1">Backend contract: <code className="font-mono text-[13px]">{docs}</code></p>
    </div>
  );
}

export function MockBanner() {
  return (
    <div className="card mb-4 px-4 py-2.5 text-[13px] flex items-center gap-2" style={{ color: "var(--yellow)" }}>
      <span className="status-dot warn" />
      Development mock data — set ORION_MOCK=false and configure ORION_API_URL for live data.
    </div>
  );
}

export function StatusPill({ state }: { state: "online" | "offline" | "degraded" | "unknown" | boolean }) {
  const normalized = typeof state === "boolean" ? (state ? "online" : "offline") : state;
  const cls = normalized === "online" ? "pill green" : normalized === "degraded" ? "pill blue" : normalized === "unknown" ? "pill" : "pill red";
  return (
    <span className={cls}>
      <span className={`status-dot ${normalized === "online" ? "on" : normalized === "unknown" ? "warn" : "off"}`} />
      {normalized}
    </span>
  );
}

export function ConfirmDialog({
  title, body, confirmLabel = "Confirm", onConfirm, onCancel, busy,
}: {
  title: string; body: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>{body}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="btn-dark" disabled={busy}>Cancel</button>
          <button onClick={onConfirm} className="btn-danger" disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
