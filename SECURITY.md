
# Security

This document describes how authentication and the WebSocket engine are secured in Learn Block, how to configure them, and what is **not** covered yet.

Relevant files: `auth.go`, `ws.go`, `main.go`.

---

## Configuration

All secrets and deployment settings come from environment variables. **Nothing sensitive is stored in the source code.**

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | HMAC signing key, at least 32 characters. The server refuses to start without it. Generate one with `openssl rand -base64 48`. |
| `ALLOWED_ORIGINS` | For browsers | Comma-separated list of allowed web origins, e.g. `https://app.example.com,http://localhost:5173`. Used for both CORS and the WebSocket origin check. |
| `ADDR` | No | Listen address. Default `:8080`. |
| `TLS_CERT_FILE` / `TLS_KEY_FILE` | No | If both are set, the server serves HTTPS/WSS directly. Otherwise run it behind a TLS-terminating reverse proxy. |

Example (`.env` is git-ignored, never commit it):

```bash
export JWT_SECRET="$(openssl rand -base64 48)"
export ALLOWED_ORIGINS="http://localhost:5173"
go run .
```

---

## Authentication (REST)

| Endpoint | Method | Body (form-encoded) |
|---|---|---|
| `/api/signup` | POST | `username`, `password`, `email` (optional) |
| `/api/login` | POST | `username`, `password` |

Login returns:

```json
{ "token": "<jwt>", "username": "alice", "expires_in": 900 }
```

Errors are returned as `{"error": "message"}`.

### Rules

- **Username:** 3-32 characters, `a-z 0-9 _ . -` (lower-cased and trimmed).
- **Password:** 12-72 bytes (72 is bcrypt's hard limit).
- **Email:** optional, validated, max 254 characters.
- Credentials are read from the **request body only**, never the URL query string.

### Protections

- **Password hashing:** bcrypt, cost 12. Hashing happens outside the user-store lock so slow hashes can't block other requests.
- **User enumeration:** login always runs a bcrypt comparison (against a dummy hash for unknown users) and returns one generic error, so neither the message nor the response time reveals whether a username exists.
- **Brute force:**
  - Per-IP rate limit: 30 auth requests/minute.
  - Per-username lockout: 5 failed logins locks the username for 15 minutes (tracked for unknown usernames too).
- **Request limits:** bodies are capped at 8 KB.
- **IDs:** user IDs are random 128-bit values, not the username.
- **Responses:** built with `encoding/json` (no string concatenation), plus `Cache-Control: no-store`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a restrictive CSP and HSTS.
- **CORS:** explicit origin allowlist. `Access-Control-Allow-Origin: *` is never used.
- **Client IP:** taken from the TCP connection, not from `X-Forwarded-For` (which clients can spoof).

---

## JWT

- Algorithm: **HS256 only**. Tokens using any other algorithm (including `none`) are rejected.
- Required/validated claims: `exp`, `iss`, `aud`. Also issued: `sub` (user ID), `iat`, `nbf`, `jti`.
- Lifetime: **15 minutes** (`tokenTTL` in `auth.go`), with 30 seconds of clock leeway.
- Protected HTTP routes can use `AuthMiddleware`, which also checks that the user still exists.

---

## WebSocket (`/ws`)

### Connecting

Tokens are **no longer accepted in the URL** (`?token=...`), because URLs are written to server, proxy and browser logs.

Browser:

```js
const ws = new WebSocket(`wss://host/ws?room_id=${room}`, ["bearer", token]);
```

Non-browser clients can send `Authorization: Bearer <token>` instead.

### Protections

- **Origin check:** browser connections must come from `ALLOWED_ORIGINS` (prevents cross-site WebSocket hijacking). Clients that send no `Origin` header (CLI, mobile) are allowed but still need a valid JWT.
- **Token lifetime:** the socket is closed when the JWT that authorised it expires.
- **Spoofing:** `sender` and `room_id` are always set by the server, never trusted from client messages.
- **Room IDs:** must match `^[A-Za-z0-9_-]{1,64}$`.
- **Message limits:** 4096 bytes per message (`SetReadLimit`), `action` max 32 characters, 5 messages/second per connection (burst 10), after which the connection is closed.
- **Connection limits:** 60 connection attempts/minute per IP, 5 connections per user, 100 clients per room, 1000 rooms total. Empty rooms are deleted.
- **Liveness:** ping/pong heartbeat with read and write deadlines, so dead connections are dropped.
- **Slow clients:** a client that can't keep up is disconnected rather than stalling the room.

### HTTP server

`main.go` uses `http.Server` with header/read/write/idle timeouts (slowloris protection), a 16 KB header limit and graceful shutdown. These timeouts stop applying after a connection is upgraded to a WebSocket; `ws.go` manages its own deadlines.

---

## Known limitations / TODO

These are **not** solved yet. Do not treat the current build as production-ready without addressing them:

- **User storage is in memory.** Accounts disappear on restart. Needs a real database.
- **Rate limits and lockouts are per-process.** With multiple instances, use a shared store (e.g. Redis). Rooms are also per-process, so multi-instance needs pub/sub.
- **No room authorization.** Any logged-in user can join any valid room. The `canJoinRoom` hook in `ws.go` is where to add membership/invite checks.
- **No refresh tokens or revocation.** Access tokens last 15 minutes and sockets close at expiry, so users must log in again unless a refresh flow is added (or `tokenTTL` is raised). There is no logout-side invalidation of an issued token.
- **Username enumeration at signup.** "Username already taken" reveals existing usernames. Fully avoiding this needs email-verified signup.
- **No email verification or password reset.**
- **TLS is not enforced.** Without `TLS_CERT_FILE`/`TLS_KEY_FILE` the server speaks plain HTTP. Always use HTTPS/WSS in production.
- **Message content is relayed as-is.** Frontends must render chat content as text, never as HTML, to avoid XSS.

---

## Before you push or deploy

- [ ] `JWT_SECRET` is set via environment, and `.env` is in `.gitignore`.
- [ ] If an old hardcoded secret was ever committed, **rotate it**. Removing it from the code does not remove it from git history.
- [ ] `ALLOWED_ORIGINS` lists only your real frontends.
- [ ] The server runs behind HTTPS/WSS.
- [ ] The frontend connects with `["bearer", token]`, not `?token=`.

---
