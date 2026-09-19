# fleetwrit-server

[![test-server](https://github.com/teopopescu/fleetwrit/actions/workflows/test-server.yml/badge.svg)](https://github.com/teopopescu/fleetwrit/actions/workflows/test-server.yml)

The local Fleetwrit server: a FastAPI + SQLite service that receives agent
requests, records decisions and a hash-chained ledger, signs receipts, and
serves the ops dashboard (bundled in). It's the backend the
[`fleetwrit`](https://pypi.org/project/fleetwrit/) SDK talks to.

For local development, install the SDK with the `dev-server` extra and run both
with one command:

```bash
pip install "fleetwrit[dev-server]"
fleetwrit dev        # server API + dashboard on http://localhost:4100 (starts empty)
```

`fleetwrit dev --demo` loads sample agents and requests. See the
[fleetwrit repo](https://github.com/teopopescu/fleetwrit) for Docker and more.

Apache-2.0.
