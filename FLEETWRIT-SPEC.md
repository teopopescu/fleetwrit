# Fleetwrit — Specification

*A synthesised, comprehensive specification of what Fleetwrit is, what it does, and what exists today. Written from the authoritative MVP spec, the product and design documents, the repository plan, and the code as actually built (SDK, v0 server, dashboard, protocol).*

---

## 1. Summary

Fleetwrit is the independent authorisation record for consequential AI-agent actions: one organisation-wide control point for who may authorise what an organisation's agents do. An agent stops immediately before a consequential action, a named human decides, the agent resumes on *exactly* that decision, and the resulting record is tamper-evident and lives outside the system being governed. Fleetwrit does not replace the pause-and-resume that agent frameworks now ship natively; it wraps them and owns what a single runtime cannot: cross-stack identity, a single review queue, an action inventory, signed receipts, and audit evidence that spans every stack an organisation runs.

The north-star metric is **human minutes per 1,000 agent tasks** — active review time (first view to decision, capped at 15 minutes per request), divided by task count, times 1,000. The one-line positioning is **"PagerDuty for what AI agents need from humans."** The milestone that matters is not a public release; it is a production team saying: *"We could use our framework's own approval feature, but we still need this, because it tells the organisation who authorised exactly what, across all our agents."*

Fleetwrit is Apache-2.0, Python-first, self-hostable, and deliberately scoped by evidence gates rather than a fixed build plan.

---

## 2. Problem & users

Teams running agents across more than one stack cannot answer, credibly, *who authorised a consequential action, why, and how long it waited.* Approvals scatter across Slack threads and framework-specific interrupts; nobody owns the queue; abandoned requests can freeze agents for hours; and the record, when it exists, sits inside the agent team's own database — which fails separation of duties for audit. Fleetwrit is explicitly **not** an identity provider for agents and **not** a policy engine. It signs people in through the IdP the company already runs and takes verdicts from the policy engine the company already runs.

| User | What they need |
| --- | --- |
| **Agent developer** | One call to pause for a human, durable resume, a native integration for the runtime they already use — no change to their checkpointing |
| **Reviewer** (ops, finance, SRE, often on-call at 02:00 on a phone) | One inbox, the exact action and its context, a decision in under a minute, signed in with their work account |
| **Platform / AI-governance owner** | One view of every agent, every gated action type, and every pending decision in the organisation |
| **Risk, audit, CISO** | A tamper-evident record of which IdP-verified person authorised exactly which action |

**Order of adoption.** The first design partners are **platform and SRE teams** running agentic remediation: their world already has queues, on-call ownership, change control, fail-closed habits, and consequential changes — the exact shape of this product. **Finance-ops** (accounts payable, refunds, payments) is the deliberate *second* vertical, held back so the terminology, compliance surface, and workflow variation are not doubled before the core value is proven.

Three journeys anchor the design: **Priya** (platform engineer) integrates a rollback action in an afternoon and kills the agent mid-wait to confirm the decision still arrives once; **Marcus** (on-call SRE) approves a rollback from his phone at 02:11, editing the one editable field; **Dana** (head of platform, with an auditor) answers "who authorised the 02:12 rollback?" from the dashboard and spots an undeclared action type as a governance gap.

---

## 3. Core concepts & objects

| Object | Meaning |
| --- | --- |
| **Action** | A concrete, consequential operation an agent wants to perform — a `type`, its `args`, and identity metadata (version, tool, reversibility). Defined once in code, next to the function that performs it. |
| **Action type** | The catalog entry for a class of action, keyed by a stable `domain.verb` string. Carries title, risk, reversibility, editable fields, args schema, display hints, and owner. |
| **Request** | One instance of an agent asking a human to decide about one action. Has a lifecycle state, a queue, an expiry, and a fingerprint. Its personal/customer content is held separately from its metadata. |
| **Decision** | The terminal human verdict on a request: approved, approved-with-edits, rejected, or answered/chosen. Records both the original and final fingerprint, the diff, the reviewer, and a signed receipt. |
| **Receipt** | A compact signed token (JWS/EdDSA) proving that a specific IdP-verified human approved this exact action. Verifiable independently by a policy engine or gateway. |
| **Queue** | The named destination a request routes to. Membership comes from IdP groups; every member sees the request and the first terminal decision wins. |
| **Ledger** | An append-only, hash-chained event log — the tamper-evident record of everything that happened, storing hashes and opaque identifiers rather than content. |
| **Fingerprint** | A SHA-256 over the canonical JSON of the action's identity, binding a decision to one exact action so a different action cannot execute under the same approval. |
| **Agent** | A registered caller: an id plus environment, with owner, runtime, SDK version, last-seen, and a scoped API key. |

---

## 4. The mechanism / request lifecycle

An agent creates a request, waits durably, and resumes on the decision. States:

