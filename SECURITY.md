
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

