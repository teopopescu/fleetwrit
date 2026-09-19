# Fleetwrit v0 — run the local demo

The full loop, locally: an agent hits a consequential action → pauses → you
approve in the dashboard → the agent resumes on a signed receipt.

Prereqs: Python 3.10+ and Node 18+.

## 1. Server + SDK + integrations (one venv)

```bash
cd fleetwrit-python
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,langchain]"     # SDK + tests + langgraph
pip install -e ../server              # fleetwrit-server (FastAPI, uvicorn, cryptography)

cd ../server
uvicorn fleetwrit_server.app:app --port 4100
# → http://localhost:4100  (seeded: 3 agents, 5 action types, some pending + history)
```

## 2. Dashboard in live mode (new terminal)

```bash
cd dashboard
npm install
VITE_FLEETWRIT_URL=http://localhost:4100 npm run dev -- --port 5174
# → http://localhost:5174   the top-right chip should read "Live · localhost:4100"
```

Without `VITE_FLEETWRIT_URL` it runs on seeded demo data instead.

## 3. Drive it with a real agent (new terminal)

```bash
cd fleetwrit-python && source .venv/bin/activate

# LangGraph — no LLM key needed. Blocks until you approve in the dashboard.
FLEETWRIT_URL=http://localhost:4100 FLEETWRIT_AGENT_ID=support-refunds \
  python examples/langchain_refund.py

# OpenAI Agents — full agent loop needs OPENAI_API_KEY (runs a no-key gate demo without).
OPENAI_API_KEY=sk-... FLEETWRIT_URL=http://localhost:4100 FLEETWRIT_AGENT_ID=sre-remediation \
  python examples/openai_agents_rollback.py
```

When the agent prints that it is waiting, open the dashboard **Inbox**, open the
new request, and **Approve** (or Approve-with-edits, e.g. cut the refund amount).
The agent resumes and prints the receipt; the decision lands in the **Ledger**.

## Run offline (no server, no key)

```bash
cd fleetwrit-python && source .venv/bin/activate
python examples/langchain_refund.py        # auto-approves via fleetwrit.testing
python examples/openai_agents_rollback.py
pytest                                      # 36 tests
```

## What's real vs stubbed in v0

Built and working: SDK (approve/input/choose, @action, fingerprint,
decision.authorize, fleetwrit.testing, CLI); LangGraph + OpenAI-Agents gate
integrations + examples; FastAPI+SQLite server with a hash-chained ledger and
Ed25519 receipts; the React dashboard (live or seeded). Stubbed/planned: OIDC
sign-in (auth is off locally), notifications, OPA/Cedar live adapters, LlamaIndex
+ AgentCore integrations, Helm/compose, Postgres and the payload-split table.
See FLEETWRIT-SPEC.md §16.
