# Fleetwrit

[![test-server](https://github.com/teopopescu/fleetwrit/actions/workflows/test-server.yml/badge.svg)](https://github.com/teopopescu/fleetwrit/actions/workflows/test-server.yml)

**The independent authorisation record for consequential AI-agent actions.**

An agent stops before a consequential action, a named human decides, and the
agent resumes on exactly that decision — carrying a signed receipt, recorded in a
tamper-evident ledger that lives outside the system being governed.

Website: **https://fleetwrit.ai** · SDK: [`fleetwrit`](https://pypi.org/project/fleetwrit/) on PyPI ([source](https://github.com/teopopescu/fleetwrit-python))

## What's in this repo

| Path | What |
|------|------|
| `server/` | `fleetwrit-server` — the local server (FastAPI + SQLite): requests, decisions, EdDSA receipts, a hash-chained ledger, and the ops dashboard bundled in. |
| `dashboard/` | The React + Vite ops console (source). Its built output is bundled into the server. |
| `docker-compose.yml`, `DOCKER.md` | Run the stack in Docker. |
| `RELEASING.md` | How the packages publish to PyPI (Trusted Publishing). |

The SDK an agent developer installs lives in its own repo,
[`fleetwrit-python`](https://github.com/teopopescu/fleetwrit-python).

## Quickstart

One install, one command — the server and dashboard come up together (no Docker,
no Node needed; the dashboard is bundled into the server):

```bash
pip install "fleetwrit[dev-server]"
fleetwrit dev          # server API + dashboard on http://localhost:4100
```

It starts **empty** — point your agent at it with `FLEETWRIT_URL=http://localhost:4100`
and develop against it. `fleetwrit dev --demo` loads sample agents and requests.
Prefer Docker? See [DOCKER.md](DOCKER.md).

## Integrations

The SDK gates a consequential tool behind a human decision. Shipping today:
**LangGraph**, **OpenAI Agents SDK**, and **Amazon Bedrock AgentCore**. See the
[docs](https://fleetwrit.ai/docs/integrations).

## Status

This is a v0 for local development and design partners: auth is off and data
lives in SQLite. Production concerns (OIDC sign-in, Postgres, notifications, HA)
are on the roadmap — see [FLEETWRIT-SPEC.md](FLEETWRIT-SPEC.md).

## Licence

Apache-2.0.
