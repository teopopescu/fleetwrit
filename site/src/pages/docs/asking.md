---
layout: ../../layouts/DocsLayout.astro
title: Asking a human
description: The SDK has three calls and one guard. Each creates a request, waits durably, and returns a typed decision.
---

## The three calls

| Call | Returns | Use |
| --- | --- | --- |
| `approve(action, ...)` | `approved`, `modified`, `action`, `reason`, `reviewer`, `receipt` | Yes, yes-with-edits, or no on one exact action. |
| `input(prompt, schema, ...)` | A validated value matching a JSON Schema | The agent is missing a fact only a human has. |
| `choose(prompt, options, ...)` | One option id | The agent has 2–6 candidate actions. |

```python
decision = fw.approve(
    issue_refund.action(charge="ch_123", amount=400000, currency="gbp"),
    context={"ticket": "ZD-99120", "prior_refunds": 0},
)

if decision.approved:
    with decision.authorize():
        issue_refund(**decision.action.args)
else:
    agent.note(decision.reason)
```

## authorize(): run only what was approved

`decision.authorize()` is a context manager that re-checks the fingerprint before the block runs. If the action no longer matches what the reviewer approved, it raises rather than executing. Always call `decision.action.args`, never the arguments you originally proposed.

## Approve with edits

A reviewer can change any field listed in the action's `editable` list before approving — for example cutting a refund from £4,000 to £500. When they do:

- The server validates the edited args against the schema and computes a **new fingerprint**.
- The receipt is issued for the **edited** action only.
- The decision records both the original and final fingerprints and the diff.
- In the SDK, `decision.modified` is `true` and `decision.action` holds the edited action.

```python
decision = fw.approve(issue_refund.action(charge="ch_123", amount=400000, currency="gbp"))

if decision.approved:
    with decision.authorize():
        issue_refund(**decision.action.args)   # the £500 the reviewer approved
```

The client cannot authorise the original £4,000 action: its fingerprint no longer matches the receipt.

## Expiry

Expiry is required. The default is one hour; the maximum is seven days.

```python
fw.approve(action, expires_in="30m", on_expiry="reject")
```

`on_expiry` is `reject` or `raise`. There is **no auto-approve on expiry**. A reminder is sent when 25% of the request's lifetime remains and it is still undecided.

## Idempotency and durable resume

Every call takes an `idempotency_key`, defaulting to a hash of the run id, step id and fingerprint. A retried call re-attaches to the open request instead of creating a second one.

- **Blocking mode** long-polls and survives a process restart: the SDK re-attaches by idempotency key.
- **Interrupt mode** raises the runtime's own interrupt and resumes from a signed webhook — see [Integrations](/docs/integrations).

The guarantee: for one request and one fingerprint, the server accepts **at most one terminal decision**, and a caller that re-attaches receives that same decision and no other.

## Failure mode

If the server is unreachable, the SDK retries with jittered backoff for 60 seconds and then raises `FleetwritUnavailable`. **It never fails open** — an action is never executed without a decision.

## Provenance

Optional `run_id`, `parent_request_id` and a W3C `trace_id` keep approvals attached across multi-agent chains and link them to your OpenTelemetry traces.

```python
fw.approve(action, run_id="run_77", trace_id="4bf92f...", parent_request_id="req_12")
```

## Counting tasks

Wrap agent tasks in `fw.task()` to feed the north-star metric (human minutes per 1,000 tasks). It is optional; when absent, the server counts distinct runs instead.

```python
with fw.task("triage-refund"):
    ...
```

## Next steps

- [Policy engines](/docs/policy) — decide when to ask a human at all.
- [Defining actions](/docs/actions) — mark fields editable, set expiry defaults.
