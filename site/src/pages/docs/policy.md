---
layout: ../../layouts/DocsLayout.astro
title: Policy engines
description: Fleetwrit does not decide when to ask. A policy engine returns one of three verdicts — allow, deny or ask — and the SDK acts on it.
---

## The contract

```
allow → execute now
deny  → raise PolicyDenied
ask   → fw.approve, then execute only if approved
```

Every verdict is written to the ledger, including `allow` and `deny`, so the record shows what was **never** sent to a human, and why.

## The guard

`fw.guard()` wraps a call: it asks the policy engine first, and only asks a human if the verdict is `ask`.

```python
from fleetwrit.policy import OPA

guard = fw.guard(policy=OPA(url="http://opa:8181", path="agents/actions/verdict"))

result = guard.run(issue_refund, charge="ch_123", amount=400000, currency="gbp")
```

`guard.run()` executes `decision.action` automatically on approval, so edits are honoured without extra code.

## Options

| Option | How it plugs in |
| --- | --- |
| Python predicate | `@action(ask_when=lambda a: a.amount > 50_000)` |
| Open Policy Agent | `OPA(url, path)`; the rule returns `allow`, `deny` or `ask`. |
| Cedar | `Cedar(policies, entities)` via `cedarpy`. |
| Custom | Implement `Policy.evaluate(action, principal, context) -> Verdict`. |

## Open Policy Agent

Your Rego rule returns a verdict, and optionally a `queue` and `expires_in`:

```rego
package agents.actions

default verdict := {"decision": "allow"}

# Ask a human for any irreversible high-risk action
verdict := {"decision": "ask", "queue": "sre-oncall", "expires_in": "30m"} {
    input.action.reversible == false
    input.action.risk == "high"
}

# Never allow refunds over £10,000
verdict := {"decision": "deny"} {
    input.action.type == "refund.issue"
    input.action.args.amount > 1000000
}
```

## Verifying signed receipts

Every approval carries a compact JWS receipt: request id, fingerprint, outcome, reviewer subject and issuer, authentication time and expiry. A policy engine can require **proof** that a human approved this exact call, not merely a flag saying so.

In OPA, verify it against Fleetwrit's published keys:

```rego
import future.keywords.if

receipt_valid if {
    io.jwt.decode_verify(input.fleetwrit_receipt, {
        "cert": data.fleetwrit.jwks,   # from /.well-known/jwks.json
        "aud":  "fleetwrit",
    })
}
```

Cedar cannot verify signatures itself, so a gateway interceptor verifies the receipt and passes `fleetwrit_receipt_valid` into the Cedar context.

## Worked example: gating refunds with Cedar

A refunds agent can issue Stripe refunds. Small ones are fine automatically; anything over £1,000 needs a named human, and Finance must be able to prove who approved which refund. This is the full path, from what you need to who signs off.

### What you need first

Most of this you already have — Fleetwrit sits between these pieces, it does not replace them.

- **A tool with a real side effect** — a function that calls `stripe.refunds.create(...)`. Amounts are minor units, so `400000` is £4,000.
- **Cedar policies you already run** — your `.cedar` files and `entities.json`, evaluated through `cedarpy`. This is where "when do we even ask?" lives.
- **An identity provider** — Okta or Entra. Reviewers sign in with their work account; Fleetwrit uses your IdP, it is not one.
- **A queue of reviewers** — a `finance-ops` queue whose members come from an IdP group.
- **A Fleetwrit server and an agent API key**, plus `pip install "fleetwrit[cedar]"`.

### The policy

Cedar answers *allow* or *forbid* from the `context` you give it. The pattern: a `forbid` that hinges on the receipt key becomes an **ask** — the SDK sends it to a human, gets a receipt, and re-evaluates.

```cedar
// Small refunds: allowed outright.
permit (
  principal,
  action == Action::"refund.issue",
  resource
)
when { context.amount <= 100000 };   // <= £1,000

// Large refunds: forbidden UNLESS a verified human-approval receipt is present.
forbid (
  principal,
  action == Action::"refund.issue",
  resource
)
when   { context.amount > 100000 }
unless { context.fleetwrit_receipt_valid == true };
```

