# Orion Copy Dashboard

A standalone operations and status dashboard for developers running their own
**Orion Drift-compatible** multiplayer infrastructure.

> Independent community project. Not an official Orion Drift product, and not
> affiliated with or endorsed by its makers.

## Screenshots

_TODO: add screenshots of the status page and operator overview once deployed._

## Features

- **Public status page** (`/status`) — players online, server health, matches,
  capacity, build version, maintenance flag, announcements. Disable with
  `ORION_PUBLIC_STATUS_ENABLED=false`.
- **Operator panel** — Overview, Players, Servers, Stations/Lobbies, Matches,
  Allocator, Moderation, Announcements, Configuration, Operators, API Keys,
  Metrics, Logs, Audit Log, System.
- **Scoped authentication** — bootstrap admin key plus least-privilege
  operator keys, HMAC-signed `HttpOnly`/`SameSite` session cookies, login rate
  limiting, per-permission route gating, immediate session revocation.
- **One backend abstraction** — every backend call flows through the allowlist
  in `lib/orion-api.ts`; the browser never sees internal URLs or credentials.
- **Honest unsupported states** — pages name the expected endpoint
  (see `docs/API.md`) instead of faking success when the backend lacks it.
- **Mock mode** (`ORION_MOCK=true`) — clearly-labeled synthetic fixtures for
  local UI work. Never enable in production.

## Quick start

```bash
npm install
cp .env.example .env
# edit .env: ORION_API_URL, ORION_DASHBOARD_SESSION_SECRET, ORION_DASHBOARD_ADMIN_KEY
npm run dev
```

Open `http://localhost:3000/status` for the public view or
`http://localhost:3000/overview` for the operator panel.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ORION_API_URL` | yes | Backend base URL. Server-side only — never sent to the browser |
| `ORION_DASHBOARD_SESSION_SECRET` | yes | Session signing secret, min 32 chars (`openssl rand -hex 32`) |
| `ORION_DASHBOARD_ADMIN_KEY` | yes | Bootstrap admin key, min 20 chars |
| `ORION_DASHBOARD_NAME` | no | Display name (default `Orion Copy Dashboard`) |
| `ORION_PUBLIC_STATUS_ENABLED` | no | `true`/`false` (default `true`) |
| `ORION_DEFAULT_SERVER_REGION` | no | Region label fallback (default `local`) |
| `ORION_TRUST_PROXY_HEADERS` | no | Trust `X-Forwarded-For` etc. for client IP (default `false`) |
| `ORION_MOCK` | no | `true` serves labeled fixtures (default `false`) |

No `NEXT_PUBLIC_*` variables are used: every backend call is proxied through
server-side route handlers, so internal URLs and credentials never enter
browser JavaScript.

### Production secret requirements

`ORION_DASHBOARD_SESSION_SECRET` (≥32 chars) and `ORION_DASHBOARD_ADMIN_KEY`
(≥20 chars) are validated by a shared helper (`lib/security.ts`). Placeholder
values (`CHANGE_ME`, `YOUR_SECRET`, …) and short values **block authentication
in production** (`NODE_ENV=production`) with an explicit error. Copying
`.env.example` verbatim will not authenticate — replace both values first. In
development, weak values start the server but every login response carries a
warning; fix them before deploying.

### Reverse proxies and rate limiting

Login attempts are rate-limited (10/minute per identity, bounded store capped
at 2000 entries with expiry — the cap is enforced on insertion, so bursts of
unique keys cannot grow memory). By default forwarding headers are untrusted
and every direct client shares one global budget, which still bounds
brute force but is not per-client precision. For accurate per-client limiting,
deploy behind a trusted reverse proxy and set
`ORION_TRUST_PROXY_HEADERS=true` so `X-Forwarded-For`/`X-Real-IP`/
`CF-Connecting-IP` are honored. Set it only behind a proxy that strips
client-supplied forwarding headers. Example nginx:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_pass http://127.0.0.1:3000;
```

### Sessions and revocation

Sessions embed the operator key ID plus a registry revision. Every request
re-validates against the key registry: **revoking a key, or changing its
label/permissions, invalidates its sessions immediately** — no waiting for the
8-hour cookie expiry. Permission checks always use the registry's current
record. Master sessions embed a fingerprint of `ORION_DASHBOARD_ADMIN_KEY`,
so **rotating the admin key invalidates outstanding master sessions**; the raw
key is never stored in cookies. (Upgrading from an older dashboard version
invalidates existing sessions once, since old cookies lack the fingerprint.)

### Audit logging

Security events are recorded to a local bounded trail (`.data/`, gitignored)
and merged into the Audit Log page ahead of backend events: login
success/failure, logout, operator-key create/update/revoke, config writes,
allocator writes, server control actions (drain/restart/stop/remove),
moderation and announcement changes. Secrets are redacted before write; the
trail never stores passwords, keys, or tokens.

## Backend integration

### Orion Copy Server

Point `ORION_API_URL` at your server and implement the routes in
[`docs/API.md`](docs/API.md). Missing routes render as "unsupported" until you
add them — no dashboard changes required.

### AUnrealFeatures

If your service uses different route paths, add entries to `PROXY_RULES` in
`lib/orion-api.ts` mapping them to the same dashboard permissions, and note the
mapping in `docs/API.md`.

## Production build

```bash
npm ci
npm run build
npm start
```

Set `NODE_ENV=production` so session cookies get the `Secure` flag. Serve
behind HTTPS.

## Security

- `HttpOnly`, `SameSite=Lax`, `Secure`-in-production session cookies.
- CSRF: all state-changing routes (proxy, operator keys, session) require a
  matching `Origin` plus the session cookie (`lib/security.ts#sameOrigin`).
- Middleware enforces an explicit public-API allowlist (`/api/session`,
  `/api/status`, `/api/me`); all other API routes 401 without a session, and
  handlers re-check permissions (defense in depth).
- API keys stored as SHA-256 hashes (`.data/`, gitignored), shown once;
  registry writes are mutex-serialized with atomic file replacement.
- Sensitive config values are masked server-side (`value: null`, only
  `configured: true/false` reaches the browser); replacement is blind.
- Log payloads are redacted server-side at the proxy before reaching clients.
- Security headers incl. `X-Frame-Options: DENY`, narrow CSP.
- Audit log never records passwords, secrets, keys, or tokens.

## Project structure

```text
app/            routes: public pages, operator pages, API handlers
components/     sidebar shell, shared UI primitives, charts
lib/            config, types, mock fixtures, auth, backend client, hooks
docs/API.md     backend endpoint contract
public/         static assets
```

## Known limitations

- Operator key registry is file-local (`.data/operator-keys.json`); use one
  instance or add shared storage for multi-instance deployments.
- No built-in TOTP/2FA; rely on strong keys and short sessions, or front with
  your identity provider.
- Real-time updates are poll-based (manual refresh); no websocket tail yet.

## License

MIT — see [LICENSE](LICENSE).
