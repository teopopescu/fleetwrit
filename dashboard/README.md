# Fleetwrit Dashboard (v0)

The reviewer + platform-owner + auditor surface for Fleetwrit — the independent
authorisation record for consequential AI-agent actions. This is a runnable v0
SPA on seeded synthetic data with **auth off** (local/demo mode). No backend,
no network.

## Run

```bash
cd dashboard
npm install
npm run dev      # serves on http://localhost:5174
```

Build / preview:

```bash
npm run build    # tsc + vite build
npm run preview  # serve the production build on 5174
```

## Live mode

By default the app runs off the in-memory seed with no network. Point it at a
running Fleetwrit server by setting `VITE_FLEETWRIT_URL`:

```bash
cp .env.example .env.local   # sets VITE_FLEETWRIT_URL=http://localhost:4100
npm run dev
```

When `VITE_FLEETWRIT_URL` is set the dashboard fetches overview, inbox, agents,
action types and the ledger on mount, polls inbox + overview every 3s (so new
agent requests appear), and POSTs decisions to `/v1/requests/{id}/decide`. The
`src/data/api.ts` client maps the server's `/v1` JSON onto the internal types in
`src/data/types.ts`, so the pages are unchanged. Request detail loads the single
request via `GET /v1/requests/{id}` and shows the server's returned fingerprint
in the receipt; the Ledger "Verify chain" button calls `GET /v1/ledger/verify`.
The top-bar chip shows `Live · <host>` when connected, `Demo data · auth off`
otherwise. Unset the variable (or remove `.env.local`) to return to seed mode.
The Agents disable toggle stays client-only in both modes.

## Stack

Vite + React 18 + TypeScript + react-router-dom. Fonts self-hosted via
`@fontsource` (Instrument Serif, Public Sans, Spline Sans Mono Variable). Dev
server pinned to port **5174** so it never clashes with the marketing site
(4321).

## Screens

1. **Overview** — stat tiles (pending, human-minutes with a drawn down-arrow,
   7-day decisions, undeclared actions), pending-by-queue, agents-by-runtime,
   integration health, coverage gaps, and a "Ledger chain intact" stamp. Fully
   functional (pending / undeclared counts derive live from the store).
2. **Inbox** — pending requests sorted by risk then soonest expiry, filterable
   by queue. Rows link into the request detail. Fully functional.
3. **Request detail** — the core screen. Rendered args (Money `£`, version
   `v41 → v42`), context, provenance, the OPA policy verdict, the fingerprint,
   and prior decisions on the same action type. Approve / Approve-with-edits
   (only editable fields; required reason; live new fingerprint) / Reject
   (required reason). Irreversible or critical actions require a typed
   confirmation (e.g. type `ROLL BACK`). On decision the shared store updates
   Inbox + Overview, a signed receipt prints, and a ledger event is appended.
   Fully functional, all client-side.
4. **Agents** — id, environment, runtime, SDK version, last seen, action types,
   30-day volume, and a client-side Disable toggle.
5. **Action catalog** — type, title, risk, reversible, owner, versions, agents
   using it, approval rate, with an "undeclared" flag on one type.
6. **Ledger** — append-only events newest-first (seq, ts, actor, event, payload
   hash), a chain-intact badge, a client-side "Verify chain" button, and a
   search box (fingerprint / agent / reviewer / event).
7. **Settings** — read-only stub: IdP (Okta demo), auth off, signing key,
   Slack webhook, email digest, OPA bundle, and queue routing.

## Design

Ported from the site's "office of record" system into this app's own CSS
(`src/styles/global.css`) — tokens are copied verbatim, nothing is imported
from `/site`. Bond-paper ground, one ultramarine accent, hairline rules over
shadows (only the decision instrument and printed receipt are lifted), state as
struck stamp-chips, tabular mono for every figure. All icons/arrows/checks are
inline SVG with one consistent stroke — no unicode or emoji.

## State

A single `useReducer` store (`src/store/store.tsx`) via React context holds
agents, action types, requests and the ledger. Deciding a request in Request
detail mutates that store, so Inbox counts, Overview stats and the Ledger all
update live within the session.

## What is stubbed / synthetic

- All data is seeded (`src/data/seed.ts`) and resets on reload — there is no
  persistence.
- Fingerprint hashing (`src/data/fingerprint.ts`) is a fast non-cryptographic
  FNV-1a used only to produce real-looking, payload-dependent hashes for demo.
- Overview's "Human minutes / 1,000 tasks" (38) and "Decisions last 7 days"
  (312) are seeded rolling aggregates, not derived from the handful of demo
  events. "Pending now" and "Undeclared actions" derive live from the store.
- Settings is read-only (no writes). Time-left / ages are static seeded values
  (no live countdown).
