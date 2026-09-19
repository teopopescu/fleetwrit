"""Server store tests for the P1 fixes: expiry enforcement and ledger integrity."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from fleetwrit_server.store import Store


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _payload(idem: str, expires_at: str) -> dict:
    return {
        "schema": "fleetwrit/v1",
        "kind": "approve",
        "agent": {"id": "a", "environment": "prod"},
        "action": {"type": "pay.vendor", "version": "1", "tool": "t", "args": {"amount": 1}, "reversible": True},
        "fingerprint": "sha256:" + "0" * 64,
        "summary": "pay",
        "context": {},
        "queue": "payments",
        "provenance": {},
        "idempotency_key": idem,
        "created_at": _iso(datetime.now(timezone.utc)),
        "expires_at": expires_at,
        "on_expiry": "reject",
    }


def test_past_deadline_expires_and_blocks_decide(tmp_path) -> None:
    store = Store(str(tmp_path / "expiry.db"))
    past = _iso(datetime.now(timezone.utc) - timedelta(minutes=1))
    rid = store.create_request(_payload("k1", past))["id"]

    assert store.decision(rid)["outcome"] == "expired"
    with pytest.raises(ValueError):
        store.decide(rid, "approved", None, None, {"email": "r@x.com"})


def test_future_deadline_stays_pending(tmp_path) -> None:
    store = Store(str(tmp_path / "future.db"))
    future = _iso(datetime.now(timezone.utc) + timedelta(hours=1))
    rid = store.create_request(_payload("k2", future))["id"]
    assert store.decision(rid)["outcome"] == "pending"


def test_ledger_actor_tamper_detected(tmp_path) -> None:
    store = Store(str(tmp_path / "ledger.db"))
    store.append_ledger("alice@x.com", "decision.made", {"outcome": "approved"}, {"request": "r1"})
    assert store.verify_chain()["ok"] is True

    with store._cx() as c:
        c.execute("UPDATE ledger SET actor='mallory@x.com' WHERE seq=(SELECT MAX(seq) FROM ledger)")

    assert store.verify_chain()["ok"] is False


def test_ledger_timestamp_tamper_detected(tmp_path) -> None:
    store = Store(str(tmp_path / "ledger2.db"))
    store.append_ledger("alice@x.com", "decision.made", {"outcome": "approved"}, {"request": "r1"})
    with store._cx() as c:
        c.execute("UPDATE ledger SET ts='2000-01-01T00:00:00Z' WHERE seq=(SELECT MAX(seq) FROM ledger)")
    assert store.verify_chain()["ok"] is False
