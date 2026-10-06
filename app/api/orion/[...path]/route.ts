import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, hasPermission, readSessionStrict } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { isConfiguredValue, looksLikeSecretKey, redactSecretsDeep, sameOrigin } from "@/lib/security";
import { backend, findRule, isMock } from "@/lib/orion-api";

// Sensitive config values are masked here, server-side, before anything
// reaches the browser. An entry is sensitive when the backend says so
// (sensitive: true) OR when its key name strongly indicates a credential —
// the backend must not be trusted to label everything correctly. Masked
// entries become: { value: null, configured: boolean, sensitive: true, ... }

type ConfigEntryShape = Record<string, unknown>;

function maskEntry(key: string, entry: ConfigEntryShape): ConfigEntryShape {
  const backendFlag = entry.sensitive === true;
  const nameFlag = looksLikeSecretKey(key);
  if (backendFlag || nameFlag) {
    return { ...entry, sensitive: true, value: null, configured: isConfiguredValue(entry.value) };
  }
  return entry;
}

function maskConfigNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((el) => {
      if (el && typeof el === "object" && !Array.isArray(el)) {
        const e = el as Record<string, unknown>;
        // List shape: [{ key, value, sensitive, ... }]
        if (typeof e.key === "string" && "value" in e) return maskEntry(e.key, e as ConfigEntryShape);
      }
      return maskConfigNode(el);
    });
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v) && "value" in (v as Record<string, unknown>)) {
        out[k] = maskEntry(k, v as ConfigEntryShape);
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        out[k] = maskConfigNode(v);
      } else if (typeof v === "string" && looksLikeSecretKey(k)) {
        // Backend sent a raw secret string without metadata: normalize to a
        // masked, non-editable entry shape the UI already understands.
        out[k] = { value: null, configured: isConfiguredValue(v), sensitive: true, editable: false };
      } else if (typeof v === "string") {
        // Normalize plain values to the entry shape so the UI never has to
        // guess; non-sensitive values pass through untouched.
        out[k] = { value: v, configured: isConfiguredValue(v), sensitive: false, editable: false };
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return node;
}

// Backend log payloads are redacted here (defense in depth — the backend
// should redact too, and the UI keeps its own client-side pass as well).
function redactLogsPayload(data: unknown): unknown {
  return redactSecretsDeep(data);
}

function auditActionFor(method: string, path: string): string | null {
  const clean = path.split("?")[0];
  if (method === "PATCH" && clean === "/v1/config") return "config.update";
  if (method === "PATCH" && clean === "/v1/allocator") return "allocator.update";
  if (method === "POST" && /^\/v1\/servers\/[^/]+\/(drain|restart|stop|remove)$/.test(clean)) {
    return `server.${clean.split("/").pop()}`;
  }
  if (method === "POST" && clean === "/v1/moderation") return "moderation.create";
  if (method === "POST" && /^\/v1\/moderation\/.+\/revoke$/.test(clean)) return "moderation.revoke";
  if (method === "POST" && /^\/v1\/players\/.+\/moderate$/.test(clean)) return "player.moderate";
  if (method === "POST" && clean === "/v1/announcements") return "announcement.create";
  if ((method === "PATCH" || method === "DELETE") && clean.startsWith("/v1/announcements/")) {
    return method === "PATCH" ? "announcement.update" : "announcement.delete";
  }
  return null;
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const claims = await readSessionStrict(req.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });

  const { path } = await ctx.params;
  const backendPath = `/${(path ?? []).map(encodeURIComponent).join("/")}${req.nextUrl.search ?? ""}`;
  const cleanPath = backendPath.split("?")[0];
  const rule = findRule(req.method, backendPath);
  if (!rule) return NextResponse.json({ error: `Unsupported proxied route: ${req.method} ${cleanPath}` }, { status: 404 });
  if (!hasPermission(claims, rule.permission)) {
    return NextResponse.json({ error: "Forbidden for this operator key." }, { status: 403 });
  }
  if (isMock()) {
    return NextResponse.json({ error: "Mock mode is enabled; live backend proxying is disabled.", mock: true }, { status: 503 });
  }

  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text().catch(() => undefined);
  const parsed: unknown = body ? safeJson(body) : undefined;
  const upstream =
    req.method === "GET"
      ? await backend.get(backendPath)
      : req.method === "POST"
        ? await backend.post(backendPath, parsed)
        : req.method === "PATCH"
          ? await backend.patch(backendPath, parsed)
          : req.method === "PUT"
            ? await backend.put(backendPath, parsed)
            : await backend.del(backendPath);

  if (!upstream.ok) {
    const action = auditActionFor(req.method, backendPath);
    if (action) {
      await recordAuditEvent({ action, actor: claims.kid, target: cleanPath, status: upstream.status }).catch(() => undefined);
    }
    return NextResponse.json({ error: upstream.error, status: upstream.status }, { status: upstream.status });
  }

  let data: unknown = upstream.data;
  if (req.method === "GET" && cleanPath === "/v1/config") data = maskConfigNode(data);
  if (req.method === "GET" && cleanPath.startsWith("/v1/logs")) data = redactLogsPayload(data);

  const action = auditActionFor(req.method, backendPath);
  if (action) {
    await recordAuditEvent({ action, actor: claims.kid, target: cleanPath, status: 200 }).catch(() => undefined);
  }
  return NextResponse.json(data);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
