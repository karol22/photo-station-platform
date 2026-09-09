/**
 * Persistencia del plano de control sobre @psp/sqlite.
 *
 * `entities` guarda cada colección del dataset como JSON con columnas de alcance extraídas;
 * el resto son tablas dedicadas (sesiones, eventos, auditoría, heartbeats, releases, comandos,
 * credenciales, tokens y caché de bundles). Todo el SQL vive aquí.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import type {
  AuditEntry,
  CommandAck,
  FleetCommand,
  HeartbeatRequest,
  Id,
  MachineEvent,
  MachineReleaseState,
  Scope,
  SessionRecord,
} from '@psp/contracts';
import {
  execute,
  jsonParse,
  loadMigrationsDir,
  migrate,
  openDatabase,
  selectAll,
  selectOne,
  transaction,
  type DatabaseSync,
  type Row,
} from '@psp/sqlite';

export type EntityType =
  | 'organizations'
  | 'franchises'
  | 'territories'
  | 'regions'
  | 'locations'
  | 'machines'
  | 'hardwareProfiles'
  | 'blueprints'
  | 'users'
  | 'roleAssignments'
  | 'supportAccesses'
  | 'products'
  | 'productAvailabilities'
  | 'priceRules'
  | 'promotions'
  | 'presets'
  | 'presetVersions'
  | 'templates'
  | 'experiences'
  | 'editingPresets'
  | 'campaigns'
  | 'assets'
  | 'retentionPolicies'
  | 'maintenanceChecklists'
  | 'configLayers'
  | 'featureOverrides'
  | 'entitlementPlans'
  | 'entitlements'
  | 'releases'
  | 'rollouts'
  | 'internalDocuments'
  | 'announcements'
  | 'incidents'
  | 'maintenanceLogs'
  | 'consumables'
  | 'savedViews'
  | 'credentials';

/** Columnas de alcance de una entidad, derivadas de su JSON. */
export interface ScopeColumns {
  organizationId?: Id;
  franchiseId?: Id;
  regionId?: Id;
  locationId?: Id;
  machineId?: Id;
}

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Abre la base (archivo o `:memory:`) y aplica las migraciones del directorio `migrations/`. */
export function openControlPlaneDb(path: string): DatabaseSync {
  const db = openDatabase(path);
  migrate(db, loadMigrationsDir(MIGRATIONS_DIR));
  return db;
}

function scopeToColumns(scope: Scope | undefined): ScopeColumns {
  if (!scope || scope.level === 'platform' || scope.id === undefined) return {};
  switch (scope.level) {
    case 'organization':
      return { organizationId: scope.id };
    case 'franchise':
      return { franchiseId: scope.id };
    case 'region':
      return { regionId: scope.id };
    case 'location':
      return { locationId: scope.id };
    case 'machine':
      return { machineId: scope.id };
    default:
      return {};
  }
}

/**
 * Extrae las columnas de alcance de una entidad: campos explícitos (`organizationId`…), el propio
 * id para las entidades de jerarquía y `scope`/`ownerScope` para las entidades por alcance.
 */
export function scopeColumnsOf(type: EntityType, entity: Record<string, unknown>): ScopeColumns {
  const str = (key: string): Id | undefined => (typeof entity[key] === 'string' ? (entity[key] as string) : undefined);
  const out: ScopeColumns = {};
  const explicit: ScopeColumns = {
    organizationId: str('organizationId'),
    franchiseId: str('franchiseId'),
    regionId: str('regionId'),
    locationId: str('locationId'),
    machineId: str('machineId'),
  };
  const scoped = scopeToColumns((entity['scope'] ?? entity['ownerScope']) as Scope | undefined);
  Object.assign(out, scoped, Object.fromEntries(Object.entries(explicit).filter(([, v]) => v !== undefined)));
  const id = str('id');
  if (id !== undefined) {
    if (type === 'organizations') out.organizationId = id;
    if (type === 'franchises') out.franchiseId = id;
    if (type === 'regions') out.regionId = id;
    if (type === 'locations') out.locationId = id;
    if (type === 'machines') out.machineId = id;
  }
  return out;
}

const rowJson = <T>(row: Row): T => JSON.parse(String(row['json'])) as T;

/** Repositorio genérico de entidades JSON tipadas por esquema zod. */
export class EntityRepo {
  constructor(readonly db: DatabaseSync) {}

