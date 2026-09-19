---
layout: ../../layouts/DocsLayout.astro
title: Quickstart
description: From pip install to a first approved action in about ten minutes, on your own laptop, with nothing but Python.
---

## 1. Install

Fleetwrit ships as a single package. The `dev` extra pulls in a local server so you can run the whole loop without Docker or Node.

```bash
pip install --pre "fleetwrit[dev]"
```

## 2. Start the local server

`fleetwrit dev` runs the server, an embedded SQLite store and the dashboard on `http://localhost:4100`, with authentication off and 30 days of seeded demo history so screens are never empty.

```bash
fleetwrit dev
# → dashboard on http://localhost:4100
# → API on   http://localhost:4100/v1
```

Leave it running and open a second terminal for your agent.

## 3. Define an action

An action is defined once, in code, next to the function that performs it. The definition drives the fingerprint, the reviewer's screen and the catalog.

```python
from fleetwrit import action

@action(
    type="deploy.rollback",      # domain.verb, stable forever
    title="Roll back deployment",
    risk="high",                 # low | medium | high | critical
    reversible=False,            # forces typed confirmation on review
    editable=["version"],        # only this field can be changed on review
    summary="Roll back {service} to version {version}",
)
def rollback_deployment(service: str, version: int) -> str:
    ...  # your real rollback
    return "rolled-back"
```

## 4. Ask a human

`fw.approve()` creates a request, waits durably, and returns a typed decision. It blocks until a reviewer decides or the request expires.

```python
import fleetwrit

fw = fleetwrit.Client()   # reads FLEETWRIT_URL and FLEETWRIT_API_KEY

decision = fw.approve(
    rollback_deployment.action(service="payments-api", version=41),
    context={"alert": "PD-4471", "p95_ms": 920},
)

if decision.approved:
    with decision.authorize():                 # passes only for the approved action
        rollback_deployment(**decision.action.args)
else:
    print("Not approved:", decision.reason)
```

Point the client at your local server:

```bash
export FLEETWRIT_URL=http://localhost:4100
export FLEETWRIT_API_KEY=dev-local        # any value in dev mode
python rollback_agent.py
```

The script now blocks, waiting for a decision.

## 5. Approve it

Open `http://localhost:4100`, go to the **Inbox**, and open the pending request. You will see the summary, the exact arguments, the risk and the context. Change `version` if you like (it is the only editable field), give a one-line reason, and press **Approve**.

Your script unblocks. `decision.action.args` holds the reviewer's version — not necessarily the one the agent proposed — so the rollback runs against exactly what was approved.

## 6. Prove it happened

Every event is written to a hash-chained ledger. Verify the chain at any time:

```bash
fleetwrit ledger verify      # walks the chain, reports the first break
fleetwrit ledger export      # JSONL with the chain head, for an auditor
```

---

## What you just built

- An action gated behind a **named human**, with the decision bound to one exact fingerprint.
- A **signed receipt** the agent carries when it resumes.
- A **tamper-evident record** of who authorised what, and when.

## Next steps

- [Defining actions](/docs/actions) — risk, summaries, display hints, redaction and versioning.
- [Asking a human](/docs/asking) — edits, expiry, idempotency and durable resume.
- [Integrations](/docs/integrations) — wrap your framework's own pause-and-resume.
- [Identity](/docs/identity) — swap dev mode for Okta or Entra sign-in.
