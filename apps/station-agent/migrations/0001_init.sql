-- Estado local de la máquina (ADR-002). Las fotografías nunca están aquí: sólo rutas.
CREATE TABLE kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  stage TEXT NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ended_at TEXT,
  delete_at TEXT,
  deleted_at TEXT
);
CREATE INDEX sessions_stage ON sessions (stage);
CREATE INDEX sessions_delete_at ON sessions (delete_at);

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX print_jobs_key ON print_jobs (session_id, idempotency_key);

CREATE TABLE payment_intents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  state TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX outbox_pending ON outbox (delivered_at, sequence);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX events_at ON events (at);

CREATE TABLE tests (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  at TEXT NOT NULL,
  json TEXT NOT NULL
);

CREATE TABLE inbox (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  executed_at TEXT,
  result TEXT
);
