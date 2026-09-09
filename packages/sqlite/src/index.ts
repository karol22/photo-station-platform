/**
 * @psp/sqlite: envoltura mínima de `node:sqlite` (ADR-002).
 *
 * Sin ORM: el SQL es explícito. Este paquete abre bases con WAL y claves foráneas, aplica
 * migraciones SQL numeradas de forma transaccional e idempotente, envuelve transacciones con
 * savepoints anidados y ofrece utilidades de repositorio (JSON, tiempo, paginación).
 * Superficie pública fijada en docs/arquitectura/01-apis-de-paquetes.md (sección @psp/sqlite).
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue, SQLOutputValue, StatementResultingChanges } from 'node:sqlite';

export type { DatabaseSync, SQLInputValue, SQLOutputValue, StatementResultingChanges };

export const MEMORY = ':memory:';

export interface OpenDatabaseOptions {
  /** Activa `journal_mode=WAL` en bases en disco. Por defecto `true`; no aplica en memoria. */
  wal?: boolean;
  /** Abre en solo lectura (el archivo debe existir). */
  readOnly?: boolean;
  /** Tiempo de espera ante bloqueos (`busy_timeout`), en milisegundos. Por defecto 5000. */
  timeoutMs?: number;
}

export interface Migration {
  /** Nombre único y estable, p. ej. `0001_init`. Se registra en `_migrations`. */
  name: string;
  /** SQL completo de la migración; puede tener varias sentencias. No debe abrir transacciones. */
  sql: string;
}

export interface AppliedMigration {
  name: string;
  appliedAt: string;
}

export type Row = Record<string, SQLOutputValue>;

export interface PaginateInput<T> {
  /** Consulta sin `LIMIT`/`OFFSET`; `paginate` los agrega. */
  sql: string;
  /** Consulta cuyo primer valor de la primera fila es el total; recibe los mismos `params`. */
  countSql: string;
  params: unknown[];
  /** Página 1-based; valores menores se normalizan a 1. */
  page: number;
  pageSize: number;
  map?: (row: Row) => T;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** Número total de páginas (0 cuando no hay filas). */
  pages: number;
}

function isMemoryPath(path: string): boolean {
  return path === MEMORY || path === '' || /mode=memory/.test(path);
}

/**
 * Abre (o crea) una base. Crea el directorio padre si hace falta, activa claves foráneas y,
 * en bases en disco, `journal_mode=WAL` con `synchronous=NORMAL`.
 */
export function openDatabase(path: string | ':memory:', opts: OpenDatabaseOptions = {}): DatabaseSync {
  const memory = isMemoryPath(path);
  if (!memory && !path.startsWith('file:')) mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path, {
    enableForeignKeyConstraints: true,
    readOnly: opts.readOnly ?? false,
    timeout: opts.timeoutMs ?? 5000,
  });
  db.exec('PRAGMA foreign_keys = ON');
  if (!memory && (opts.wal ?? true) && !opts.readOnly) {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
  }
  return db;
}

let savepointSeq = 0;

/**
 * Ejecuta `fn` dentro de una transacción (`BEGIN IMMEDIATE`). Si `fn` lanza, revierte y relanza.
 * Si ya hay una transacción abierta, usa un `SAVEPOINT`, de modo que las llamadas anidadas
 * revierten sólo su parte. `fn` debe ser síncrona.
 */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) {
    const savepoint = `psp_sp_${++savepointSeq}`;
    db.exec(`SAVEPOINT ${savepoint}`);
    try {
      const result = fn();
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    }
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

const MIGRATION_NAME = /^[A-Za-z0-9][\w.-]*$/;

function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
}

/**
 * Aplica las migraciones que aún no están en `_migrations`, en el orden recibido, cada una en su
 * propia transacción: una migración fallida no deja efectos parciales ni queda registrada.
 * Es idempotente: volver a llamar con la misma lista no aplica nada.
 */
