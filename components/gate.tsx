"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSession } from "../lib/useSession";

export function Gate({ perm, children }: { perm: string; children: ReactNode }) {
  const { loggedIn, loading, can } = useSession();
  if (loading) return <p className="text-sm" style={{ color: "var(--muted)" }}>Checking session…</p>;
  if (!loggedIn) {
    return (
      <div className="card px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
        Sign in to use the operator panel. <Link href="/login" className="underline underline-offset-2">Sign in</Link>
      </div>
    );
  }
  if (!can(perm)) {
    return (
      <div className="card px-5 py-8 text-center">
        <p className="eyebrow mb-2">Restricted</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This key lacks the <code className="font-mono">{perm}</code> permission.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
