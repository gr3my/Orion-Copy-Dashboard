"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { client } from "../../lib/client-api";
import { invalidateSession } from "../../lib/useSession";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!key.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await client.login(key.trim());
      if (res.success) {
        invalidateSession();
        window.location.replace("/overview");
      } else {
        setErr(res.error || "That key didn't work. Check it and try again.");
      }
    } catch {
      setErr("Couldn't reach the dashboard. Try again in a bit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-20 pb-20">
      <div className="card p-8">
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <span className="h-12 w-12 rounded-xl flex items-center justify-center font-bold" style={{ background: "#2a3342", color: "var(--link)" }}>OC</span>
          <p className="eyebrow mt-2">Orion Copy</p>
          <h1 className="text-2xl font-medium tracking-tight">Operator sign in</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Use your operator key or the bootstrap admin key.</p>
        </div>

        <label className="block text-sm mb-1.5" style={{ color: "var(--muted)" }} htmlFor="op-key">Operator key</label>
        <div className="field flex items-center gap-2 mb-4">
          <KeyRound size={14} className="shrink-0" style={{ color: "var(--muted)" }} />
          <input
            id="op-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="orion_…"
            autoComplete="current-password"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        {err && <div className="card mb-4 px-4 py-3 text-sm" style={{ color: "var(--red)" }}>{err}</div>}

        <button onClick={submit} disabled={busy || !key.trim()} className="btn-light w-full justify-center">
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          First run? Set ORION_DASHBOARD_ADMIN_KEY, then mint scoped keys under API Keys.
        </p>
      </div>
    </div>
  );
}
