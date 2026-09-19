# Product

<!-- impeccable:product-schema 1 -->

<!-- Inferred from "Agent ops control plane — MVP spec.md" and the user's briefs,
     not a fresh interview. Correct any field that drifted from intent. -->

## Platform

web

## Users

Primary: platform and SRE engineers running agentic remediation across more than
one runtime. Two jobs on the same product:
- The developer integrates Fleetwrit into an agent (`pip install`, decorate an
  action, wrap the runtime) — an afternoon's work, no change to their checkpointing.
- The reviewer / on-call decides. Often at 02:00, on a phone: they open a link,
  sign in with their work account, read the exact action and its context, and
  approve or reject in under a minute.
Secondary: platform / AI-governance owners who need one view of every agent and
gated action; and risk / audit / CISO who need a record of which IdP-verified
person authorised exactly which action.

## Product Purpose

Fleetwrit is the independent authorisation record for consequential AI-agent
actions: one control point for who may authorise what an organisation's agents
do. An agent stops before a consequential action, a named human decides, the
agent resumes on exactly that decision, and the record is tamper-evident and
lives outside the system being governed. Success is a production team saying
they still need this independent layer even though their framework ships its own
approval feature. North-star metric: human minutes per 1,000 agent tasks.

## Positioning

Not an agent framework's own pause-and-resume, and not an identity provider or a
policy engine. It wraps native pause-and-resume and owns what a single runtime
cannot: organisation-wide identity, one queue, an action inventory, signed
receipts, and evidence across stacks. Shorthand: "PagerDuty for what AI agents
need from humans." It signs people in through the IdP the company already runs
(Okta, Entra) and takes verdicts from the policy engine it already runs
(OPA, Cedar).

## Operating Context

Change control and on-call: queues, rotations, fail-closed habits, consequential
changes. Reviewer queues are populated from IdP groups (Okta / Entra), so a
request routes to the assigned people. Policy engines (OPA / Cedar) decide when
to ask a human. Notifications over email and Slack carry a deep link, never the
args. Self-hosted via Helm or founder-hosted single tenant. Core objects a user
handles: action, request, decision, receipt, queue, ledger, fingerprint.

## Capabilities and Constraints

- Python SDK: `approve` / `input` / `choose`, `@action` definitions with registry
  sync, `decision.authorize()`, `fw.guard(policy=...)`, `fleetwrit.testing`.
- One runtime integration in Pilot Core (LangGraph/LangChain the default), wrapping
  the framework's own interrupt; more added only when a partner is blocked.
- OIDC sign-in (Okta, Entra; Google/Keycloak for dev). Roles: admin, reviewer,
  auditor, viewer. Fresh sign-in for `critical` actions.
- Durable requests, fingerprints, required expiry, exactly-once decision delivery.
  **Fails closed: never fails open.** If the server is unreachable the SDK raises.
- Hash-chained, append-only ledger with the payload split out (content is hashed
  into the chain, not stored in it), so a privacy purge still verifies.
- Signed decision receipts (JWS, EdDSA), verifiable by a policy engine.
- Dashboard: overview, inbox, request detail, agents, action catalog, ledger.
- Apache-2.0, self-hosted. Python 3.10+, FastAPI server, Postgres, React SPA.

## Brand Commitments

- Name: **Fleetwrit**. A writ is a formal written order authorising a specific
  act; the fleet is the organisation's agents — "the written authority over what
  your agent fleet may do."
- The tagline must say *agents* within the first five words (users hear "fleet" as
  vehicles otherwise).
- Voice: precise, serious, credible; no hype, no vague AI claims.
- Open source, Apache-2.0.

## Evidence on Hand

- No real customers, logos, benchmarks, or prices to show yet — must not be
  fabricated. Pricing on the site is an explicitly-labelled hypothesis.
- Integration brand marks (LangGraph, OpenAI, Okta, Entra, AWS, Slack, etc.) are
  shown legitimately as "works with" interoperability logos.
- Dashboard visuals are illustrative representations until `fleetwrit dev` seeded
  captures exist; they are labelled as such.
- A design-partner programme is recruiting now.

## Product Principles

- Fail closed. A gated action never runs without a decision.
- The record is independent: it lives outside the system it governs, and it is
  tamper-evident.
- Wrap native pause-and-resume; do not compete with it.
- Evidence-gated scope: nothing ships broader until a live partner is blocked on it.
- Privacy by construction: identifiers in the chain, content in a purgeable store.

## Accessibility & Inclusion

Reviewer flows (inbox, request detail, sign-in including fresh sign-in) are
phone-first and must complete in a mobile browser. Target Lighthouse
accessibility ≥ 95; work without JavaScript; respect `prefers-reduced-motion`
and `prefers-color-scheme`.
