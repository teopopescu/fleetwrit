---
layout: ../../layouts/DocsLayout.astro
title: Security model
description: What Fleetwrit protects, what it does not, and the mechanisms behind its one promise — that the record of who authorised what is accurate and tamper-evident.
---

## The promise

Fleetwrit's whole value rests on two mechanisms: **authentication** (who the reviewer really is) and **receipt signing** (proof they approved this exact action). This page describes both, plus the record that ties them together.

## Fail closed

The SDK never fails open. If the server is unreachable, it retries with jittered backoff for 60 seconds and then raises `FleetwritUnavailable`. An action is never executed without a decision. If the server itself is down, agents stay held — that is the design, and there is deliberately no fail-open switch.

## Fingerprint

Every action is hashed with SHA-256 over the RFC 8785 canonical JSON of its `type`, `version`, `tool`, `args`, `agent_id` and `environment`. The fingerprint is computed in the SDK and recomputed on the server. Approval binds to one exact fingerprint: a single changed argument is a different request, and an agent's changed-args retry appears as a new request, never as a silent edit.

## Signed receipts

Each decision carries a compact JWS signed with an Ed25519 key: request id, fingerprint, outcome, reviewer subject and issuer, authentication time and expiry. Keys are published at `/.well-known/jwks.json`, so OPA, a gateway interceptor, or any verifier can check a receipt independently.

Receipts are expected to outlive keys, so verification survives rotation:

- every signing key has an id carried in the receipt header;
- a rotation chains a `key-rotated` event containing the new public key;
- retired public keys are never deleted and stay in the key history and every ledger export;
- private keys are destroyed on rotation.

## Hash-chained ledger

Every event is appended to a ledger, hash-chained so any edit, deletion or reorder is detectable:

```
hₙ = SHA256( hₙ₋₁ ∥ JCS(eₙ) )
```

**Payloads are hashed into the chain, not stored in it.** The ledger row carries the SHA-256 of the canonical payload plus opaque identifiers (request id, fingerprint, user id). Names, emails and args live only in a separate `payloads` table. Deleting a payload leaves its hash in place, so the chain still verifies — and still proves a specific decision on a specific fingerprint happened — without revealing the content. The ledger table rejects `UPDATE` and `DELETE` at the database level, and the app's role cannot drop it.

## Access control

- API keys are shown once, stored as Argon2 hashes, scoped to one agent and one environment.
- ID tokens are validated for issuer, audience, nonce, signature and expiry. Sessions are server-side, 8 hours, in an HttpOnly, SameSite cookie.
- The decide endpoint requires a session whose user belongs to the request's queue. Fingerprint, expiry and — where required — `auth_time` freshness are re-checked inside the transaction that writes the decision.
- An agent API key can never call a dashboard endpoint, and **an agent cannot approve its own request**.
- `redact` fields are hashed in the SDK before they leave the agent process.

## Break-glass (IdP outage only)

Break-glass is a designed interface, never database access. It is a separate sign-in that does not depend on the IdP:

- at most two named local accounts, each bound to a hardware security key (WebAuthn);
- disabled by default, enabled per incident by a config change;
- a 60-minute session that can only decide requests and requires a reason on every decision;
- every admin is notified immediately, each decision is chained with `actor=break_glass`, and it shows in red on the overview until an admin reviews it.

If the server is down, nobody can decide and agents stay held. That is the fail-closed design.

## What Fleetwrit does and does not protect

**It protects:** the integrity and attribution of the authorisation record; that an executed action matches exactly what a named, IdP-verified human approved; that the record cannot be silently altered.

**It does not:** stop an agent running its own side effect twice after a crash inside the `authorize()` block (pass the request id as an idempotency key to the downstream system); act as your identity provider or your policy engine; or protect against a compromised IdP or a malicious admin — those are your controls, and the ledger records what they did.

## Reporting a vulnerability

See `SECURITY.md` in the repository for the disclosure address. Releases with a correctness bug in fingerprinting, receipts or decision delivery are yanked within 24 hours and a fixed patch published.

## Next steps

- [Policy engines](/docs/policy) — verifying receipts in OPA and a gateway.
- [Operate](/docs/operate) — key rotation and ledger verification in practice.