  list<T>(type: EntityType, filter: ScopeColumns = {}): T[] {
    const clauses: string[] = ['type = ?'];
    const params: unknown[] = [type];
    const add = (column: string, value: string | undefined): void => {
      if (value === undefined) return;
      clauses.push(`${column} = ?`);
      params.push(value);
    };
    add('organization_id', filter.organizationId);
    add('franchise_id', filter.franchiseId);
    add('region_id', filter.regionId);
    add('location_id', filter.locationId);
    add('machine_id', filter.machineId);
    return selectAll(this.db, `SELECT json FROM entities WHERE ${clauses.join(' AND ')} ORDER BY id`, params, rowJson<T>);
  }

  get<T>(type: EntityType, id: Id): T | undefined {
    return selectOne(this.db, 'SELECT json FROM entities WHERE type = ? AND id = ?', [type, id], rowJson<T>);
  }

  put<T extends { id: string }>(type: EntityType, entity: T, updatedAt: string): T {
    const columns = scopeColumnsOf(type, entity as unknown as Record<string, unknown>);
    execute(
      this.db,
      `INSERT INTO entities (type, id, organization_id, franchise_id, region_id, location_id, machine_id, json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(type, id) DO UPDATE SET organization_id = excluded.organization_id, franchise_id = excluded.franchise_id,
         region_id = excluded.region_id, location_id = excluded.location_id, machine_id = excluded.machine_id,
         json = excluded.json, updated_at = excluded.updated_at`,
      [
        type,
        entity.id,
        columns.organizationId ?? null,
        columns.franchiseId ?? null,
        columns.regionId ?? null,
        columns.locationId ?? null,
        columns.machineId ?? null,
        JSON.stringify(entity),
        updatedAt,
      ],
    );
    return entity;
  }

  delete(type: EntityType, id: Id): boolean {
    return execute(this.db, 'DELETE FROM entities WHERE type = ? AND id = ?', [type, id]).changes > 0;
  }

  deleteAll(type: EntityType): number {
    return Number(execute(this.db, 'DELETE FROM entities WHERE type = ?', [type]).changes);
  }

  count(type: EntityType): number {
    const row = selectOne(this.db, 'SELECT COUNT(*) AS n FROM entities WHERE type = ?', [type]);
    return Number(row?.['n'] ?? 0);
  }

  /** Valida con el esquema y guarda; lanza si el JSON almacenado no cumple el contrato. */
  putValidated<S extends z.ZodTypeAny>(type: EntityType, schema: S, entity: unknown, updatedAt: string): z.output<S> {
    const parsed = schema.safeParse(entity);
    if (!parsed.success) throw new Error(`Invalid ${type}: ${parsed.error.message}`);
    return this.put(type, parsed.data as { id: string }, updatedAt) as z.output<S>;
  }
}

/* ---------- tablas dedicadas ---------- */

export interface SessionFilter {
  organizationId?: Id;
  franchiseId?: Id;
  locationId?: Id;
  machineId?: Id;
  machineIds?: Id[];
  productId?: Id;
  from?: string;
  to?: string;
  includeDemo?: boolean;
}

export function sessionWhere(filter: SessionFilter): { where: string; params: unknown[] } {
  const clauses: string[] = ['1 = 1'];
  const params: unknown[] = [];
  const add = (column: string, value: string | undefined): void => {
    if (value === undefined) return;
    clauses.push(`${column} = ?`);
    params.push(value);
  };
  add('organization_id', filter.organizationId);
  add('franchise_id', filter.franchiseId);
  add('location_id', filter.locationId);
  add('machine_id', filter.machineId);
  add('product_id', filter.productId);
  if (filter.machineIds && filter.machineIds.length > 0) {
    clauses.push(`machine_id IN (${filter.machineIds.map(() => '?').join(',')})`);
    params.push(...filter.machineIds);
  }
  if (filter.from !== undefined) {
    clauses.push('started_at >= ?');
    params.push(filter.from);
  }
  if (filter.to !== undefined) {
    clauses.push('started_at < ?');
    params.push(filter.to);
  }
  if (!filter.includeDemo) clauses.push('is_demo = 0');
  return { where: clauses.join(' AND '), params };
}

