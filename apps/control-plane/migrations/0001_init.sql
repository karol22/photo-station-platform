-- Esquema inicial del plano de control (ADR-002: SQLite, SQL explícito, JSON por entidad).
-- Tabla genérica de entidades: cada colección del dataset es un `type`; las columnas de alcance
-- se extraen del JSON al guardar para filtrar por jerarquía sin abrir el documento.
CREATE TABLE entities (
  type TEXT NOT NULL,
  id TEXT NOT NULL,
  organization_id TEXT,
  franchise_id TEXT,
  region_id TEXT,
  location_id TEXT,
  machine_id TEXT,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (type, id)
);
CREATE INDEX idx_entities_type_org ON entities(type, organization_id);
CREATE INDEX idx_entities_type_franchise ON entities(type, franchise_id);
CREATE INDEX idx_entities_type_location ON entities(type, location_id);

-- Libro de sesiones: sólo `SessionRecord` (nunca fotografías).
CREATE TABLE session_records (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  franchise_id TEXT,
  location_id TEXT,
  product_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  result TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  json TEXT NOT NULL
);
CREATE INDEX idx_session_records_machine ON session_records(machine_id, started_at);
CREATE INDEX idx_session_records_org ON session_records(organization_id, started_at);

CREATE TABLE machine_events (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL,
  at TEXT NOT NULL,
  type TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX idx_machine_events_machine ON machine_events(machine_id, at);

CREATE TABLE audit_entries (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  organization_id TEXT,
  origin TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX idx_audit_entries_at ON audit_entries(at);
CREATE INDEX idx_audit_entries_entity ON audit_entries(entity_type, entity_id);

CREATE TABLE heartbeats (
  machine_id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  at TEXT NOT NULL
);

-- Idempotencia de eventos de flota.
CREATE TABLE fleet_events_seen (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE machine_release_states (
  machine_id TEXT PRIMARY KEY,
  rollout_id TEXT,
  status TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_machine_release_states_rollout ON machine_release_states(rollout_id);

CREATE TABLE commands (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL,
  json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  acked_at TEXT,
  result TEXT
);
CREATE INDEX idx_commands_machine ON commands(machine_id, acked_at);

CREATE TABLE machine_credentials (
  machine_id TEXT PRIMARY KEY,
  secret TEXT NOT NULL
);

CREATE TABLE auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Caché de bundles materializados por máquina.
CREATE TABLE bundles (
  machine_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);
