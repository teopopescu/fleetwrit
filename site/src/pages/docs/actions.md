---
layout: ../../layouts/DocsLayout.astro
title: Defining actions
description: An action is defined once, in code, next to the function that performs it. The definition drives the fingerprint, the reviewer's screen, the default queue and the organisation's catalog.
---

## The decorator

```python
from fleetwrit import action, Money

@action(
    type="refund.issue",              # domain.verb, stable forever
    title="Issue refund",
    risk="high",                      # low | medium | high | critical
    reversible=False,
    queue="finance-ops",
    expires_in="30m",
    summary="Refund {amount} to customer on charge {charge}",
    display={"amount": Money(currency_field="currency")},
    editable=["amount"],
    redact=["card_last4"],
    subjects=["customer_id"],
    owner="payments-platform@acme.com",
)
def issue_refund(charge: str, amount: int, currency: str) -> str:
    return stripe.refunds.create(charge=charge, amount=amount, currency=currency).id
```

## Fields

| Field | Required | Effect |
| --- | --- | --- |
| `type` | Yes | Catalog key. Convention `domain.verb`; renaming creates a new action. |
| `title`, `summary` | Yes | What the reviewer reads first. `summary` is a template over the args. |
| `risk` | Yes | Sort order in the inbox. `critical` forces typed confirmation and a fresh IdP sign-in. |
| `reversible` | Yes | `False` forces typed confirmation on review. |
| args schema | Derived | JSON Schema from type hints or a Pydantic model; validated before the request is created. |
| `editable` | No | Fields a reviewer may change. Everything else is read-only on their screen. Default: none. |
| `display` | No | Render hints: `Money`, `Diff`, `Code`, `Link`, `Table`. |
| `queue`, `expires_in`, `on_expiry` | No | Defaults a call can override. |
| `redact` | No | Fields hashed in the SDK before they leave the agent process. |
| `subjects` | No | Args that identify a person or resource, for privacy purges. |
| `owner` | No | Shown in the catalog: who to ask about this action. |

## Argument schemas

The args schema is derived from your type hints, or from a Pydantic model if you pass one. Arguments are validated against the schema **before** a request is created, so a malformed call fails locally instead of reaching a reviewer.

```python
from pydantic import BaseModel

class Refund(BaseModel):
    charge: str
    amount: int
    currency: str = "gbp"

@action(type="refund.issue", title="Issue refund", risk="high", reversible=False)
def issue_refund(args: Refund) -> str:
    ...
```

## Summaries and display hints

`summary` is a template rendered over the args, and it is the first line a reviewer reads. Display hints tell the dashboard how to render a field:

- `Money(currency_field="currency")` renders `4000` as `£40.00`.
- `Diff` shows a before/after for edits.
- `Code`, `Link`, `Table` render the obvious way.

## Redaction

Fields listed in `redact` are hashed inside the SDK before the request leaves your process, so sensitive values never reach the server in the clear. The reviewer sees a stable hash, not the value.

## Versioning

The action **version** is a hash of the args schema. Change the schema and you get a new version automatically; old requests keep rendering with the version they were created under. The `type` stays stable across versions — rename the `type` only when you mean to create a genuinely new action.

## Undeclared actions

For quick starts you can skip the decorator:

```python
from fleetwrit import Action
fw.approve(Action(type="deploy.rollback", args={"service": "payments-api", "version": 41}))
```

This still works, but the catalog marks the type **undeclared** so a platform owner can see the gap and get it defined.

## Lint in CI

```bash
fleetwrit actions lint
```

Fails the build on a missing summary, an unknown display hint, or a `type` that breaks the `domain.verb` convention. Run it in CI so a bad action definition never ships.

## Next steps

- [Asking a human](/docs/asking) — how `approve`, `input` and `choose` behave.
- [Policy engines](/docs/policy) — decide *when* to ask.
