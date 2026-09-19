---
layout: ../../layouts/DocsLayout.astro
title: Identity
description: Reviewers sign in with their own work account, through the identity provider your company already runs. Fleetwrit is not an identity provider — it uses yours.
---

## One sign-in route

Fleetwrit signs people in with the OIDC authorization-code flow with PKCE, which covers Okta and Entra with a single code path. The ledger records the reviewer's **issuer, subject, email and authentication time** from the ID token — not a Fleetwrit-local username — so an auditor can trace a decision back to a real, verified person.

```
GET /auth/login      →  redirects to your IdP
GET /auth/callback   →  exchanges the code, starts an 8-hour server-side session
GET /auth/logout
```

## Providers

| Provider | Scope |
| --- | --- |
| Okta | Sign-in; `groups` claim mapped to roles and queue membership. Tested setup guide. |
| Microsoft Entra ID | Sign-in; group object ids or app roles mapped the same way. Tested setup guide. |
| Google | Development / small-team sign-in through the generic OIDC path. No group claim, so roles are assigned by hand; optionally restricted to one Workspace domain via `hd`. |
| Keycloak / Dex | The mock IdP for local development and CI, and the supported way to federate a non-OIDC provider (for example GitHub, behind Dex). |
| Any other OIDC provider | Works through generic OIDC settings; untested, no guide. |

## Group mapping

Queue membership comes from IdP groups. Map a group to a role and a queue in **Settings → Identity**, and the request reaches exactly the people in that group.

- Mapping is evaluated at **sign-in**. Removing someone from the IdP group removes their queue access at their next session — 8 hours at most.
- Roles are `admin`, `reviewer`, `auditor` and `viewer`. `auditor` sees everything and decides nothing; `viewer` sees the overview, agents and catalog but not request contents.

## Fresh sign-in for critical actions

Actions marked `critical`, and any action with `reversible=False`, can require a **fresh** IdP sign-in via OIDC `max_age`, so an unattended session cannot approve them.

```python
@action(type="prod.delete", title="Delete production data", risk="critical", reversible=False)
def delete_data(...): ...
```

When a reviewer opens a critical request, Fleetwrit sends them back through the IdP with `max_age`, and re-checks `auth_time` inside the transaction that writes the decision.

## Roles and break-glass

Local password accounts exist only for `fleetwrit dev` and for a single break-glass admin. Break-glass is for an **IdP outage only**: it is disabled by default, bound to a hardware security key, time-boxed, and every break-glass decision is chained to the ledger and shown in red until an admin reviews it. See the [security model](/docs/security).

## Testing your setup

The install checklist includes an identity check: sign in as a reviewer and as an auditor, confirm an unknown queue lands in `unrouted`, and confirm a `critical` action triggers a fresh sign-in on a phone browser.

## Next steps

- [Operate](/docs/operate) — configure the OIDC client and sessions in production.
- [Security model](/docs/security) — sessions, tokens and break-glass in full.
