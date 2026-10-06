# Orion Copy Dashboard — Backend API Contract

The dashboard never talks to the game backend from the browser. All calls go
to Next.js route handlers (same origin), which proxy to `ORION_API_URL` through
the allowlist in `lib/orion-api.ts` (`PROXY_RULES`). Anything not listed there
is rejected with 404.

Base URL: the value of `ORION_API_URL` (server-side). All paths below are
relative to it. Every endpoint returns JSON.

## Public (no dashboard session needed, served via `/api/status`)

The dashboard reads one of these to render the public status page and maps
only aggregate fields (counts, build version, maintenance flag, enabled
announcements):

- `GET /status`
- `GET /health` (fallback)

Suggested shape (extra fields are ignored):

```json
{
  "playersOnline": 12,
  "activeServers": 2,
  "healthyServers": 2,
  "activeMatches": 1,
  "buildVersion": "1.2.3",
  "capacityUsed": 12,
  "capacityTotal": 64,
  "maintenance": false,
  "announcements": [{ "id": "a1", "title": "Hello", "body": "..." }]
}
```

## Operator (dashboard session + permission required)

| Dashboard permission | Method | Backend path |
|---|---|---|
| `overview.read` | GET | `/v1/overview` |
| `players.read` | GET | `/v1/players?q=` |
| `players.read` | GET | `/v1/players/:id` |
| `players.moderate` | POST | `/v1/players/:id/moderate` `{ action, reason, duration_minutes }` |
| `servers.read` | GET | `/v1/servers` |
| `servers.read` | GET | `/v1/servers/:id` |
| `servers.control` | POST | `/v1/servers/:id/drain`, `/restart`, `/stop`, `/remove` |
| `overview.read` | GET | `/v1/stations` |
| `matches.read` | GET | `/v1/matches` |
| `allocator.read` | GET | `/v1/allocator` |
| `allocator.write` | PATCH | `/v1/allocator` |
| `players.moderate` | GET | `/v1/moderation` |
| `players.moderate` | POST | `/v1/moderation` `{ player_id, action, reason, duration_minutes }` |
| `players.moderate` | POST | `/v1/moderation/:id/revoke` |
| `announcements.read` | GET | `/v1/announcements` |
| `announcements.write` | POST | `/v1/announcements` |
| `announcements.write` | PATCH | `/v1/announcements/:id` |
| `announcements.write` | DELETE | `/v1/announcements/:id` |
| `config.read` | GET | `/v1/config` |
| `config.write` | PATCH | `/v1/config` |
| `overview.read` | GET | `/v1/metrics` `{ series: [{ key, label, points: [{ t, value }] }] }` |
| `logs.read` | GET | `/v1/logs?limit=` |
| `audit.read` | GET | `/v1/audit?limit=` |
| `system.read` | GET | `/v1/system` |

## Missing endpoints

If your backend does not implement a route yet, the corresponding page shows
an "unsupported" state naming the expected endpoint instead of faking success.
Implement the endpoint and the page lights up — no dashboard changes needed.

## Server-side safety transforms

The dashboard proxy applies these before responding to the browser:

- `GET /v1/config` — entries with `sensitive: true` are masked to
  `{ value: null, configured: boolean, sensitive: true, ... }`. As a fallback,
  key names that strongly indicate credentials (`password`, `secret`, `token`,
  `api_key`, `private_key`, `client_secret`, … — case-insensitive, see
  `looksLikeSecretKey` in `lib/security.ts`) are masked even when the backend
  omits the flag. The real value never reaches clients; updates replace
  blindly. Shape your backend entries as `{ value, editable, sensitive }`
  objects (flat map or nested) to opt in.
- `GET /v1/logs...` — credential-like content (`Authorization: Bearer`,
  JWTs, `*_key`/`*_secret`/`password` assignments, `?token=` params) is
  redacted to `[redacted]`. Redact in your backend too; this is defense in
  depth, and the UI keeps its own client-side pass as well.

## Orion Copy Server / AUnrealFeatures notes

- If your server already exposes equivalent routes under different paths,
  add a mapping entry in `lib/orion-api.ts` (`PROXY_RULES`) and document it
  here. Keep the dashboard permission column unchanged.
- Keep game connection credentials (join tokens, IPs meant to stay private)
  out of list responses; the dashboard deliberately does not render them.
- Only `ORION_API_URL` (server-side) is used; no `NEXT_PUBLIC_*` backend URL
  exists — the browser never learns internal backend addresses.