export function migrate(
  db: DatabaseSync,
  migrations: Migration[],
  opts: { clock?: () => Date } = {},
): { applied: string[] } {
  const seen = new Set<string>();
  for (const migration of migrations) {
    if (!MIGRATION_NAME.test(migration.name)) {
      throw new Error(`Invalid migration name: "${migration.name}"`);
    }
    if (seen.has(migration.name)) throw new Error(`Duplicate migration name: "${migration.name}"`);
    seen.add(migration.name);
  }
  ensureMigrationsTable(db);
  const done = new Set(appliedMigrations(db).map((m) => m.name));
  const insert = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
  const applied: string[] = [];
  for (const migration of migrations) {
    if (done.has(migration.name)) continue;
    try {
      transaction(db, () => {
        db.exec(migration.sql);
        insert.run(migration.name, nowIso(opts.clock));
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration "${migration.name}" failed: ${message}`, { cause: error });
    }
    applied.push(migration.name);
  }
  return { applied };
}

/** Migraciones registradas en `_migrations`, ordenadas por nombre. */
export function appliedMigrations(db: DatabaseSync): AppliedMigration[] {
  ensureMigrationsTable(db);
  return db
    .prepare('SELECT name, applied_at FROM _migrations ORDER BY name')
    .all()
    .map((row) => ({ name: String(row['name']), appliedAt: String(row['applied_at']) }));
}

/**
 * Lee los archivos `*.sql` de un directorio (sin recorrer subdirectorios) ordenados por nombre
 * (comparación por unidades de código, estable entre plataformas). El nombre de la migración es el
 * nombre del archivo sin extensión; la convención es `NNNN_nombre.sql`. Ignora cualquier otro archivo.
 */
export function loadMigrationsDir(dir: string): Migration[] {
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return files.map((file) => ({
    name: file.replace(/\.sql$/i, ''),
    sql: readFileSync(join(dir, file), 'utf8'),
  }));
}

/** Convierte un valor de JS al tipo que acepta `node:sqlite`: booleanos a 0/1, fechas a ISO, objetos a JSON. */
export function toSqlInput(value: unknown): SQLInputValue {
  if (value === null || value === undefined) return null;
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'bigint':
      return value;
    case 'boolean':
      return value ? 1 : 0;
    case 'object':
      if (value instanceof Date) return value.toISOString();
      if (ArrayBuffer.isView(value)) return value as NodeJS.ArrayBufferView;
      return jsonStringify(value);
    default:
      throw new TypeError(`Unsupported SQL parameter type: ${typeof value}`);
  }
}

function bind(params: readonly unknown[]): SQLInputValue[] {
  return params.map(toSqlInput);
}

/** Todas las filas de una consulta, opcionalmente mapeadas. */
export function selectAll<T = Row>(
  db: DatabaseSync,
  sql: string,
  params: readonly unknown[] = [],
  map?: (row: Row) => T,
): T[] {
  const rows = db.prepare(sql).all(...bind(params));
  return map ? rows.map(map) : (rows as T[]);
}

/** Primera fila de una consulta o `undefined`. */
export function selectOne<T = Row>(
  db: DatabaseSync,
  sql: string,
  params: readonly unknown[] = [],
  map?: (row: Row) => T,
): T | undefined {
  const row = db.prepare(sql).get(...bind(params));
  if (row === undefined) return undefined;
  return map ? map(row) : (row as T);
}

/** Ejecuta una sentencia de escritura con parámetros y devuelve los cambios. */
export function execute(
  db: DatabaseSync,
  sql: string,
  params: readonly unknown[] = [],
): StatementResultingChanges {
  return db.prepare(sql).run(...bind(params));
}

/** JSON almacenado como texto → valor; devuelve `undefined` si el valor es nulo o no es JSON válido. */
export function jsonParse<T>(value: unknown): T | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/** Valor → JSON compacto para una columna de texto. `undefined` se guarda como `null`. */
export function jsonStringify(value: unknown): string {
  return JSON.stringify(value) ?? 'null';
}

/** Marca de tiempo ISO 8601 con zona Z. El reloj se inyecta para mantener el determinismo en pruebas. */
export function nowIso(clock: () => Date = () => new Date()): string {
  return clock().toISOString();
}

/** Paginación por `LIMIT`/`OFFSET` con total; `pages` es el número de páginas resultante. */
export function paginate<T = Row>(db: DatabaseSync, input: PaginateInput<T>): Page<T> {
  const pageSize = Math.max(1, Math.floor(input.pageSize) || 1);
  const page = Math.max(1, Math.floor(input.page) || 1);
  const params = bind(input.params);
  const countRow = db.prepare(input.countSql).get(...params);
  const total = countRow ? Number(Object.values(countRow)[0] ?? 0) : 0;
  const offset = (page - 1) * pageSize;
  const sql = `${input.sql.trim().replace(/;+\s*$/, '')} LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, pageSize, offset);
  const items = input.map ? rows.map(input.map) : (rows as T[]);
  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}

/** Misma forma que `CatalogEntry` de @psp/contracts; este paquete no depende de contracts. */
export interface SqliteCatalogEntry {
  kind: 'package';
  key: string;
  name: string;
  description: string;
  package: string;
  status: 'stable' | 'mock' | 'stub' | 'planned';
  docs?: string;
}

/** Registro para `pnpm catalog`: lo no registrado no existe (AGENTS.md §3). */
export const CATALOG: SqliteCatalogEntry[] = [
  {
    kind: 'package',
    key: '@psp/sqlite',
    name: '@psp/sqlite',
    description:
      'Envoltura de node:sqlite: apertura con WAL y claves foráneas, migraciones SQL numeradas idempotentes, transacciones con savepoints, JSON, reloj inyectable y paginación.',
    package: '@psp/sqlite',
    status: 'stable',
    docs: 'packages/sqlite/README.md',
  },
];