```
pending ─┬─> viewed ─┬─> approved ───────────┐
         │           ├─> approved_with_edits ─┤
         │           ├─> rejected ────────────┼─> consumed
         │           └─> answered ────────────┘
         ├─> expired            (from pending or viewed)
         └─> cancelled          (agent no longer needs the answer)
```

- **Viewed** is recorded the first time a reviewer opens the request (it starts the review-time clock for the north-star metric).
- **Terminal** states are approved / approved_with_edits / rejected / answered (and the non-decision terminals expired / cancelled). A terminal decision is then **consumed** exactly once by the agent's acknowledgement.
- **Expiry is mandatory.** Default 1 hour, maximum 7 days. `on_expiry` is either `reject` or `raise`. There is **no auto-approve on expiry**, ever. A reminder is sent when 25% of a request's lifetime remains and it is still undecided. Once expired, no later human action can revive that request.
- **Fail-closed.** If the server is unreachable the SDK raises `FleetwritUnavailable` after retrying; it never fails open. A gated action never runs without a decision.

**The delivery guarantee, stated precisely.** "Exactly once" is shorthand, not a distributed-systems absolute. The guarantee is: *for one request and one fingerprint, the server accepts at most one terminal decision, and at most one acknowledgement of that decision succeeds.* A caller that re-attaches with the same idempotency key receives that same decision and no other. Decision writes and acknowledgements use row locks so two server replicas cannot both win, and two reviewers submitting simultaneously resolve to exactly one accepted decision (the other reviewer is told it was already decided and by whom). The SDK explicitly *cannot* stop an agent from re-running its own downstream side effect after a crash inside the `authorize()` block; the documentation says so and recommends passing the request id as an idempotency key to the downstream system.

---

## 5. SDK (`fleetwrit-python`)

Pure-Python (3.10+), sync-and-async in design, with a dependency floor of only `httpx`, `pydantic`, and `cryptography`. `pip install fleetwrit` is the front door; the client alias is `fw`.

### The three calls, one guard, and supporting calls

```python
import fleetwrit
fw = fleetwrit.Client()  # FLEETWRIT_URL, FLEETWRIT_API_KEY, FLEETWRIT_AGENT_ID, FLEETWRIT_ENVIRONMENT from env

decision = fw.approve(
    issue_refund.action(charge="ch_123", amount=400000, currency="gbp"),
    context={"ticket": "ZD-99120", "prior_refunds": 0},
)
if decision.approved:
    with decision.authorize():                 # passes only for the exact approved action
        issue_refund(**decision.action.args)   # always run decision.action, never the original
else:
    agent.note(decision.reason)
```

| Call | Returns | Use |
| --- | --- | --- |
| `approve(action, ...)` | `Decision`: `approved`, `modified`, `action`, `reason`, `reviewer`, `receipt` | Yes / yes-with-edits / no on one exact action |
| `input(prompt, schema=..., ...)` | A value validated against a JSON Schema | The agent is missing a fact only a human has |
| `choose(prompt, options, ...)` | One option id | The agent has 2–6 candidate actions |
| `decision.authorize()` | Context manager | Blocks execution unless the action still matches what was approved |
| `fw.task(name)` | Context manager | Counts agent tasks — the denominator of the north-star metric |
| `fw.guard(policy=...)` | `Guard` | Asks the policy engine first, then a human only if told to |
| `fw.register(*definitions)` | — | Uploads agent metadata + action definitions to the catalog at agent start |

`decision.authorize()` recomputes the fingerprint of `decision.action` on entry and compares it to the server-signed `approved_fingerprint`; a mismatch raises `FleetwritActionMismatch`. This is what makes **approve-with-edits** safe: when a reviewer changes an editable field, `decision.modified` is true, `decision.action` holds the edited action, the receipt is signed for the edited fingerprint only, and `authorize()` refuses the original.

### `@action` definitions and fields

An action is defined once, in code, next to the function that performs it; the definition drives the fingerprint, the reviewer's screen, the default queue, and the organisation catalog.

```python
@action(type="refund.issue", title="Issue refund", risk="high", reversible=False,
        queue="finance-ops", expires_in="30m",
        summary="Refund {amount} to customer on charge {charge}",
        display={"amount": Money(currency_field="currency")},
        redact=["card_last4"], subjects=["customer_id"], owner="payments-platform@acme.com")
def issue_refund(charge: str, amount: int, currency: str) -> str: ...
```

| Field | Required | Effect |
| --- | --- | --- |
| `type` | Yes | Catalog key, `domain.verb`, stable forever; renaming creates a new action |
| `title`, `summary` | Yes | What the reviewer reads first; `summary` is a template rendered over the args |
| `risk` | Yes | `low`/`medium`/`high`/`critical`; sets inbox sort order; `critical` forces typed confirmation and fresh IdP sign-in |
| `reversible` | Yes | `False` forces typed confirmation |
| args schema | Derived | JSON Schema (draft 2020-12) inferred from type hints or a Pydantic model; args validated before a request is created |
| `display` | No | Render hints: `Money`, `Diff`, `Code`, `Link`, `Table` |
| `editable` | No | Which arg keys a reviewer may change on approve-with-edits; default none |
| `queue`, `expires_in`, `on_expiry` | No | Defaults a call may override |
| `redact` | No | Fields hashed in the SDK before they leave the agent process |
| `subjects` | No | Which args identify a person/resource, for deterministic privacy purge |
| `owner` | No | Shown in the catalog: who to ask about this action |
| `ask_when` | No | A Python predicate that turns into an "ask a human" policy verdict |

