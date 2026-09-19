# Run the Fleetwrit stack with Docker

A minimal local stack: the **server** (FastAPI + SQLite, auto-seeded with demo
data) and the **dashboard** (the React ops console, built in live mode against
the server). For local/demo use only — auth is off and data lives in SQLite.

> **Prefer no Docker?** From a clone of this repo:
> ```bash
> pip install -e ./server -e ./fleetwrit-python
> fleetwrit dev            # or: fleetwrit-server dev
> ```
> One command runs the server + dashboard (auto-picks a free port if `:4100` is
> taken). It starts **empty** — point `FLEETWRIT_URL=http://localhost:4100` at it
> and develop against it. Flags: `--port`, `--no-dashboard`, `--demo` (load sample
> data), `--dashboard-port`.

## Prerequisites

- Docker Desktop (or any Docker engine) running, with Docker Compose v2+.

## Start

```bash
docker compose up --build
```

Then open:

- **Dashboard** — http://localhost:5174
- **Server API** — http://localhost:4100 (e.g. http://localhost:4100/healthz)

Stop with `Ctrl-C`; remove containers and the seeded database with:

```bash
docker compose down -v
```

## How it fits together

- `server/Dockerfile` installs the sibling SDK (`fleetwrit-python`) and the
  server, then runs `uvicorn` on port 4100. The SQLite database is stored in a
  named volume (`fleetwrit-data`) so it survives restarts.
- `dashboard/Dockerfile` builds the Vite SPA and serves the static output with
  nginx on port 80 (published as 5174).
- The dashboard talks to the server **from your browser**, so its server URL is
  baked at build time as `VITE_FLEETWRIT_URL=http://localhost:4100` (see the
  `args` in `docker-compose.yml`). Change it there if you publish the server on
  a different host or port, then rebuild.

## Notes

- The dashboard only enters live mode when `VITE_FLEETWRIT_URL` is set at build
  time; without it, it renders bundled demo/seed data instead.
- This is a single-process dev server. Postgres, OIDC sign-in, notifications and
  HA are not part of this compose file — see the roadmap.
