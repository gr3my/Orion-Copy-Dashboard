"use client";

import { Fragment, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { client } from "../../lib/client-api";
import { PERMISSIONS } from "../../lib/types";
import { useSession } from "../../lib/useSession";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, PageHeader } from "../../components/ui";

type KeyRow = {
  keyId: string;
  label: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  preview: string;
};

export default function OperatorsPage() {
  return (
    <Gate perm="operators.read">
      <OperatorsBody writePerm="operators.write" title="Operators" sub="Scoped operator keys with least-privilege permissions" />
    </Gate>
  );
}

export function OperatorsBody({ writePerm, title, sub }: { writePerm: "operators.write" | "apikeys.write"; title: string; sub: string }) {
  const { can } = useSession();
  const canWrite = can(writePerm);
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [perms, setPerms] = useState<string[]>(["overview.read"]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  function load() {
    setLoading(true);
    client
      .keys()
      .then((r) => {
        setKeys(r.keys as KeyRow[]);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // Mount-time fetch only; updates land in async callbacks. Manual
    // refreshes call load() as an event handler.
    let live = true;
    client
      .keys()
      .then((r) => {
        if (!live) return;
        setKeys(r.keys as KeyRow[]);
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

  async function create() {
    if (!label.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await client.createKey({ label: label.trim(), permissions: perms, expiresDays: 30 });
      setNotice(`Created ${res.keyId}. Secret shown once: ${res.key}`);
      setLabel("");
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(keyId: string) {
    setBusy(true);
    try {
      await client.revokeKey(keyId);
      setNotice(`Revoked ${keyId}. Its sessions are now invalid.`);
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  function togglePerm(p: string) {
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function saveEdit(keyId: string) {
    setBusy(true);
    setNotice(null);
    try {
      await client.updateKey({ kid: keyId, permissions: editPerms });
      // Permission edits bump the key revision, which immediately invalidates
      // that key's sessions — affected operators sign in again.
      setNotice("Permissions updated. That key's sessions were invalidated.");
      setEditing(null);
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Operator" title={title} sub={sub} aside={<button onClick={load} className="btn-dark" aria-label="Refresh keys"><RefreshCw size={15} /></button>} />
      {notice && <div className="card mb-4 px-4 py-3 text-sm font-mono break-all">{notice}</div>}
      {err && <ErrorBox message={err} onRetry={load} />}

      {canWrite && (
        <div className="card px-5 py-4 mb-4">
          <p className="text-sm font-medium mb-3">Issue scoped key</p>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. evening-operator" className="field mb-3" aria-label="Key label" />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PERMISSIONS.map((p) => (
              <button
                key={p}
                onClick={() => togglePerm(p)}
                className={perms.includes(p) ? "pill blue" : "pill"}
                aria-pressed={perms.includes(p)}
                style={{ cursor: "pointer" }}
              >
                {p}
              </button>
            ))}
          </div>
          <button onClick={create} disabled={busy || !label.trim() || perms.length === 0} className="btn-light">Create key</button>
        </div>
      )}

      {loading || !keys ? (
        <div className="card px-5 py-5"><div className="skeleton h-5 w-2/3" /></div>
      ) : keys.length === 0 ? (
        <div className="card"><EmptyState>No operator keys yet. The bootstrap admin key works until you mint scoped keys.</EmptyState></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-3 font-medium">Label</th>
                <th className="px-5 py-3 font-medium">Permissions</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium text-right">State</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <Fragment key={k.keyId}>
                <tr className="tbl-row">
                  <td className="px-5 py-3">
                    <span className="block font-medium">{k.label}</span>
                    <span className="block font-mono text-[12px]" style={{ color: "var(--muted)" }}>{k.preview} · {k.keyId.slice(0, 8)}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-[12px] max-w-[320px] truncate" title={k.permissions.join(", ")}>
                    {k.permissions.includes("*") ? "full access" : k.permissions.join(", ") || "—"}
                  </td>
                  <td className="px-5 py-3">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {k.revoked ? (
                      <span className="text-[12px]" style={{ color: "var(--muted)" }}>revoked</span>
                    ) : canWrite ? (
                      <span className="inline-flex gap-1.5 justify-end">
                        <button
                          onClick={() => {
                            setEditing(editing === k.keyId ? null : k.keyId);
                            setEditPerms(k.permissions.includes("*") ? [...PERMISSIONS] : k.permissions);
                          }}
                          disabled={busy}
                          className="btn-dark !py-1 !px-2.5 !text-[12px]"
                        >
                          {editing === k.keyId ? "Close" : "Edit"}
                        </button>
                        <button onClick={() => revoke(k.keyId)} disabled={busy} className="btn-danger !py-1 !px-2.5 !text-[12px]">Revoke</button>
                      </span>
                    ) : (
                      <span className="pill green">active</span>
                    )}
                  </td>
                </tr>
                {editing === k.keyId && !k.revoked && canWrite && (
                  <tr key={`${k.keyId}-edit`} className="tbl-row">
                    <td colSpan={4} className="px-5 py-3">
                      <p className="text-[13px] mb-2" style={{ color: "var(--muted)" }}>
                        Permissions for <span className="font-medium" style={{ color: "var(--text)" }}>{k.label}</span>. Saving invalidates its sessions.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {PERMISSIONS.map((p) => (
                          <button
                            key={p}
                            onClick={() => setEditPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
                            className={editPerms.includes(p) ? "pill blue" : "pill"}
                            aria-pressed={editPerms.includes(p)}
                            style={{ cursor: "pointer" }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => saveEdit(k.keyId)} disabled={busy || editPerms.length === 0} className="btn-light !py-1 !px-3 !text-[12px]">Save permissions</button>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