**Versioning** is a hash of the args schema — a schema change makes a new version; old requests keep rendering under the version they were created with. **Undeclared actions** (`Action(type=..., args=...)`) still work for quick starts, but the catalog flags them so a platform owner sees the governance gap. `fleetwrit actions lint` is designed to fail CI on a missing summary, an unknown display hint, or a naming-convention breach.

### Fingerprint, idempotency, and configuration

- **Fingerprint** = `sha256:` over the canonical JSON of the ordered fields `type, version, tool, args, agent_id, environment`. Canonical JSON is JCS-style (sorted keys, compact separators, UTF-8); the v0 implementation notes it is an approximation of RFC 8785 that does not yet reproduce JCS ECMAScript number formatting for exotic floats. It is computed in the SDK and recomputed on the server, with shared conformance vectors that both must reproduce byte-for-byte.
- **Idempotency.** Every call takes an `idempotency_key`, defaulting to `sha256(run_id | step_id | fingerprint)`. A retried call re-attaches to the open request rather than creating a duplicate.
- **Provenance.** Optional `run_id`, `parent_request_id`, and W3C `trace_id` keep approvals attached across multi-agent chains and link them to OpenTelemetry traces.
- **Configuration.** `FLEETWRIT_URL`, `FLEETWRIT_API_KEY`, `FLEETWRIT_AGENT_ID`, `FLEETWRIT_ENVIRONMENT`. API keys are scoped to one agent and one environment.

### Blocking vs interrupt resume, and durability

Two resume models are specified. **Blocking mode** long-polls the decision endpoint and survives a process restart because the SDK re-attaches by idempotency key. **Interrupt mode** raises the runtime's own interrupt (e.g. LangGraph's `interrupt()`) and resumes later from a signed webhook — no inbound network access to the agent is required. Durable resume works across both process and server restart: an open request outlives either because the idempotency key deterministically re-locates it.

### `fleetwrit.testing`

Public, supported test helpers let a team test its own agents' approval paths with no network and no reviewer: `auto_approve()`, `auto_reject(reason)`, `scripted([...])`, a `FakeServer` that signs receipts with an ephemeral Ed25519 key and enforces one-ack-only, and a `fleetwrit_client` pytest fixture.

### CLI

The `fleetwrit` command exposes `dev` (start the local stack), `actions lint`, `ledger verify`, and `report`, plus (in the full design) `payloads purge`/`scan` and `ledger export`.

---

## 6. Policy engines

Fleetwrit does not decide *when* to ask. A policy engine returns one of three verdicts and the SDK acts on it: **allow** → execute; **deny** → raise `PolicyDenied`; **ask** → call `fw.approve`, and on approval execute `decision.action`. Every verdict — including allow and deny — is written to the ledger, so the record shows what was never sent to a human and why. An `ask` verdict may also carry a `queue` and `expires_in`.

| Option | How it plugs in |
| --- | --- |
| **Python predicate** | `@action(ask_when=lambda a: a.amount > 50_000)` (backed by `PredicatePolicy`) |
| **Open Policy Agent (OPA)** | `OPA(url, path)`; the Rego rule returns `allow`/`deny`/`ask`, optionally with `queue` and `expires_in`; ships with a sample Rego package |
| **Cedar** | `Cedar(policies, entities)` via `cedarpy`; a `forbid` that names the `fleetwrit_receipt` context key becomes `ask` |
| **AgentCore Policy** | Gateway Lambda interceptor (see Integrations) |
| **Custom** | Implement one method: `Policy.evaluate(action, principal, context) -> Verdict` |

**Signed-receipt verification.** Because an approval carries a compact JWS (request id, fingerprint, outcome, reviewer subject and issuer, auth time, expiry), a policy engine can require *proof* that a human approved this exact call rather than trusting a bare flag. OPA verifies it with `io.jwt.decode_verify` against Fleetwrit's JWKS. Cedar cannot verify signatures itself, so the interceptor verifies the receipt and passes `fleetwrit_receipt_valid` into the Cedar context.

---

## 7. Integrations

Each runtime integration wraps the framework's **own** pause-and-resume, so a team keeps its checkpointing and adds Fleetwrit's queue, identity, and record. Pilot Core ships exactly one — the one the first partner runs (LangGraph/LangChain is the default assumption) — because every adapter is a permanent maintenance cost against fast-moving frameworks. The rest are designs held ready. Integrations ship as extras (`fleetwrit[langchain]`, `[llamaindex]`, `[openai-agents]`, `[agentcore]`) with lazy imports so the core stays dependency-free.

