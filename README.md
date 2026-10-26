# room-engine

A real-time room app with authentication and WebSockets, built as an alternative to the fakeness of social media.

> ⚠️ **Status: early development.** Not production ready. Dev credentials in the code are for local use only.


i am just tired of this social media, and how fake it is.
i am also tired of my laziness, i hate wasting time even though i do it all the time, but i want to change that, through building a revolutionary web app, that has a new, creative idea with robust, efficient, and secure engineering. i am not a senior engineer or elite security researcher yet, i am just a curious kid who wants to build things to see systems at a lower and multi layered levels.



`` let's see where this project takes us `` 


## Frontend & Design

The UI uses a dark, celestial theme built with React, TypeScript and Tailwind.

- **Interactive starfield** (`Starfield.tsx`): a canvas background with parallax depth that follows the cursor, constellation lines near the pointer, occasional shooting stars, and a hyperspace "warp" effect. It is sharp on high-DPI screens and respects `prefers-reduced-motion`.
- **Auth pages** (`Login.tsx`, `Signup.tsx`, `AuthShell.tsx`): a glass card that tilts toward the cursor with a pointer-following spotlight, an orbiting logo, glowing inputs, a show/hide password toggle and a password strength meter. A successful login plays the warp animation.
- **Dashboard** (`Home.tsx`): animated room cards with cursor spotlights, a "Random Adventure" button that warps you into a random room, and an engine status badge that takes real connection state.
- **Auth client** (`authApi.ts`): shared API base URL (`VITE_API_URL`) and error handling. Forms validate input client-side using the same rules as the server and show the server's error messages.
- **Accessibility:** labelled inputs, `autocomplete` attributes, focus rings, `role="alert"` on errors, and semantic `nav` / `main` landmarks.


## Configuration & Security

Set these environment variables before running:

- `JWT_SECRET` (required, 32+ chars)
- `ALLOWED_ORIGINS` (e.g. `http://localhost:5173`)

See [SECURITY.md](SECURITY.md) for the full security model and known limitations.

**WebSocket clients:** connect with `new WebSocket(url, ["bearer", token])`. Tokens in the URL are no longer accepted.


## Tech stack

- **Go:** auth, and WebSocket server
- **FastAPI:** Python service *(in progress)*
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Database:** PostgreSQL
- **Infra:** Docker, Docker Compose, redis,...