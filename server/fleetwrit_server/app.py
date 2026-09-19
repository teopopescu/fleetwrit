"""Fleetwrit v0 local server (the `fleetwrit dev` path): FastAPI + SQLite.

Implements the agent-facing /v1 API the SDK's HttpTransport calls, plus the
dashboard-facing read/decide API. Auth is off (local/demo mode). Long-poll
returns {"outcome":"pending"} when undecided so the SDK re-polls.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .store import Store
from .seed import seed_demo

store = Store(os.getenv("FLEETWRIT_DB", "fleetwrit-dev.db"))
app = FastAPI(title="Fleetwrit dev server", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Start empty by default — a local dev server is for your own data. Set
# FLEETWRIT_SEED=1 (or `fleetwrit dev --demo`) to load the sample agents/requests.
if os.getenv("FLEETWRIT_SEED", "0") == "1":
    seed_demo(store)


# --- agent-facing /v1 (key auth in prod; off in local mode) ----------------
@app.post("/v1/agents/register")
async def register(req: Request) -> dict[str, Any]:
    body = await req.json()
    store.register(body.get("agent", {}), body.get("action_types", []), body.get("runtime"))
    return {"ok": True}


@app.post("/v1/requests")
async def create_request(req: Request) -> JSONResponse:
    body = await req.json()
    try:
        return JSONResponse(store.create_request(body))
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)


@app.get("/v1/requests/{rid}/decision")
async def get_decision(rid: str, wait: int = 25) -> JSONResponse:
    deadline = asyncio.get_event_loop().time() + min(max(wait, 0), 25)
    while True:
        d = store.decision(rid)
        if d is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        if d.get("outcome") != "pending":
            return JSONResponse(d)
        if asyncio.get_event_loop().time() >= deadline:
            return JSONResponse({"outcome": "pending"})
        await asyncio.sleep(0.4)


@app.post("/v1/requests/{rid}/ack")
async def ack(rid: str) -> JSONResponse:
    try:
        store.ack(rid)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=409)
    return JSONResponse({"ok": True})


@app.post("/v1/requests/{rid}/cancel")
async def cancel(rid: str) -> dict[str, Any]:
    store.cancel(rid)
    return {"ok": True}


# --- dashboard-facing ------------------------------------------------------
@app.get("/v1/overview")
async def overview() -> dict[str, Any]:
    return store.overview()


@app.get("/v1/inbox")
async def inbox() -> dict[str, Any]:
    return {"requests": store.inbox()}


@app.get("/v1/requests/{rid}")
async def request_detail(rid: str) -> JSONResponse:
    r = store.get_request(rid)
    if not r:
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse(r)


@app.post("/v1/requests/{rid}/decide")
async def decide(rid: str, req: Request) -> JSONResponse:
    body = await req.json()
    reviewer = body.get("reviewer") or {
        "subject": "you@acme.com", "email": "you@acme.com",
        "name": "You", "issuer": "https://fleetwrit.local",
    }
    try:
        result = store.decide(rid, body.get("outcome", "approved"), body.get("edits"), body.get("reason"), reviewer, body.get("value"), body.get("option"))
    except KeyError:
        return JSONResponse({"error": "not found"}, status_code=404)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=409)
    return JSONResponse(result)


@app.get("/v1/agents")
async def agents() -> dict[str, Any]:
    return {"agents": store.agents()}


@app.post("/v1/agents/{aid}/toggle")
async def toggle_agent(aid: str) -> dict[str, Any]:
    store.toggle_agent(aid)
    return {"ok": True}


@app.get("/v1/action-types")
async def action_types() -> dict[str, Any]:
    return {"action_types": store.action_types()}


@app.get("/v1/ledger")
async def ledger() -> dict[str, Any]:
    return {"events": store.ledger()}


@app.get("/v1/ledger/verify")
async def ledger_verify() -> dict[str, Any]:
    return store.verify_chain()


# --- operational -----------------------------------------------------------
@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"ok": True}


@app.get("/.well-known/jwks.json")
async def jwks() -> dict[str, Any]:
    return store.jwks()


# --- bundled dashboard -----------------------------------------------------
# When the built dashboard is packaged into ./static, serve it at / so the whole
# app is one process on one port. Mounted last, so the API routes above win; a
# 404 falls back to index.html for the SPA's client-side routes.
_STATIC = Path(__file__).with_name("static")


class _SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Any) -> Any:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


if (_STATIC / "index.html").is_file():
    app.mount("/", _SPAStaticFiles(directory=str(_STATIC), html=True), name="dashboard")
