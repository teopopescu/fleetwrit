# fleetwrit-server (v0 local)

The Fleetwrit dev server: FastAPI + SQLite, auth off, seeded demo data. It
implements the agent-facing `/v1` API the SDK calls and the dashboard-facing
read/decide API. Reuses the `fleetwrit` SDK's fingerprint so edited approvals
recompute identically.

## Run

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ../fleetwrit-python      # the SDK (shared fingerprint)
pip install -e .                        # this server
fleetwrit-server                        # or: uvicorn fleetwrit_server.app:app --port 4100
# → http://localhost:4100  (health at /healthz)
```

Point an agent at it with `FLEETWRIT_URL=http://localhost:4100` and the dashboard
with `VITE_FLEETWRIT_URL=http://localhost:4100`.

## Endpoints

Agent-facing: `POST /v1/agents/register`, `POST /v1/requests`,
`GET /v1/requests/{id}/decision?wait=`, `POST /v1/requests/{id}/ack`,
`POST /v1/requests/{id}/cancel`.

Dashboard-facing: `GET /v1/overview`, `GET /v1/inbox`, `GET /v1/requests/{id}`,
`POST /v1/requests/{id}/decide`, `GET /v1/agents`, `GET /v1/action-types`,
`GET /v1/ledger`, `GET /v1/ledger/verify`.

Operational: `GET /healthz`, `GET /.well-known/jwks.json`.

## Notes (v0)

SQLite file `fleetwrit-dev.db` (set `FLEETWRIT_DB`). Long-poll returns
`{"outcome":"pending"}` when undecided so the SDK re-polls. Receipts are signed
with an ephemeral Ed25519 key (rotates each restart). Set `FLEETWRIT_SEED=0` to
start empty.
