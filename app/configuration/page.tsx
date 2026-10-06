"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { client } from "../../lib/client-api";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { Gate } from "../../components/gate";
import { ErrorBox, LoadingRows, PageHeader, UnsupportedBox } from "../../components/ui";

// Sensitive values are masked server-side: the browser only learns whether
// a value is configured, never the value itself. Editing a sensitive value
// replaces it blindly — the old value is never displayed or transmitted.
type ConfigEntry = { value: string | null; editable: boolean; sensitive: boolean; configured?: boolean };
type ConfigMap = Record<string, ConfigEntry>;

export default function ConfigurationPage() {
  return (
    <Gate perm="config.read">
      <ConfigBody />
    </Gate>
  );
}

function ConfigBody() {
  const { can } = useSession();
  const canWrite = can("config.write");
  const state = useOrion<ConfigMap>("/v1/config", can("config.read"));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function save(key: string, entry: ConfigEntry) {
    const value = edits[key];
    if (value == null || (entry.sensitive && !value)) return;
    setBusy(true);
    setNotice(null);
    try {
      await client.orionPatch("/v1/config", { [key]: value });
      setNotice(`${key} updated.`);
      setEdits((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
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
        title="Configuration"
        sub="Editable values are writable with config.write; sensitive values stay masked"
        aside={<button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh configuration"><RefreshCw size={15} /></button>}
      />
      {notice && <div className="card mb-4 px-4 py-3 text-sm">{notice}</div>}
      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/config" />
        </>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-3 font-medium">Key</th>
                <th className="px-5 py-3 font-medium">Value</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(state.data).map(([key, entry]) => {
                const dirty = edits[key] != null && (entry.sensitive ? edits[key] !== "" : edits[key] !== (entry.value ?? ""));
                return (
                  <tr key={key} className="tbl-row">
                    <td className="px-5 py-3 font-mono text-[13px]">
                      {key}
                      <span className="block text-[11px]" style={{ color: "var(--muted)" }}>
                        {entry.editable ? "editable" : "read-only"}{entry.sensitive ? " · sensitive" : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {entry.sensitive ? (
                        entry.editable && canWrite ? (
                          <input
                            value={edits[key] ?? ""}
                            onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                            type="password"
                            placeholder={entry.configured ? "Configured — enter a new value to replace" : "Not configured — enter a value"}
                            className="field font-mono !text-[13px]"
                            aria-label={key}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        ) : (
                          <span className={`pill ${entry.configured ? "green" : ""}`}>
                            {entry.configured ? "configured" : "not configured"}
                          </span>
                        )
                      ) : entry.editable && canWrite ? (
                        <input
                          value={edits[key] ?? entry.value ?? ""}
                          onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                          type="text"
                          className="field font-mono !text-[13px]"
                          aria-label={key}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      ) : (
                        <span className="font-mono text-[13px]">{entry.value ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {entry.editable && canWrite && dirty && (
                        <button onClick={() => save(key, entry)} disabled={busy} className="btn-light !py-1 !px-3 !text-[12px]">Save</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
