---
layout: ../../layouts/DocsLayout.astro
title: Operate
description: Run Fleetwrit yourself. Three deployment paths from one image, with metrics, backups, key rotation and a ledger you can verify offline.
---

## Deployment paths

All three use the same image and the same migrations.

| Path | For | Contents |
| --- | --- | --- |
| `fleetwrit dev` | A laptop | pip only, SQLite, auth off. |
| `docker compose up` | Evaluation and small teams | Server, Postgres, and a Keycloak profile for trying sign-in. |
| Helm chart | Production | 2+ replicas, external Postgres, TLS ingress, secret references, PodDisruptionBudget, anti-affinity, NetworkPolicy, ServiceMonitor, migration Job as a pre-upgrade hook. |

```bash
helm install fleetwrit oci://ghcr.io/fleetwrit/charts/fleetwrit \
  --values values.yaml
```

Use **managed Postgres with point-in-time recovery** (RDS, Cloud SQL, Azure Database) in production. Postgres inside the cluster is evaluation-only.

## Configuration

Keys are scoped to one agent and one environment.

| Variable | Purpose |
| --- | --- |
| `FLEETWRIT_URL` | Server base URL the SDK connects to. |
| `FLEETWRIT_API_KEY` | Agent key; shown once, stored as an Argon2 hash. |
| `FLEETWRIT_AGENT_ID`, `FLEETWRIT_ENVIRONMENT` | Scope for the key and the requests it creates. |
| `FLEETWRIT_PAYLOAD_RETENTION` | Days before payloads are purged. Default 90. |
| `FLEETWRIT_INSECURE` | Set to `1` only to allow non-local plain HTTP. |

## Health and metrics

| Endpoint | Purpose |
| --- | --- |
| `GET /healthz` | Liveness. |
| `GET /readyz` | Readiness — checks Postgres and that migrations are applied. |
| `GET /metrics` | Prometheus format. |

The Helm chart ships alert rules and a Grafana dashboard. Key series include `fleetwrit_requests_pending` by queue and the age of the oldest, `fleetwrit_requests_expired_total`, `fleetwrit_unrouted_requests`, and `fleetwrit_ledger_verify_ok`.

## Availability

The SDK fails closed, so Fleetwrit is a production dependency of every gated agent. The design target is 99.9% monthly.

- The server is stateless; all state is in Postgres, and replicas share nothing.
- Background work (expiry sweeper, reminders, purge, webhook retries) runs behind a Postgres advisory lock, so exactly one replica does it and another takes over within 30 seconds.
- Migrations are backward-compatible for one minor version, so rolling upgrades run with `maxUnavailable: 0`.

## Backups

Rely on your managed database's automated backups and point-in-time recovery. Test a restore once during install — it is on the [install checklist](/docs/quickstart). The ledger's integrity does not depend on backups: the hash chain detects tampering regardless.

## Verifying and exporting the ledger

```bash
fleetwrit ledger verify      # walks the chain, names the first broken sequence
fleetwrit ledger export      # JSONL with the chain head, for offline verification
```

Verification runs nightly in production and raises an alert on failure.

## Key rotation

Receipts are signed with an Ed25519 key. Because receipts are expected to outlive keys, verification survives rotation:

```bash
fleetwrit keys rotate
```

Each signing key has an id carried in the receipt header. A rotation chains a `key-rotated` event with the new public key; retired public keys are never deleted and stay available from the key-history endpoint and in every ledger export, so an old receipt still verifies offline. Private keys are destroyed on rotation.

## Retention and purges

```bash
fleetwrit payloads purge --subject cust_8812   # erasure request, chained to the ledger
```

Payloads older than `FLEETWRIT_PAYLOAD_RETENTION` are purged nightly, and a `payload.purged` event is chained. A purged request still appears in search and in the ledger with its metadata, outcome and timing — only the content is gone, and the chain still verifies.

## Usage report

```bash
fleetwrit report --from 2026-09-01 --to 2026-09-30
```

Produces a JSON and PDF summary — requests by action type and outcome, edit rate, expiry rate, wait-time p50/p95, human minutes per 1,000 tasks — with counts and durations only, no args, names or emails.

## Next steps

- [Security model](/docs/security) — the guarantees behind all of this.
- [Identity](/docs/identity) — wiring your IdP for production sign-in.