export function putSessionRecord(db: DatabaseSync, record: SessionRecord): void {
  execute(
    db,
    `INSERT INTO session_records (id, machine_id, organization_id, franchise_id, location_id, product_id, started_at, ended_at, result, is_demo, json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ended_at = excluded.ended_at, result = excluded.result, json = excluded.json`,
    [
      record.id,
      record.machineId,
      record.organizationId,
      record.franchiseId ?? null,
      record.locationId ?? null,
      record.productId,
      record.startedAt,
      record.endedAt ?? null,
      record.result ?? null,
      record.isDemo ? 1 : 0,
      JSON.stringify(record),
    ],
  );
}

export function listSessionRecords(db: DatabaseSync, filter: SessionFilter, limit = 100000): SessionRecord[] {
  const { where, params } = sessionWhere(filter);
  return selectAll(db, `SELECT json FROM session_records WHERE ${where} ORDER BY started_at DESC LIMIT ?`, [...params, limit], rowJson<SessionRecord>);
}

export function putMachineEvent(db: DatabaseSync, event: MachineEvent): void {
  execute(
    db,
    'INSERT OR REPLACE INTO machine_events (id, machine_id, at, type, json) VALUES (?, ?, ?, ?, ?)',
    [event.id, event.machineId, event.at, event.type, JSON.stringify(event)],
  );
}

export function listMachineEvents(
  db: DatabaseSync,
  machineId: Id,
  opts: { from?: string; to?: string; types?: string[]; limit: number },
): MachineEvent[] {
  const clauses = ['machine_id = ?'];
  const params: unknown[] = [machineId];
  if (opts.from !== undefined) {
    clauses.push('at >= ?');
    params.push(opts.from);
  }
  if (opts.to !== undefined) {
    clauses.push('at <= ?');
    params.push(opts.to);
  }
  if (opts.types && opts.types.length > 0) {
    clauses.push(`type IN (${opts.types.map(() => '?').join(',')})`);
    params.push(...opts.types);
  }
  return selectAll(
    db,
    `SELECT json FROM machine_events WHERE ${clauses.join(' AND ')} ORDER BY at DESC LIMIT ?`,
    [...params, opts.limit],
    rowJson<MachineEvent>,
  );
}

