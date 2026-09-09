// Stub tipado de la API pública de @psp/sqlite (docs/arquitectura/01-apis-de-paquetes.md, ADR-002).
// Cada función se implementa en el paso siguiente; las firmas ya son las definitivas.
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';

export type { DatabaseSync, SQLInputValue, SQLOutputValue } from 'node:sqlite';

export interface OpenDatabaseOptions {
  wal?: boolean;
}

export interface Migration {
  name: string;
  sql: string;
}

export type Row = Record<string, SQLOutputValue>;

export interface PaginateInput<T> {
  sql: string;
  countSql: string;
  params: unknown[];
  page: number;
  pageSize: number;
  map?: (row: Row) => T;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export function openDatabase(_path: string | ':memory:', _opts?: OpenDatabaseOptions): DatabaseSync {
  throw new Error('pending');
}

export function migrate(_db: DatabaseSync, _migrations: Migration[]): { applied: string[] } {
  throw new Error('pending');
}

export function loadMigrationsDir(_dir: string): Migration[] {
  throw new Error('pending');
}

export function transaction<T>(_db: DatabaseSync, _fn: () => T): T {
  throw new Error('pending');
}

export function jsonParse<T>(_v: unknown): T | undefined {
  throw new Error('pending');
}

export function jsonStringify(_v: unknown): string {
  throw new Error('pending');
}

export function nowIso(_clock?: () => Date): string {
  throw new Error('pending');
}

export function paginate<T = Row>(_db: DatabaseSync, _input: PaginateInput<T>): Page<T> {
  throw new Error('pending');
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

export const CATALOG: SqliteCatalogEntry[] = [];