Cedar reads `context.fleetwrit_receipt_valid` but cannot check a signature. Fleetwrit's Cedar adapter verifies the receipt's JWS against the published [JWKS](/docs/security) and injects that boolean before Cedar evaluates — so the flag can only be true because a real, IdP-verified person approved this exact call.

### The agent

```python
import fleetwrit
from fleetwrit import action, Money
from fleetwrit.policy import Cedar

fw = fleetwrit.Client()  # FLEETWRIT_URL, FLEETWRIT_API_KEY from env

@action(
    type="refund.issue",
    title="Issue refund",
    risk="high",
    reversible=False,
    queue="finance-ops",
    editable=["amount"],                 # a reviewer may cut the amount
    summary="Refund {amount} to customer on charge {charge}",
    display={"amount": Money(currency_field="currency")},
)
def issue_refund(charge: str, amount: int, currency: str) -> str:
    return stripe.refunds.create(charge=charge, amount=amount, currency=currency).id

guard = fw.guard(policy=Cedar(policies="policies/*.cedar", entities="entities.json"))

# One call: evaluate Cedar, ask a human only if it must, run the approved action.
result = guard.run(issue_refund, charge="ch_123", amount=400000, currency="gbp")
```

`guard.run()`, step by step:

1. Builds the Cedar context (`amount=400000`, `fleetwrit_receipt_valid=false`).
2. Cedar evaluates → the `forbid` fires → Fleetwrit maps it to **ask**.
3. Fleetwrit fingerprints the exact call and **pauses durably** — surviving a process or server restart.
4. It routes the request to `finance-ops` (members from your IdP group) and notifies them.
5. A reviewer signs in, edits £4,000 → £500, gives a reason, approves. Fleetwrit issues a signed receipt bound to the **£500** fingerprint.
6. The adapter verifies that receipt, sets `fleetwrit_receipt_valid=true`, and re-evaluates → now **permit**.
7. `guard.run()` executes `decision.action` — the £500 call, never the original — and returns the refund id.

If you would rather run the action yourself, the explicit form shows the binding that keeps an edit safe:

```python
decision = fw.approve(issue_refund.action(charge="ch_123", amount=400000, currency="gbp"))
if decision.approved:
    with decision.authorize():          # refuses if the action != what was signed
        issue_refund(**decision.action.args)
else:
    agent.note(decision.reason)
```

### Where Fleetwrit fits, and could you do without it

Cedar decides *whether* to ask. It cannot capture the decision, prove who made it, or hold the agent while it waits. You could approximate that with an `if amount > 100000` check that posts to Slack and logs a row — but you would then be rebuilding, and mostly missing:

- **Proof, not a flag.** A boolean set from a Slack reaction proves nothing to an auditor; the receipt is signed and tied to an IdP identity and the exact fingerprint.
- **Durable, exactly-once resume.** A wait loop dies on restart or fires the refund twice; Fleetwrit re-attaches by idempotency key and accepts one terminal decision.
- **Safe edits.** `decision.authorize()` refuses to run anything but the signed £500 action.
- **Segregation of duties.** A log in the agent team's own database is the record auditors reject; Fleetwrit's [hash-chained ledger](/docs/security) lives outside the system it governs.

Your framework's native approval can *pause* the agent, but it cannot give the organisation cross-stack identity, a receipt Cedar can trust, or an independent record.

## A custom policy

```python
from fleetwrit.policy import Policy, Verdict

class BusinessHours(Policy):
    def evaluate(self, action, principal, context) -> Verdict:
        if action.risk == "critical":
            return Verdict.ask(queue="risk")
        return Verdict.allow()

guard = fw.guard(policy=BusinessHours())
```

## Next steps

- [Asking a human](/docs/asking) — what happens once the verdict is `ask`.
- [Security model](/docs/security) — how receipts are signed and rotated.