| Integration | Hooks into | What the developer writes |
| --- | --- | --- |
| **LangGraph / LangChain** | LangGraph `interrupt()` + `Command(resume=...)`; LangChain human-in-the-loop middleware | `FleetwritMiddleware(tools={"issue_refund": True})` or `fleetwrit_node()` in a graph |
| **LlamaIndex Workflows** | `InputRequiredEvent` / `HumanResponseEvent`; context snapshot for later-process resume | `FleetwritHITL(workflow)` wraps the event stream |
| **OpenAI Agents SDK** | tool `needs_approval`; `result.interruptions`, `RunState` approve/reject/resume | `await fleetwrit_run(agent, input)` replaces `Runner.run` and stores `RunState` while waiting |
| **Amazon Bedrock AgentCore** | Gateway Lambda interceptor in front of MCP tools; works with AgentCore Policy (Cedar) | Deploy the `fleetwrit-agentcore-interceptor` Lambda and list the gated tools |

AgentCore differs from the other three: it gates at the tool gateway, covering any framework on AgentCore Runtime without touching agent code — a tool call without a valid receipt is held, turned into a Fleetwrit request, and retried with the receipt attached. Every integration ships a runnable example, a docs guide, and a contract test that kills the agent process mid-wait and asserts the decision still arrives exactly once.

**Identity providers.** Okta and Entra ID get full OIDC sign-in with `groups`/app-role mapping to Fleetwrit roles and queues, verified each release against free developer tenants. Google works through the generic OIDC path for development/small teams (sign-in only; no groups claim, so roles are assigned by hand, optionally restricted to a Workspace domain via `hd`). Keycloak/Dex is the mock IdP for local dev and CI and the supported way to federate a non-OIDC provider. GitHub is not supported directly (OAuth 2.0 without ID tokens); federate it through Dex.

**Notifications.** Three channels, configured per queue, each carrying a deep link to the request and *never* the args: **email** (SMTP), **Slack** (incoming webhook per queue), and a **generic signed webhook** (for Teams workflows, PagerDuty, etc.). Events that notify: new request; reminder at 25% lifetime remaining; expiry without a decision. Reviewers can switch email to a 15-minute digest (though `critical` always sends immediately), and delivery failures are recorded and surfaced on the integration-health panel.

A single `site/data/integrations.json` file is the source of truth for integration status (`available` / `next` / `planned`), read by the landing page, the docs index, and the dashboard settings screen.

---

## 8. Identity & access

- **Sign-in.** OIDC authorization-code flow with PKCE, one code path covering Okta and Entra. ID tokens are validated for issuer, audience, nonce, signature, and expiry. Sessions are server-side, 8 hours, in an HttpOnly SameSite cookie. The ledger records the reviewer's issuer, subject, email, and authentication time from the ID token — never a Fleetwrit-local username.
- **Group → queue mapping.** Queue membership derives from IdP groups, evaluated at sign-in; removing someone from the group revokes queue access by their next session (8 hours at most).
- **Roles.** `admin`, `reviewer`, `auditor`, `viewer`. `auditor` sees everything and decides nothing; `viewer` sees overview, agents, and catalog but not request contents.
- **Fresh sign-in for critical actions.** `critical` actions and any `reversible=False` action can require a fresh sign-in via OIDC `max_age`, so an unattended session cannot approve them. (For Google, `max_age`/`auth_time` behaviour must be confirmed before relying on it.)
- **Break-glass.** For an IdP outage only — a designed interface, never database access. At most two named local accounts, each bound to a WebAuthn hardware key, disabled by default and enabled per incident by config change. A break-glass session lasts 60 minutes, can only decide requests, requires a reason on every decision, notifies every admin immediately, chains each decision with `actor=break_glass`, and shows in red on the overview. There is deliberately no fail-open switch: if the server itself is down, agents stay held.

---

## 9. Server & API

One stateless FastAPI server sits between every agent stack and every reviewer. It exposes an agent-facing API (API-key auth) and a dashboard-facing API (IdP-session auth), both under `/v1` and documented with OpenAPI. State, catalog, and ledger all live in Postgres (SQLite under `fleetwrit dev`).

