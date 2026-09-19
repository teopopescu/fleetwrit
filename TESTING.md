# Testing Fleetwrit v0 — how to verify everything that's built

Every component, how to exercise it, and what you should see. Paths are relative
to the repo root (`…/conductor/workspaces/fleetwrit/havana`). See `DEMO.md` for
the one-command demo and `FLEETWRIT-SPEC.md §16` for built-vs-stubbed.

---

## 0. One-time setup (a single venv for SDK + server + integrations)

```bash
cd fleetwrit-python
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,langchain]"     # SDK + pytest + langgraph
pip install -e ../server              # fleetwrit-server (FastAPI, uvicorn, cryptography)
```

Node (for the dashboard and site):

```bash
cd dashboard && npm install
cd ../site && npm install
```

---

## 1. SDK unit tests

```bash
cd fleetwrit-python && source .venv/bin/activate
pytest -q
```
Expect: **36 passed**. Covers fingerprint determinism + idempotency, `@action`
schema derivation/versioning, `decision.authorize()` (incl. approve-with-edits
binding), the testing helpers, policy verdict mapping, and the protocol
conformance vectors.

## 2. SDK offline examples (no server, no LLM key)

```bash
python examples/refund_agent.py        # approve-with-edits £4,000 -> £500, authorize() binds the edit
python examples/sre_agent.py           # policy guard: allow + ask
python examples/langchain_refund.py    # LangGraph StateGraph, gate node auto-approves, prints receipt
python examples/openai_agents_rollback.py   # no-key path: tool-level approval gate runs
```
Each prints its decision and ends with "…complete." (auto-approved by the
in-memory fake).

## 3. Server — start and check endpoints

```bash
cd server && source ../fleetwrit-python/.venv/bin/activate
uvicorn fleetwrit_server.app:app --port 4100
```
In another shell:
```bash
curl -s localhost:4100/healthz                       # {"ok":true}
curl -s localhost:4100/v1/overview                   # pending/decisions/undeclared/agents_by_runtime/chain
curl -s localhost:4100/v1/inbox                      # 4 seeded pending requests
curl -s localhost:4100/v1/ledger/verify              # {"ok":true,"events":N}
curl -s localhost:4100/.well-known/jwks.json         # the receipt-signing public key
```

## 4. Full loop — SDK agent ⇄ server ⇄ reviewer decide (one script)

With the server running:
```bash
cd fleetwrit-python && source .venv/bin/activate
FLEETWRIT_URL=http://localhost:4100 FLEETWRIT_AGENT_ID=support-refunds \
  python examples/langchain_refund.py
```
It prints "Agent proposes…" then blocks. In another shell, approve it as the
dashboard would:
```bash
RID=$(curl -s localhost:4100/v1/inbox | python3 -c "import sys,json;print(next(r['id'] for r in json.load(sys.stdin)['requests'] if r['type']=='refund.issue'))")
curl -s -X POST localhost:4100/v1/requests/$RID/decide \
  -H 'content-type: application/json' \
  -d '{"outcome":"approved","edits":{"amount":50000},"reason":"policy cap"}'
```
The agent resumes and prints `approved=True modified=True … Receipt present: True`
and executes the £500 refund (the edited amount, not the original).

## 5. Dashboard

**Seed mode** (standalone, no server):
```bash
cd dashboard && npm run dev
# http://localhost:5174 — chip reads "Demo data · auth off"
```
Click through Overview (time-range control + decisions chart), Inbox, open a
request, Approve / Approve-with-edits (edit the amount) / Reject (typed
confirmation appears for irreversible/critical), Agents (disable toggle),
Catalog, Ledger (Verify chain).

**Live mode** (reads the running server):
```bash
VITE_FLEETWRIT_URL=http://localhost:4100 npm run dev -- --port 5174
# chip reads "Live · localhost:4100"; Inbox shows the server's requests
```

## 6. End-to-end in the browser (the demo)

Three terminals: (1) server on 4100; (2) `VITE_FLEETWRIT_URL=http://localhost:4100 npm run dev -- --port 5174`;
(3) run the agent from §4. Then in the dashboard Inbox open the new request and
**Approve** — the agent resumes with a receipt and the decision lands in the
Ledger. For OpenAI Agents' full loop, add `OPENAI_API_KEY` and run
`examples/openai_agents_rollback.py` (see §9 for a known issue with that path).

## 7. Record integrity

```bash
# fingerprint is deterministic and order-independent
python -c "from fleetwrit.fingerprint import fingerprint as f; print(f(type='t',version='1',tool=None,args={'a':1,'b':2},agent_id='x',environment='prod')==f(type='t',version='1',tool=None,args={'b':2,'a':1},agent_id='x',environment='prod'))"  # True
# ledger tamper check (server): edit a ledger row in the SQLite db, then:
curl -s localhost:4100/v1/ledger/verify   # should report ok:false + broken_seq (see §9 caveat)
```

## 8. Site (landing + docs)

```bash
cd site && npm run dev     # http://localhost:4321  and /docs
npm run build              # static build must pass
```

---

## 9. Known gaps — what will NOT pass yet (from the Codex review + spec §16)

These are real and worth knowing before you test them:

- **Redaction not applied.** `@action(redact=[...])` still sends plaintext args to
  the server. Do not rely on redaction yet.
- **Server expiry not enforced.** A past-`expires_at` request stays pending and can
  still be approved; the SDK's local timeout doesn't expire the server record.
- **Ledger hash omits `actor`/`ts`** and `verify_chain` ignores the stored
  `prev_hash`, so editing who/when on an existing row is not detected (the §7
  tamper test only catches payload/event/order changes, not actor/ts edits).
- **OpenAI Agents real-agent path** (`OPENAI_API_KEY` set) currently fails schema
  generation because the tool wrapper drops the function signature — the no-key
  gate demo works; the full `Runner.run` path does not start yet.
- **`input()` / `choose()` over the live server** return `None` (the server treats
  every non-reject as an approve and doesn't persist value/option). Use `approve`
  for now.
- Dashboard: reviewer edits submit as strings; money currency is assumed GBP;
  ledger "Verify chain" in the browser can show "broken" once the server has >200
  events (server-side verify is correct).
- Not built at all: OIDC sign-in (auth is off locally), notifications, live
  OPA/Cedar adapters, LlamaIndex + AgentCore integrations, Helm/compose, Postgres.

The four P1s above (redaction, expiry, ledger actor/ts, OpenAI tool signature) are
small, well-scoped fixes if you want them addressed next.
