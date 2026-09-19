# Fleetwrit — repository plan

How many repositories we need, when to create each, and what lives where. This
follows the "Open-source boundary and repo layout" section of the MVP spec: start
with the fewest repos that work, split only when a split earns its keep.

## Short answer

- **Build 2 public repositories now** (Pilot Core).
- **Add 1 private repository** only once you founder-host a partner.
- **Grow to 4 public + 1 private** at public launch (0.1.0 / Post-evidence).

Splitting earlier costs a solo maintainer CI setup and cross-repo version pinning
for no partner benefit.

## Phase 1 — now (Pilot Core): 2 public repos

| Repo | Contents | Publishes |
|------|----------|-----------|
| `fleetwrit-python` | SDK core, action catalog, policy hook, integrations, CLI, `fleetwrit.testing`, examples. Protocol JSON Schemas + conformance vectors live in a `protocol/` folder here for now. | `fleetwrit` on PyPI |
| `fleetwrit` | FastAPI server, React dashboard, migrations, docker-compose, AgentCore interceptor, system + fault-injection tests, deploy assets. The one-page **site lives in `site/`** here until the full site is split out. | `fleetwrit-server` on PyPI · image on `ghcr.io/fleetwrit/server` · Helm chart on GHCR · AgentCore Lambda zip |

Layout inside each:

```
fleetwrit-python/
  src/fleetwrit/              client, actions, policy, testing, cli
  src/fleetwrit/integrations/ langchain, llamaindex, openai_agents, agentcore
  protocol/                   JSON Schemas + conformance vectors (pinned by both repos)
  tests/  examples/  noxfile.py  pyproject.toml

fleetwrit/
  server/      FastAPI app, OIDC, ledger, migrations, tests
  dashboard/   React SPA, component + Playwright tests
  interceptor/ AgentCore Lambda, SAM template, tests
  system-tests/ full stack, fault injection, load
  site/        Astro landing page + docs + data/integrations.json   ← the site being built now
  deploy/      Dockerfile, docker-compose.yml
```

Cross-repo contract: both repos pin a `fleetwrit-protocol` tag (a git tag in
`fleetwrit-python` for now) and run its conformance vectors. A merge to either
repo's main triggers the system suite against the other's latest build.

## Phase 2 — when you founder-host a partner: +1 private repo

| Repo | Contents | Visibility |
|------|----------|-----------|
| `fleetwrit-ops` | Terraform module for founder-hosted single-tenant instances (namespace, DB, signing keys per partner), and the per-partner feedback logs. | Private |

Only needed if a partner chooses founder-hosting over running the Helm chart
themselves. Partner-hosted pilots need nothing here.

## Phase 3 — public launch (0.1.0 / Post-evidence): 4 public + 1 private

Split out two repos once they have outside consumers and their own release rhythm:

| Repo | Split from | Trigger to split |
|------|-----------|------------------|
| `fleetwrit-protocol` | `fleetwrit-python/protocol/` | Another runtime or vendor wants to emit the interrupt-request protocol without our SDK. |
| `fleetwrit-site` | `fleetwrit/site/` | The full landing page + docs site needs to deploy on its own cadence, independent of server releases. |

Final target: `fleetwrit-protocol`, `fleetwrit-python`, `fleetwrit`,
`fleetwrit-site` (public) + `fleetwrit-ops` (private).

## Rules

- A protocol change lands in the protocol location first, then both code repos bump the pin.
- Integrations stay inside `fleetwrit-python` until one integration's release cadence or
  maintainer genuinely differs from the SDK's.
- **First simplification if CI drags:** merge `fleetwrit-protocol` back into
  `fleetwrit-python`. Do not split repos on principle.
- Contributions use a DCO sign-off, not a CLA.

## Where the landing page lives

The Astro landing page + docs now live in their own public repo,
[`fleetwrit-site`](https://github.com/teopopescu/fleetwrit-site), which deploys to
GitHub Pages / fleetwrit.dev. It was split out of this repo's `site/` folder
earlier than the original Phase-3 plan so it can ship on its own cadence and stay
public without exposing this repo.