| Endpoint | Caller | Purpose |
| --- | --- | --- |
| `POST /v1/agents/register` | SDK | Upsert agent metadata + action-type definitions |
| `POST /v1/requests` | SDK | Create, or re-attach by idempotency key |
| `GET /v1/requests/{id}/decision?wait=30` | SDK | Long-poll for the decision + receipt |
| `POST /v1/requests/{id}/ack` | SDK | Mark the decision consumed; succeeds once |
| `POST /v1/requests/{id}/cancel` | SDK | Agent no longer needs the answer |
| `POST /v1/verdicts`, `POST /v1/tasks` | SDK | Batched policy verdicts and task counts |
| `GET /v1/overview` | Dashboard | Organisation aggregates |
| `GET /v1/inbox`, `GET /v1/requests/{id}` | Dashboard | List and detail |
| `POST /v1/requests/{id}/decide` | Dashboard | Approve / reject / answer / choose |
| `GET /v1/agents`, `GET /v1/action-types` | Dashboard | Registries |
| `GET /v1/search?q=` | Dashboard | Requests by id, fingerprint, reviewer, arg value |
| `GET /v1/ledger`, `GET /v1/ledger/verify` | Dashboard, CLI | Read and verify the chain |
| `GET /v1/events` | Dashboard | Server-sent events for live counters |
| `GET /auth/login`, `/auth/callback`, `/auth/logout` | Browser | OIDC code flow with PKCE |
| `GET /.well-known/jwks.json` | Policy engines, interceptors | Receipt-verification keys |
| `GET /metrics`, `/healthz`, `/readyz`, `GET /v1/report` | Ops | Prometheus metrics; liveness; readiness (Postgres + migrations); usage report |

**Decision delivery** is long-poll by default (works without inbound access to the agent) and a signed webhook for checkpointing runtimes. **Outbound webhooks** — `request.created` to the queue's Slack webhook, `decision.made` to the agent's resume URL in interrupt mode — are signed with HMAC-SHA256 over timestamp and body and retried with backoff for 24 hours.

---

## 10. Dashboard

A React + Vite SPA served by the server. It opens on an **organisation-wide overview**, not an inbox: anyone asking "what are our agents waiting on, and who is approving what?" gets the answer on the first screen, and reviewers are one click from their queue.

| Screen | Audience | Shows / does |
| --- | --- | --- |
| **Overview** | Everyone | Pending now by queue and risk, oldest waiting request, 7/30-day decision counts, human-minutes-per-1,000-tasks trend, approval/expiry rates, fast-approval flags, agents by runtime/environment, newly registered agents and action types, integration health; drill-in and filters |
| **Inbox** | Reviewers | Pending requests for the user's queues, highest risk and soonest expiry first; filter and open |
| **Request detail** | Reviewers, auditors | Summary, args rendered with display hints, context, provenance, the policy verdict that triggered the ask, fingerprint, prior decisions on the same type; approve, approve-with-edits (editable fields only), reject with reason, answer/choose; permanent link |
| **Agents** | Platform owners | Every agent: owner, environment, runtime, SDK version, last-seen, action types used, 30-day volume; create/rotate key, disable agent |
| **Action catalog** | Platform, risk | Every action type: title, risk, reversibility, owner, schema, versions, agents using it, approval rate, undeclared flag; history; CSV export |
| **Ledger** | Auditors | Every event newest-first with actor identity and hash, chain-status badge; search, JSONL export, verify chain |
| **Settings** | Admins | IdP connection and group mappings, queues, Slack webhooks, receipt signing keys, integration status; test IdP, rotate key |

**What makes it the organisation's source of truth:** a single **search** box over request ids, fingerprints, agent names, reviewers, and arg values ("who approved the refund on order 5531?" is one query); **permanent links** on every request and decision; a **coverage view** listing agents with zero gated actions and action types in use but undeclared; and a **disable switch** that makes every open and future request from an agent fail closed and records who did it.

**Decision-quality rules:** reject requires a reason; `reversible=False` requires typed confirmation; `critical` also requires fresh sign-in; approve-with-edits shows original vs edited side by side, requires a reason, validates against the schema, and displays the new fingerprint; decisions under 3 seconds after first view are flagged as fast approvals. The MVP only *reports* auto-approve and high-edit-rate candidates; it does not act on them.

Reviewer screens (inbox, request detail, sign-in) are **phone-first**; overview/agents/catalog/ledger are responsive but desktop-oriented. Live updates use server-sent events. `fleetwrit dev` starts everything on `localhost:4100` with auth off and 30 days of seeded synthetic history so the overview is never empty in a demo.

---

## 11. Record: fingerprint, receipts, ledger

