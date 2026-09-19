"""Seed the dev server with synthetic agents, action types and a little history.

Idempotent: does nothing if agents already exist. Not real data — @acme.com only.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fleetwrit.fingerprint import fingerprint


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


AGENTS = [
    {"agent": {"id": "sre-remediation", "environment": "prod", "version": "0.1.0a3"}, "runtime": "LangGraph"},
    {"agent": {"id": "support-refunds", "environment": "prod", "version": "0.4.2"}, "runtime": "OpenAI Agents"},
    {"agent": {"id": "ap-invoices", "environment": "staging", "version": "0.11.0"}, "runtime": "LlamaIndex"},
]

ACTION_TYPES = [
    {"type": "deploy.rollback", "version": "a1", "title": "Roll back deployment", "risk": "high", "reversible": False,
     "editable": ["version"], "queue": "sre-oncall", "owner": "platform@acme.com",
     "summary": "Roll back {service} to version {version}", "approval_rate": 0.98},
    {"type": "service.restart", "version": "b2", "title": "Restart service", "risk": "medium", "reversible": True,
     "editable": [], "queue": "sre-oncall", "owner": "platform@acme.com", "summary": "Restart {service}", "approval_rate": 0.99},
    {"type": "refund.issue", "version": "c3", "title": "Issue refund", "risk": "high", "reversible": False,
     "editable": ["amount"], "queue": "finance-ops", "owner": "payments-platform@acme.com",
     "summary": "Refund {amount} on charge {charge}",
     "display": {"amount": {"kind": "money", "currency_field": "currency"}}, "approval_rate": 0.96},
    {"type": "payment.release", "version": "d4", "title": "Release vendor payment", "risk": "high", "reversible": False,
     "editable": ["amount"], "queue": "finance-ops", "owner": "ap@acme.com",
     "summary": "Release {amount} to {supplier}", "approval_rate": 0.9},
    {"type": "data.delete", "version": "e5", "title": "Delete customer records", "risk": "critical", "reversible": False,
     "editable": [], "queue": "privacy", "owner": "privacy@acme.com", "summary": "Delete {count} records", "approval_rate": 0.85},
]

AGENT_ACTIONS = {
    "sre-remediation": ["deploy.rollback", "service.restart", "data.delete"],
    "support-refunds": ["refund.issue"],
    "ap-invoices": ["payment.release"],
}


def _payload(agent: str, env: str, atype: str, aversion: str, tool: str | None, args: dict[str, Any],
             summary: str, queue: str, context: dict[str, Any], reversible: bool, mins_ago: int, ttl_min: int) -> dict[str, Any]:
    created = datetime.now(timezone.utc) - timedelta(minutes=mins_ago)
    fp = fingerprint(type=atype, version=aversion, tool=tool, args=args, agent_id=agent, environment=env)
    return {
        "schema": "fleetwrit/v1", "kind": "approve",
        "agent": {"id": agent, "environment": env, "version": None},
        "action": {"type": atype, "version": aversion, "tool": tool, "args": args, "reversible": reversible},
        "fingerprint": fp, "summary": summary, "context": context, "queue": queue,
        "provenance": {"run_id": "run_" + uuid.uuid4().hex[:8], "parent_request_id": None, "trace_id": None},
        "idempotency_key": "seed_" + uuid.uuid4().hex[:12],
        "created_at": _iso(created), "expires_at": _iso(created + timedelta(minutes=ttl_min)), "on_expiry": "reject",
    }


def seed_demo(store: Any) -> None:
    if store.agents():
        return
    for a in AGENTS:
        acts = [t for t in ACTION_TYPES if t["type"] in AGENT_ACTIONS[a["agent"]["id"]]]
        store.register(a["agent"], acts, a["runtime"])

    reviewer = {"subject": "marcus@acme.com", "email": "marcus@acme.com", "name": "Marcus Okonkwo", "issuer": "https://acme.okta.com"}

    # pending requests (populate the inbox)
    store.create_request(_payload("support-refunds", "prod", "refund.issue", "c3", "stripe.refunds.create",
        {"charge": "ch_123", "amount": 400000, "currency": "gbp"}, "Refund £4,000 on charge ch_123",
        "finance-ops", {"ticket": "ZD-99120", "prior_refunds": 0}, False, 6, 30))
    store.create_request(_payload("sre-remediation", "prod", "deploy.rollback", "a1", "kubectl.rollout.undo",
        {"service": "payments-api", "version": 42}, "Roll back payments-api to version 42",
        "sre-oncall", {"alert": "PD-4471", "p95_ms": 920}, False, 3, 30))
    store.create_request(_payload("sre-remediation", "prod", "data.delete", "e5", None,
        {"count": 2410, "scope": "stale-sessions"}, "Delete 2,410 stale session records",
        "privacy", {"policy": "gdpr-erasure"}, False, 1, 60))
    # an undeclared action type observed on ap-invoices -> shows a coverage gap
    store.create_request(_payload("ap-invoices", "staging", "vendor.payout", "z9", None,
        {"supplier": "INV-7781", "amount": 1250000, "currency": "gbp"}, "Vendor payout INV-7781",
        "finance-ops", {}, False, 8, 60))

    # a little decided history (for overview counts + the ledger)
    hist1 = store.create_request(_payload("support-refunds", "prod", "refund.issue", "c3", "stripe.refunds.create",
        {"charge": "ch_884", "amount": 400000, "currency": "gbp"}, "Refund £4,000 on charge ch_884",
        "finance-ops", {"ticket": "ZD-99044"}, False, 90, 30))
    store.decide(hist1["id"], "approved", {"amount": 50000}, "Approved at £500 per policy cap", reviewer)
    hist2 = store.create_request(_payload("sre-remediation", "prod", "deploy.rollback", "a1", "kubectl.rollout.undo",
        {"service": "search-indexer", "version": 12}, "Roll back search-indexer to version 12",
        "sre-oncall", {"alert": "PD-4460"}, False, 120, 30))
    store.decide(hist2["id"], "rejected", None, "Prefer forward-fix; rollback drops the new index", reviewer)
