CREATE TABLE IF NOT EXISTS agents(
  agent_id TEXT, environment TEXT, version TEXT, runtime TEXT,
  owner TEXT, last_seen TEXT, disabled INTEGER DEFAULT 0,
  volume30d INTEGER DEFAULT 0,
  PRIMARY KEY(agent_id, environment));

CREATE TABLE IF NOT EXISTS action_types(
  type TEXT PRIMARY KEY, version TEXT, title TEXT, risk TEXT,
  reversible INTEGER, editable TEXT, queue TEXT, owner TEXT,
  summary TEXT, args_schema TEXT, display TEXT,
  undeclared INTEGER DEFAULT 0, approval_rate REAL);

CREATE TABLE IF NOT EXISTS requests(
  id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE, kind TEXT,
  agent_id TEXT, environment TEXT, type TEXT, action_version TEXT,
  tool TEXT, args TEXT, reversible INTEGER, fingerprint TEXT,
  summary TEXT, context TEXT, queue TEXT, provenance TEXT,
  risk TEXT, editable TEXT, title TEXT, display TEXT,
  created_at TEXT, expires_at TEXT, on_expiry TEXT,
  state TEXT, viewed_at TEXT, verdict TEXT);

CREATE TABLE IF NOT EXISTS decisions(
  request_id TEXT PRIMARY KEY, outcome TEXT, final_args TEXT,
  original_fingerprint TEXT, final_fingerprint TEXT, reason TEXT,
  reviewer TEXT, receipt TEXT, value TEXT, option TEXT,
  decided_at TEXT, consumed_at TEXT);

CREATE TABLE IF NOT EXISTS ledger(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, actor TEXT,
  event TEXT, payload_hash TEXT, refs TEXT, prev_hash TEXT, hash TEXT);