- **Fingerprint** (see §5) binds every decision to one exact action.
- **Signed receipts** are JWS with EdDSA (Ed25519). Because receipts are audit artefacts expected to outlive keys, verification must survive rotation: every signing key has a `kid` carried in the receipt header; a rotation chains a key-rotated event containing the new public key into the ledger; retired public keys are never deleted and remain available from a key-history endpoint and in every ledger export; the CLI can verify any receipt offline from an exported key history; private keys are destroyed on rotation. Keys are published at `/.well-known/jwks.json`.
- **The hash-chained ledger** is append-only. Each row stores `seq`, `ts`, `actor`, `event`, `payload_hash`, `refs`, `prev_hash`, and `hash`, with `h_n = SHA256(h_{n-1} ‖ JCS(e_n))`. Events include `agent.registered/disabled`, `action_type.registered`, `policy.verdict`, `request.created/viewed/reminded/expired/cancelled`, `decision.made/consumed`, `payload.purged`, `user.login`, and `config.changed`. In production the table rejects update and delete via a database trigger, and the app's DB role cannot drop it. `fleetwrit ledger verify` walks the chain and names the first broken sequence; `fleetwrit ledger export` writes JSONL with the chain head for offline verification.
- **The payload split.** Payloads are *hashed into* the chain, not stored in it. The ledger row carries the SHA-256 of the canonical payload plus opaque identifiers (request id, fingerprint, user id); names, emails, args, and context live only in a separate, purgeable `payloads` table. Deleting a payload leaves its hash in place — the chain still verifies and still proves a specific decision on a specific fingerprint happened, but no longer reveals its content.
- **Retention & purge.** `FLEETWRIT_PAYLOAD_RETENTION` defaults to 90 days (purged nightly, with a `payload.purged` event chained), with per-action-type overrides. `fleetwrit payloads purge --subject <ref>` deterministically erases every payload tagged with a subject reference. Erasing a user replaces name/email with a tombstone but keeps issuer/subject hashes for audit continuity. A purged request still appears in search and the ledger with its metadata, outcome, and timing, labelled as purged.
- **Subject references.** Erasure by scanning nested business payloads is fragile, so it is not the mechanism. An action declares which args identify a person/resource (`subjects=["customer_id"]`), the SDK sends those as an indexed field, and a subject purge is an index lookup. `fleetwrit payloads scan --value` exists only as a best-effort, explicitly-incomplete audit aid.

---

## 12. Deployment & operations

Three supported paths, all from the same image.

| Path | For | Contents |
| --- | --- | --- |
| `fleetwrit dev` | A developer's laptop | pip-only, SQLite, auth off, seeded demo data |
| `docker compose up` | Evaluation / small teams | Server, Postgres, Keycloak profile for trying sign-in |
| **Helm chart** | Partner production | ≥2 server replicas, external Postgres via secret, TLS ingress, existing-secret references for signing keys / OIDC secret / SMTP, PodDisruptionBudget, anti-affinity, resource requests, NetworkPolicy, ServiceMonitor, migration Job as a pre-upgrade hook |

The chart is published as an OCI artifact on GHCR and tested on EKS and kind. Managed Postgres with point-in-time recovery (RDS, Cloud SQL, Azure Database) is the supported production database; in-cluster Postgres is evaluation-only.

**Availability** targets 99.9% monthly (measured from SDK connection success), because the fail-closed SDK makes Fleetwrit a production dependency of every gated agent. The design is a **stateless server** (all state in Postgres; long-polls and SSE reconnect to any replica; decision writes use row locks); **background work** (expiry sweeper, reminders, purge, webhook retries) runs on every replica behind a Postgres advisory lock so exactly one does it and another takes over within 30 seconds; **zero-downtime upgrades** with backward-compatible-for-one-minor migrations and `maxUnavailable: 0`; **SDK resilience** with jittered backoff for 60 seconds before raising and re-attach by idempotency key; and a **degraded mode** where a read-only Postgres still serves the dashboard read-only and returns a retryable error to the SDK rather than failing requests. The chart ships Prometheus alert rules (pending age, high/critical expiries, unrouted requests, 5xx/p95, notification failures, nightly ledger-verify, silent agents) and a Grafana dashboard; capacity target is 50 requests/s created and 10,000 open requests on a 2-vCPU container with the overview query under 300 ms at 1M ledger rows.

---

## 13. Security model

- **API keys** are shown once, stored as Argon2 hashes, and scoped to one agent + one environment. An agent key can never call a dashboard endpoint, and an agent cannot approve its own request.
- **Sessions** are server-side, 8 hours, HttpOnly + SameSite. The decide endpoint requires a session whose user belongs to the request's queue; fingerprint, expiry, and (where required) `auth_time` freshness are re-checked inside the transaction that writes the decision.
- **Receipts** use an Ed25519 key held by the server, with rotation-surviving verification (§11). `redact` fields are hashed in the SDK before leaving the agent process. TLS is terminated by the deployer's proxy; the server refuses non-local plain HTTP unless `FLEETWRIT_INSECURE=1`.
- **What it protects:** that a gated action does not execute without a decision; that a decision binds to one exact fingerprint; that the record is independent of the governed system and tamper-evident; and the precise at-most-once delivery guarantee of §4.
- **What it does not protect:** it cannot prevent an agent re-running its own downstream side effect after a crash (hence the idempotency-key recommendation), and it is not an agent identity provider or a policy engine.

---

## 14. Open-source boundary & pricing hypothesis

Everything in this spec is **Apache-2.0**. The line between the open edition and a future paid control plane is drawn by *operations*, not team size: **the open edition records and displays; the paid control plane routes, enforces, and proves.**