export function putAuditEntry(db: DatabaseSync, entry: AuditEntry, organizationId?: Id): void {
  execute(
    db,
    `INSERT OR REPLACE INTO audit_entries (id, at, actor_id, action, entity_type, entity_id, organization_id, origin, json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.at, entry.actor.id ?? null, entry.action, entry.entityType, entry.entityId ?? null, organizationId ?? null, entry.origin, JSON.stringify(entry)],
  );
}

export function listAuditEntries(
  db: DatabaseSync,
  filter: { entityType?: string; entityId?: Id; actorId?: Id; action?: string; from?: string; to?: string; organizationId?: Id },
  limit = 5000,
): AuditEntry[] {
  const clauses = ['1 = 1'];
  const params: unknown[] = [];
  const add = (column: string, value: string | undefined): void => {
    if (value === undefined) return;
    clauses.push(`${column} = ?`);
    params.push(value);
  };
  add('entity_type', filter.entityType);
  add('entity_id', filter.entityId);
  add('actor_id', filter.actorId);
  add('action', filter.action);
  add('organization_id', filter.organizationId);
  if (filter.from !== undefined) {
    clauses.push('at >= ?');
    params.push(filter.from);
  }
  if (filter.to !== undefined) {
    clauses.push('at <= ?');
    params.push(filter.to);
  }
  return selectAll(db, `SELECT json FROM audit_entries WHERE ${clauses.join(' AND ')} ORDER BY at DESC LIMIT ?`, [...params, limit], rowJson<AuditEntry>);
}

export function putHeartbeat(db: DatabaseSync, heartbeat: HeartbeatRequest): void {
  execute(db, 'INSERT OR REPLACE INTO heartbeats (machine_id, json, at) VALUES (?, ?, ?)', [heartbeat.machineId, JSON.stringify(heartbeat), heartbeat.at]);
}

export function getHeartbeat(db: DatabaseSync, machineId: Id): HeartbeatRequest | undefined {
  return selectOne(db, 'SELECT json FROM heartbeats WHERE machine_id = ?', [machineId], rowJson<HeartbeatRequest>);
}

export function listHeartbeats(db: DatabaseSync): HeartbeatRequest[] {
  return selectAll(db, 'SELECT json FROM heartbeats', [], rowJson<HeartbeatRequest>);
}

export function markEventSeen(db: DatabaseSync, id: Id, machineId: Id, at: string): boolean {
  return execute(db, 'INSERT OR IGNORE INTO fleet_events_seen (id, machine_id, at) VALUES (?, ?, ?)', [id, machineId, at]).changes > 0;
}

export function putReleaseState(db: DatabaseSync, state: MachineReleaseState): void {
  execute(
    db,
    'INSERT OR REPLACE INTO machine_release_states (machine_id, rollout_id, status, json, updated_at) VALUES (?, ?, ?, ?, ?)',
    [state.machineId, state.rolloutId ?? null, state.status, JSON.stringify(state), state.updatedAt],
  );
}

export function getReleaseState(db: DatabaseSync, machineId: Id): MachineReleaseState | undefined {
  return selectOne(db, 'SELECT json FROM machine_release_states WHERE machine_id = ?', [machineId], rowJson<MachineReleaseState>);
}

export function listReleaseStates(db: DatabaseSync, rolloutId?: Id): MachineReleaseState[] {
  if (rolloutId === undefined) return selectAll(db, 'SELECT json FROM machine_release_states', [], rowJson<MachineReleaseState>);
  return selectAll(db, 'SELECT json FROM machine_release_states WHERE rollout_id = ?', [rolloutId], rowJson<MachineReleaseState>);
}

export function putCommand(db: DatabaseSync, command: FleetCommand, machineId: Id): void {
  execute(
    db,
    'INSERT OR REPLACE INTO commands (id, machine_id, json, issued_at, expires_at, acked_at, result) VALUES (?, ?, ?, ?, ?, NULL, NULL)',
    [command.id, machineId, JSON.stringify(command), command.issuedAt, command.expiresAt ?? null],
  );
}

export function pendingCommands(db: DatabaseSync, machineId: Id, now: string): FleetCommand[] {
  return selectAll(
    db,
    'SELECT json FROM commands WHERE machine_id = ? AND acked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY issued_at',
    [machineId, now],
    rowJson<FleetCommand>,
  );
}

export function ackCommand(db: DatabaseSync, ack: CommandAck): boolean {
  return (
    execute(db, 'UPDATE commands SET acked_at = ?, result = ? WHERE id = ? AND machine_id = ? AND acked_at IS NULL', [ack.at, ack.result, ack.commandId, ack.machineId])
      .changes > 0
  );
}

export function putCredential(db: DatabaseSync, machineId: Id, secret: string): void {
  execute(db, 'INSERT OR REPLACE INTO machine_credentials (machine_id, secret) VALUES (?, ?)', [machineId, secret]);
}

export function getCredential(db: DatabaseSync, machineId: Id): string | undefined {
  const row = selectOne(db, 'SELECT secret FROM machine_credentials WHERE machine_id = ?', [machineId]);
  return row ? String(row['secret']) : undefined;
}

export function putToken(db: DatabaseSync, token: string, userId: Id, expiresAt: string): void {
  execute(db, 'INSERT OR REPLACE INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userId, expiresAt]);
}

export function getToken(db: DatabaseSync, token: string): { userId: Id; expiresAt: string } | undefined {
  const row = selectOne(db, 'SELECT user_id, expires_at FROM auth_tokens WHERE token = ?', [token]);
  return row ? { userId: String(row['user_id']), expiresAt: String(row['expires_at']) } : undefined;
}

export function getCachedBundle<T>(db: DatabaseSync, machineId: Id): T | undefined {
  return selectOne(db, 'SELECT json FROM bundles WHERE machine_id = ?', [machineId], rowJson<T>);
}

export function putCachedBundle(db: DatabaseSync, machineId: Id, version: string, bundle: unknown, generatedAt: string): void {
  execute(db, 'INSERT OR REPLACE INTO bundles (machine_id, version, json, generated_at) VALUES (?, ?, ?, ?)', [machineId, version, JSON.stringify(bundle), generatedAt]);
}

export function invalidateBundles(db: DatabaseSync, machineIds?: Id[]): void {
  if (machineIds === undefined) {
    execute(db, 'DELETE FROM bundles');
    return;
  }
  if (machineIds.length === 0) return;
  execute(db, `DELETE FROM bundles WHERE machine_id IN (${machineIds.map(() => '?').join(',')})`, machineIds);
}

export function countRows(db: DatabaseSync, table: string): number {
  const row = selectOne(db, `SELECT COUNT(*) AS n FROM ${table}`);
  return Number(row?.['n'] ?? 0);
}

export { transaction, jsonParse };
