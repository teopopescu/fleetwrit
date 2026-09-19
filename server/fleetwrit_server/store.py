"""SQLite store for the Fleetwrit v0 local server.

Agents, action types, requests, decisions and a hash-chained ledger; signs
receipts with Ed25519. Reuses the SDK fingerprint so edits recompute identically.
Schema lives in schema.sql.
"""

from __future__ import annotations

import base64
import hashlib
import json
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from fleetwrit.fingerprint import fingerprint as fw_fingerprint

_LOCK = threading.RLock()
KID = "fleetwrit-dev-1"
_SCHEMA = Path(__file__).with_name("schema.sql")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _canon(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _b64(obj: dict[str, Any]) -> str:
    return _b64b(json.dumps(obj, separators=(",", ":")).encode("utf-8"))


def _b64b(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


class Store:
    def __init__(self, path: str = "fleetwrit-dev.db") -> None:
        self.path = path
        self._key = Ed25519PrivateKey.generate()
        # One persistent autocommit connection, serialized by _LOCK: a single-
        # process dev server, so nested writes (e.g. decide -> ledger) can't
        # deadlock two WAL writers.
        self._db = sqlite3.connect(path, timeout=10, check_same_thread=False, isolation_level=None)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("PRAGMA busy_timeout=5000")
        with _LOCK:
            self._db.executescript(_SCHEMA.read_text())

    @contextmanager
    def _cx(self) -> Iterator[sqlite3.Connection]:
        yield self._db

    # --- ledger ---
    def append_ledger(self, actor: str, event: str, payload: dict[str, Any], refs: dict[str, Any]) -> None:
        with _LOCK, self._cx() as c:
            row = c.execute("SELECT hash FROM ledger ORDER BY seq DESC LIMIT 1").fetchone()
            prev = row["hash"] if row else "genesis"
            ts = _now()
            ph = _sha(_canon(payload))
            digest = _sha("|".join([prev, ts, actor, event, ph, _canon(refs)]))
            c.execute("INSERT INTO ledger(ts,actor,event,payload_hash,refs,prev_hash,hash) VALUES(?,?,?,?,?,?,?)", (ts, actor, event, ph, _canon(refs), prev, digest))

    def ledger(self, limit: int = 200) -> list[dict[str, Any]]:
        with _LOCK, self._cx() as c:
            rows = c.execute("SELECT * FROM ledger ORDER BY seq DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    def verify_chain(self) -> dict[str, Any]:
        with _LOCK, self._cx() as c:
            rows = c.execute("SELECT * FROM ledger ORDER BY seq ASC").fetchall()
        prev = "genesis"
        for r in rows:
            if r["prev_hash"] != prev:
                return {"ok": False, "broken_seq": r["seq"]}
            digest = _sha("|".join([prev, r["ts"], r["actor"], r["event"], r["payload_hash"], r["refs"]]))
            if digest != r["hash"]:
                return {"ok": False, "broken_seq": r["seq"]}
            prev = r["hash"]
        return {"ok": True, "events": len(rows)}

    # --- registry ---
    def register(self, agent: dict[str, Any], action_types: list[dict[str, Any]], runtime: str | None = None) -> None:
        with _LOCK, self._cx() as c:
            c.execute("INSERT INTO agents(agent_id,environment,version,runtime,owner,last_seen) VALUES(?,?,?,?,?,?) ON CONFLICT(agent_id,environment) DO UPDATE SET version=excluded.version, last_seen=excluded.last_seen, runtime=COALESCE(excluded.runtime, agents.runtime)", (agent["id"], agent.get("environment", "prod"), agent.get("version"), runtime, None, _now()))
            for d in action_types:
                c.execute("INSERT INTO action_types(type,version,title,risk,reversible,editable,queue,owner,summary,args_schema,display,undeclared,approval_rate) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,?) ON CONFLICT(type) DO UPDATE SET version=excluded.version, title=excluded.title, risk=excluded.risk, reversible=excluded.reversible, editable=excluded.editable, queue=excluded.queue, owner=excluded.owner, summary=excluded.summary, display=excluded.display, undeclared=0", (d.get("type"), d.get("version"), d.get("title"), d.get("risk", "medium"), 1 if d.get("reversible", True) else 0, _canon(d.get("editable", [])), d.get("queue"), d.get("owner"), d.get("summary"), _canon(d.get("args_schema", {})), _canon(d.get("display", {})), d.get("approval_rate")))
        self.append_ledger(agent["id"], "agent.registered", agent, {"agent": agent["id"]})

    def agents(self) -> list[dict[str, Any]]:
        with _LOCK, self._cx() as c:
            rows = c.execute("SELECT * FROM agents ORDER BY last_seen DESC").fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["disabled"] = bool(d["disabled"])
            out.append(d)
        return out

    def action_types(self) -> list[dict[str, Any]]:
        with _LOCK, self._cx() as c:
            rows = c.execute("SELECT * FROM action_types ORDER BY type").fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["editable"] = json.loads(d.get("editable") or "[]")
            d["reversible"] = bool(d["reversible"])
            d["undeclared"] = bool(d["undeclared"])
            out.append(d)
        return out

    def _action_type(self, type_: str) -> dict[str, Any] | None:
        with _LOCK, self._cx() as c:
            r = c.execute("SELECT * FROM action_types WHERE type=?", (type_,)).fetchone()
        return dict(r) if r else None

    # --- requests ---
    def create_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        idem = payload["idempotency_key"]
        with _LOCK, self._cx() as c:
            existing = c.execute("SELECT id FROM requests WHERE idempotency_key=?", (idem,)).fetchone()
            if existing:
                return {"id": existing["id"], "state": "reattached"}
        action = payload["action"]
        at = self._action_type(action["type"])
        risk = (at or {}).get("risk", "medium")
        editable = json.loads((at or {}).get("editable") or "[]")
        title = (at or {}).get("title") or action["type"]
        display = (at or {}).get("display") or "{}"
        rid = "req_" + uuid.uuid4().hex[:12]
        ag = payload["agent"]
        with _LOCK, self._cx() as c:
            c.execute("INSERT INTO requests(id,idempotency_key,kind,agent_id,environment,type,action_version,tool,args,reversible,fingerprint,summary,context,queue,provenance,risk,editable,title,display,created_at,expires_at,on_expiry,state,verdict) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (rid, idem, payload["kind"], ag["id"], ag.get("environment", "prod"), action["type"], action.get("version"), action.get("tool"), _canon(action["args"]), 1 if action.get("reversible", True) else 0, payload["fingerprint"], payload.get("summary"), _canon(payload.get("context", {})), payload.get("queue"), _canon(payload.get("provenance", {})), risk, _canon(editable), title, display, payload.get("created_at"), payload.get("expires_at"), payload.get("on_expiry", "reject"), "pending", "ask"))
            if at is None:
                c.execute("INSERT OR IGNORE INTO action_types(type,version,title,risk,reversible,editable,queue,owner,summary,args_schema,display,undeclared,approval_rate) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,NULL)", (action["type"], action.get("version"), action["type"], risk, 1 if action.get("reversible", True) else 0, "[]", payload.get("queue"), None, payload.get("summary"), "{}", "{}"))
            c.execute("UPDATE agents SET last_seen=? WHERE agent_id=?", (_now(), ag["id"]))
        self.append_ledger(ag["id"], "request.created", {"fingerprint": payload["fingerprint"], "type": action["type"]}, {"request": rid})
        self.append_ledger("opa", "policy.verdict", {"engine": "opa", "verdict": "ask", "type": action["type"]}, {"request": rid})
        return {"id": rid, "state": "pending"}

    def get_request(self, rid: str) -> dict[str, Any] | None:
        with _LOCK, self._cx() as c:
            r = c.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
            d = c.execute("SELECT * FROM decisions WHERE request_id=?", (rid,)).fetchone()
        if not r:
            return None
        req = dict(r)
        for k in ("args", "context", "provenance", "editable", "display"):
            req[k] = json.loads(req[k] or ("[]" if k == "editable" else "{}"))
        req["reversible"] = bool(req["reversible"])
        if d:
            dd = dict(d)
            dd["final_args"] = json.loads(dd["final_args"] or "{}")
            dd["reviewer"] = json.loads(dd["reviewer"]) if dd["reviewer"] else None
            req["decision"] = dd
        return req

    def inbox(self) -> list[dict[str, Any]]:
        with _LOCK, self._cx() as c:
            rows = c.execute("SELECT id FROM requests WHERE state='pending' ORDER BY created_at ASC").fetchall()
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        reqs = []
        for row in rows:
            self._maybe_expire(row["id"])
            req = self.get_request(row["id"])
            if req and req["state"] == "pending":
                reqs.append(req)
        reqs.sort(key=lambda r: (order.get(r["risk"], 2), r["expires_at"] or ""))
        return reqs

    def mark_viewed(self, rid: str, who: str) -> None:
        with _LOCK, self._cx() as c:
            r = c.execute("SELECT viewed_at FROM requests WHERE id=?", (rid,)).fetchone()
            if r and not r["viewed_at"]:
                c.execute("UPDATE requests SET viewed_at=? WHERE id=?", (_now(), rid))
                self.append_ledger(who, "request.viewed", {}, {"request": rid})

    def _maybe_expire(self, rid: str) -> None:
        with _LOCK, self._cx() as c:
            r = c.execute("SELECT state, expires_at FROM requests WHERE id=?", (rid,)).fetchone()
            if not r or r["state"] != "pending" or not r["expires_at"]:
                return
            try:
                exp = datetime.strptime(r["expires_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            except ValueError:
                return
            if datetime.now(timezone.utc) <= exp:
                return
            c.execute("UPDATE requests SET state='expired' WHERE id=?", (rid,))
        self.append_ledger("system", "request.expired", {}, {"request": rid})

    def decision(self, rid: str) -> dict[str, Any] | None:
        self._maybe_expire(rid)
        with _LOCK, self._cx() as c:
            r = c.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
            d = c.execute("SELECT * FROM decisions WHERE request_id=?", (rid,)).fetchone()
        if not r:
            return None
        if r["state"] == "pending":
            return {"outcome": "pending"}
        if not d:
            return {"outcome": r["state"]}
        return {
            "outcome": d["outcome"],
            "action": {"type": r["type"], "version": r["action_version"], "tool": r["tool"], "args": json.loads(d["final_args"] or r["args"]), "reversible": bool(r["reversible"])},
            "original_fingerprint": d["original_fingerprint"], "final_fingerprint": d["final_fingerprint"],
            "reason": d["reason"], "reviewer": json.loads(d["reviewer"]) if d["reviewer"] else None,
            "receipt": d["receipt"], "value": d["value"], "option": d["option"],
        }

    def decide(self, rid: str, outcome: str, edits: dict[str, Any] | None, reason: str | None, reviewer: dict[str, Any]) -> dict[str, Any]:
        self._maybe_expire(rid)
        req = self.get_request(rid)
        if not req:
            raise KeyError(rid)
        if req["state"] != "pending":
            raise ValueError(f"request is {req['state']}, not pending")
        self.mark_viewed(rid, reviewer.get("email", "reviewer"))
        args = dict(req["args"])
        editable = set(req["editable"])
        applied = {k: v for k, v in (edits or {}).items() if k in editable}
        args.update(applied)
        final_outcome = "rejected" if outcome == "rejected" else ("approved_with_edits" if applied else "approved")
        final_fp = fw_fingerprint(type=req["type"], version=req["action_version"], tool=req["tool"], args=args, agent_id=req["agent_id"], environment=req["environment"])
        receipt = self._sign(rid, final_fp, final_outcome, reviewer) if final_outcome != "rejected" else None
        with _LOCK, self._cx() as c:
            c.execute("INSERT OR REPLACE INTO decisions(request_id,outcome,final_args,original_fingerprint,final_fingerprint,reason,reviewer,receipt,decided_at) VALUES(?,?,?,?,?,?,?,?,?)", (rid, final_outcome, _canon(args), req["fingerprint"], final_fp, reason, _canon(reviewer), receipt, _now()))
            c.execute("UPDATE requests SET state=? WHERE id=?", (final_outcome, rid))
        self.append_ledger(reviewer.get("email", "reviewer"), "decision.made", {"outcome": final_outcome, "final_fingerprint": final_fp, "edits": applied, "reason": reason}, {"request": rid})
        return self.decision(rid) or {}

    def ack(self, rid: str) -> None:
        with _LOCK, self._cx() as c:
            d = c.execute("SELECT consumed_at FROM decisions WHERE request_id=?", (rid,)).fetchone()
            if d and not d["consumed_at"]:
                c.execute("UPDATE decisions SET consumed_at=? WHERE request_id=?", (_now(), rid))
                self.append_ledger("agent", "decision.consumed", {}, {"request": rid})

    def cancel(self, rid: str) -> None:
        with _LOCK, self._cx() as c:
            c.execute("UPDATE requests SET state='cancelled' WHERE id=? AND state='pending'", (rid,))
        self.append_ledger("agent", "request.cancelled", {}, {"request": rid})

    def toggle_agent(self, agent_id: str) -> None:
        with _LOCK, self._cx() as c:
            c.execute("UPDATE agents SET disabled=1-disabled WHERE agent_id=?", (agent_id,))

    # --- overview ---
    def overview(self) -> dict[str, Any]:
        with _LOCK, self._cx() as c:
            pending = [dict(r) for r in c.execute("SELECT risk,queue,created_at FROM requests WHERE state='pending'").fetchall()]
            decided = c.execute("SELECT COUNT(*) n FROM decisions").fetchone()["n"]
            approved = c.execute("SELECT COUNT(*) n FROM requests WHERE state IN ('approved','approved_with_edits')").fetchone()["n"]
            expired = c.execute("SELECT COUNT(*) n FROM requests WHERE state='expired'").fetchone()["n"]
            undeclared = c.execute("SELECT COUNT(*) n FROM action_types WHERE undeclared=1").fetchone()["n"]
            runtimes = [dict(r) for r in c.execute("SELECT runtime, COUNT(*) n FROM agents GROUP BY runtime").fetchall()]
        by_queue: dict[str, int] = {}
        high = 0
        for p in pending:
            by_queue[p["queue"] or "unrouted"] = by_queue.get(p["queue"] or "unrouted", 0) + 1
            if p["risk"] in ("high", "critical"):
                high += 1
        return {
            "pending": len(pending), "pending_high": high, "pending_by_queue": by_queue,
            "oldest": min((p["created_at"] for p in pending), default=None),
            "decisions_total": decided, "approved": approved, "expired": expired, "undeclared": undeclared,
            "agents_by_runtime": {(r["runtime"] or "unknown"): r["n"] for r in runtimes},
            "chain": self.verify_chain(),
        }

    # --- receipts ---
    def _sign(self, rid: str, fp: str, outcome: str, reviewer: dict[str, Any]) -> str:
        header = {"alg": "EdDSA", "typ": "JWT", "kid": KID}
        payload = {"request_id": rid, "fingerprint": fp, "outcome": outcome, "sub": reviewer.get("subject", reviewer.get("email", "reviewer")), "iss": reviewer.get("issuer", "https://fleetwrit.local"), "iat": int(time.time())}
        signing_input = f"{_b64(header)}.{_b64(payload)}"
        return f"{signing_input}.{_b64b(self._key.sign(signing_input.encode('ascii')))}"

    def jwks(self) -> dict[str, Any]:
        from cryptography.hazmat.primitives import serialization

        raw = self._key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        return {"keys": [{"kty": "OKP", "crv": "Ed25519", "kid": KID, "x": _b64b(raw)}]}