| Capability | Open source (this MVP) | Paid control plane (later) |
| --- | --- | --- |
| SDK, protocol, integrations, policy hook | Yes | Same |
| Requests, fingerprint, expiry, receipts | Yes | Same |
| Dashboard | Overview, inbox, agents, catalog, ledger, one workspace | Multiple workspaces/BUs, delegated admin |
| Routing | Named queue, IdP-group members, first decision wins | Rules, escalation chains, schedules, SLAs, OOO delegation |
| Identity | Okta/Entra sign-in, group mapping, fresh sign-in | SCIM, per-person/amount authority limits, maker-checker |
| Ledger | Hash chain, verify, JSONL export | External anchoring, retention policy, SOX/Article-14 evidence packs |
| Analytics | Overview metrics, 30 days | Analytics-to-policy recommendations, long retention, benchmarks |
| Hosting | Self-hosted, community | Hosted, enterprise self-hosted, support SLA |

This boundary is explicitly a **business-model experiment**, not an architecture decision: nothing public commits to it before commercial reviews, every partner review asks which paid-column items they would pay for, and the org-level features are kept in separable modules so the line can move without a rewrite. The one fixed rule: no routing rules, escalation, authority limits, or evidence packs in the open repository.

**Pricing hypothesis** (every number is a starting point to test, not a decision): reject per-approval pricing (revenue would fall as the product works) and per-seat pricing (it should be the whole org's source of truth); charge a **platform fee plus bands of active agents, with unlimited humans**. An agent is "active" if it registered or created a request in the last 30 days, per environment. Indicative plans: **Community** free/self-hosted; **Design partner** ~£1–2k/month for 6 months; **Team** ~£1.5–2.5k/month (~25 agents, routing/escalation/SLAs); **Enterprise** ~£50–120k/year (authority limits, maker-checker, SCIM, evidence packs, multi-workspace). The buyer comparison set is compliance/incident tooling, not developer tools.

---

## 15. Repositories & release plan

**Repository plan: 2 → 4 (+1 private).**

- **Phase 1 — now (Pilot Core): 2 public repos.** `fleetwrit-python` (SDK core, action catalog, policy hook, integrations, CLI, `fleetwrit.testing`, examples; protocol schemas + conformance vectors in a `protocol/` folder for now) publishing `fleetwrit` to PyPI; and `fleetwrit` (FastAPI server, React dashboard, migrations, docker-compose, AgentCore interceptor, system/fault-injection tests, and the one-page `site/` for now) publishing `fleetwrit-server` to PyPI, the image and Helm chart to GHCR, and the Lambda zip.
- **Phase 2 — on first founder-hosting: +1 private repo.** `fleetwrit-ops` (Terraform for single-tenant instances, per-partner feedback logs).
- **Phase 3 — public launch: 4 public + 1 private.** Split out `fleetwrit-protocol` (once another runtime/vendor wants to emit the protocol) and `fleetwrit-site` (once the full site needs its own cadence). The first simplification if CI drags is to merge protocol back into `fleetwrit-python`. Contributions use a DCO sign-off, not a CLA.

**Evidence gates.** The full feature set is the design, not a fixed 17-week build. Everything sits in one of three gates, and the only rule for moving something earlier is *a live partner is blocked on it* — elegance, completeness, and market guesses do not qualify.

1. **Pilot Core** (~4 weeks part-time): the smallest slice that puts one partner's real workflow into production — one vertical (platform/SRE), one partner-chosen runtime, one OIDC route, 2–5 consequential action types, one reviewer group, one production environment. Includes SDK core calls (incl. approve-with-edits), `@action` + registry sync, `fleetwrit.testing`, a pre-release on PyPI, durable requests + fingerprint + expiry + fail-closed + the hash-chained ledger with the payload split, inbox + request detail + a searchable decision list, email + one chat webhook + reminders + `unrouted` queue, `/metrics` + `fleetwrit report`, an agreed production path, the five acceptance stories green, and the conformance/fault-injection test harness.
2. **Partner-blocking next:** built only when a live partner cannot proceed without it (e.g. the second runtime, group mapping + fresh sign-in + a second IdP guide, the org overview / agents / catalog screens, retention/purge/ledger screen, digest mode + generic signed webhook, alert rules + HA suites, OPA policy hook + receipt verification in OPA).
3. **Post-evidence:** everything else, built after two or three teams independently say they need the independent layer and at least one pays — Cedar, a TypeScript SDK, the AgentCore interceptor and other runtimes, SCIM/more IdPs, catalog analytics + auto-approve candidates, external anchoring, Teams/PagerDuty, the full landing page/docs site/live demo, and the repository split.

Release train: `0.1.0a1` at the end of Pilot Core (installable with `pip install --pre`), further alphas per partner-blocking item, `0.1.0b1` when the third partner is in production (API frozen but bug fixes), and public `0.1.0` at the Post-evidence gate. Releases are a signed git tag; PyPI trusted publishing (no tokens) from a protected `release` environment; build attestations + SBOM; a 24-hour yank policy for correctness bugs in fingerprinting, receipts, or decision delivery. The kill criterion is end of Q1 2027: three teams on real interrupts with at least one paying, or park the product.

---

## 16. Status today (v0)

An honest reading of the code in this workspace: the SDK core, protocol, v0 server, and dashboard are real and coherent, but they are a demonstration slice — the server is SQLite-only with auth off, the dashboard runs off in-memory seed data rather than the server API, and the framework/policy adapters, OIDC, notifications, and production operations are stubs or absent.

| Area | Status | Detail |
| --- | --- | --- |
| SDK core (`Client`, approve/input/choose/task/guard/register) | **Built** | Full sync client; single-shot long-poll then ack in `approve` (loop-until-decided and interrupt/webhook resume are not yet wired) |
| `@action`, `Action`, schema derivation, versioning, display hints | **Built** | JSON Schema from type hints; version = schema hash; `Money/Diff/Code/Link/Table`; arg validation in `.action()` |
| Fingerprint + idempotency + conformance vectors | **Built** | `sha256:` canonical JSON over the 6 ordered fields; vectors in `protocol/vectors/fingerprint.json`; canonicalisation self-described as a v0 RFC-8785 approximation |
| `decision.authorize()` / fail-closed exceptions | **Built** | Recomputes and compares fingerprint; `FleetwritUnavailable`, `PolicyDenied`, `FleetwritActionMismatch` |
| `fleetwrit.testing` | **Built** | `FakeServer` (Ed25519 receipts, one-ack enforcement), `auto_approve/auto_reject/scripted`, pytest fixture |
| Policy engine hook | **Partial** | `Verdict`, `Policy`, `PredicatePolicy`, `Guard` built; **`OPA` and `Cedar` are stubs** that raise `NotImplementedError` |
| Runtime integrations (LangChain, LlamaIndex, OpenAI Agents, AgentCore) | **Stubbed** | All four import without the framework and raise `NotImplementedError`; extras declared in `pyproject.toml` |
| CLI | **Stubbed** | `dev`, `actions lint`, `ledger verify`, `report` print sensible output and exit 0; no real behaviour |
| Protocol schema | **Built** | `interrupt-request.schema.json` (fleetwrit/v1); kinds `approve`/`input`/`choose` |
| SDK/protocol tests | **Built** | 6 suites (~450 lines): fingerprint, protocol, decision, actions, policy, testing helpers |
| v0 server (FastAPI + SQLite) | **Built (local/demo only)** | `store.py`/`schema.sql`/`seed.py`/`app.py`; agent-facing register/requests/decision(long-poll)/ack/cancel; dashboard-facing overview/inbox/detail/decide/agents/action-types/ledger/verify; `/healthz`; `/.well-known/jwks.json` |
| Ledger + receipts in server | **Built (v0 shape)** | Real hash chain and `verify_chain`; real Ed25519 signing + JWKS; server recomputes fingerprint for edits and enforces editable-field allowlist; **no DB trigger** blocking update/delete yet |
| Payload split, retention/purge, subject refs | **Not built** | Args/context stored inline in the `requests` table; no separate `payloads`/`policy_verdicts`/`users`/`queues`/`tasks`/`notifications` tables |
| Postgres | **Not built** | SQLite only; no migrations |
| Auth / OIDC / roles / fresh sign-in / break-glass | **Not built** | Server auth is off; no `/auth/*` endpoints; dashboard hard-codes a demo reviewer ("you@acme.com", "Okta (demo)") |
| Notifications (email / Slack / webhook), reminders, `unrouted` | **Not built** | No notification code or tables in the v0 server |
| Server ops endpoints (`/metrics`, `/readyz`, `/v1/report`, `/v1/search`, `/v1/events` SSE, `/v1/verdicts`, `/v1/tasks`, key rotation) | **Not built** | Absent from the v0 app |
| Dashboard SPA (7 screens) | **Built (prototype)** | Overview, Inbox, RequestDetail, Agents, Catalog, Ledger, Settings + NotFound; approve / approve-with-edits / reject, typed confirmation, required reasons, prior decisions, live client-side fingerprint, receipt rendering |
| Dashboard ↔ server wiring | **Not built** | The SPA runs entirely off local seed data via a `useReducer` store; no `fetch`/SSE calls to `/v1` — it is a standalone clickable prototype, not yet connected to the FastAPI server |
| Site (Astro landing + design system) | **Built (in progress)** | `site/` Astro project with `DESIGN.md`, `PRODUCT.md`, and `data/`; design direction is the "writ / register" system (see note below) |
| Helm chart, docker-compose, AgentCore Lambda, fault-injection/HA suites | **Not built** | Deployment and system-test assets are specified but absent from the workspace |

**A note on design direction:** the committed `site/DESIGN.md` describes a serious "office of record" register aesthetic (ultramarine ink, record-red, verify-green, held-amber; Instrument Serif display, Public Sans body, Spline Sans Mono labels), and the dashboard renders receipts as a "certificate of authorisation" with seals and ledger lines — consistent with the writ concept. The user's persistent memory notes a preference to steer the *landing page* toward a brighter "aegyn.dev" style rather than the spec's darker writ/seal look; that is a landing-page styling decision and does not change any of the product mechanics above.

---

*End of specification.*
