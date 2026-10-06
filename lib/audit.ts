// Local dashboard audit trail for security-relevant dashboard events
// (logins, key lifecycle, config writes, control actions). Stored as
// append-only JSONL under .data/ (gitignored, machine-local). Values are
// redacted before write; secrets must never reach this store.

import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { redactSecretsDeep } from "./security";
import type { AuditEntry } from "./types";

const MAX_LINES = 2000;

function auditPath(): string {
  return path.join(process.cwd(), ".data", "dashboard-audit.jsonl");
}

// Serializes read-modify-write cycles (trim) so concurrent writers cannot
// interleave or corrupt the file. Appends themselves are single write calls.
let queue: Promise<void> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export type DashboardAuditInput = {
  action: string;
  actor: string;
  target?: string | null;
  status?: number;
  meta?: Record<string, unknown>;
};

export function recordAuditEvent(input: DashboardAuditInput): Promise<void> {
  const entry = {
    id: `local-${randomBytes(6).toString("hex")}`,
    ts: new Date().toISOString(),
    actor: input.actor.slice(0, 120),
    action: input.action.slice(0, 120),
    target: input.target?.slice(0, 200) ?? null,
    status: input.status ?? 200,
    origin: "dashboard",
    ...(input.meta ? { meta: redactSecretsDeep(input.meta) } : {}),
  };
  const line = JSON.stringify(entry) + "\n";
  return enqueue(async () => {
    await fs.mkdir(path.dirname(auditPath()), { recursive: true });
    await fs.appendFile(auditPath(), line, "utf8");
    // Bounded growth: trim oldest lines while holding the queue.
    try {
      const raw = await fs.readFile(auditPath(), "utf8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length > MAX_LINES) {
        const kept = lines.slice(lines.length - MAX_LINES).join("\n") + "\n";
        const tmp = `${auditPath()}.tmp-${process.pid}`;
        await fs.writeFile(tmp, kept, "utf8");
        await fs.rename(tmp, auditPath());
      }
    } catch {
      // Best effort; the append above already succeeded.
    }
  });
}

export async function readLocalAudit(limit = 200): Promise<(AuditEntry & { origin: string })[]> {
  try {
    const raw = await fs.readFile(auditPath(), "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const slice = lines.slice(Math.max(0, lines.length - Math.max(1, Math.min(500, limit))));
    const out: (AuditEntry & { origin: string })[] = [];
    for (const line of slice) {
      try {
        const parsed = JSON.parse(line) as AuditEntry & { origin?: string };
        if (parsed && typeof parsed.id === "string") out.push({ ...parsed, origin: parsed.origin || "dashboard" });
      } catch {
        // Skip corrupt lines rather than failing the whole trail.
      }
    }
    return out.reverse();
  } catch {
    return [];
  }
}
