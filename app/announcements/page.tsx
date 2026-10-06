"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { client } from "../../lib/client-api";
import { useSession } from "../../lib/useSession";
import { useOrion } from "../../lib/useOrion";
import { mockAnnouncements, MOCK_BANNER } from "../../lib/mock";
import type { Announcement } from "../../lib/types";
import { formatDate } from "../../lib/format";
import { Gate } from "../../components/gate";
import { EmptyState, ErrorBox, LoadingRows, MockBanner, PageHeader, UnsupportedBox } from "../../components/ui";

export default function AnnouncementsPage() {
  return (
    <Gate perm="announcements.read">
      <AnnouncementsBody />
    </Gate>
  );
}

function AnnouncementsBody() {
  const { can } = useSession();
  const canWrite = can("announcements.write");
  const state = useOrion<Announcement[]>("/v1/announcements", can("announcements.read"));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const items = state.status === "ready" ? state.data : state.status === "unavailable" && isMock(state.message) ? mockAnnouncements() : [];
  const mock = state.status === "unavailable" && state.message ? isMock(state.message) : false;

  async function create() {
    if (!title.trim() || busy || mock) return;
    setBusy(true);
    setNotice(null);
    try {
      await client.orionPost("/v1/announcements", { title: title.trim(), body: body.trim() });
      setNotice("Announcement created.");
      setTitle("");
      setBody("");
      state.reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a: Announcement) {
    setBusy(true);
    try {
      await client.orionPatch(`/v1/announcements/${encodeURIComponent(a.id)}`, { enabled: !a.enabled });
      state.reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await client.orionDelete(`/v1/announcements/${encodeURIComponent(id)}`);
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
        title="Announcements"
        sub={mock ? MOCK_BANNER : "Enabled announcements also appear on the public status page"}
        aside={<button onClick={() => state.reload()} className="btn-dark" aria-label="Refresh announcements"><RefreshCw size={15} /></button>}
      />
      {mock && <MockBanner />}
      {notice && <div className="card mb-4 px-4 py-3 text-sm">{notice}</div>}

      {canWrite && (
        <div className="card px-5 py-4 mb-4">
          <p className="text-sm font-medium mb-3">New announcement</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="field mb-2.5" aria-label="Title" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" rows={3} className="field mb-2.5" aria-label="Body" />
          <button onClick={create} disabled={busy || mock || !title.trim()} className="btn-light">Publish</button>
        </div>
      )}

      {state.status === "loading" ? (
        <LoadingRows />
      ) : state.status === "unavailable" && !mock ? (
        <>
          <ErrorBox message={state.message} onRetry={state.reload} />
          <UnsupportedBox endpoint="GET /v1/announcements" />
        </>
      ) : items.length === 0 ? (
        <div className="card"><EmptyState>No announcements.</EmptyState></div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <div key={a.id} className="card px-5 py-4">
              <div className="flex items-center gap-2">
                <p className="font-medium flex-1">{a.title}</p>
                <span className={`pill ${a.enabled ? "green" : ""}`}>{a.enabled ? "enabled" : "disabled"}</span>
              </div>
              {a.body && <p className="text-sm mt-1.5" style={{ color: "var(--muted)" }}>{a.body}</p>}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[12px] flex-1" style={{ color: "var(--muted)" }}>Updated {formatDate(a.updatedAt)}</span>
                {canWrite && !mock && (
                  <>
                    <button onClick={() => toggle(a)} disabled={busy} className="btn-dark !py-1 !px-2.5 !text-[12px]">{a.enabled ? "Disable" : "Enable"}</button>
                    <button onClick={() => remove(a.id)} disabled={busy} className="btn-danger !py-1 !px-2.5 !text-[12px]">Delete</button>
                  </>
                )}
              </div>
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
