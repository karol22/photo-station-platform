/**
 * Consultas de listado: parseo de `AdminListQuery` desde querystring plano (`filters[campo]=valor`),
 * búsqueda `q`, filtros por campo, orden y paginación en memoria.
 */
import { AdminListQuery, type AdminListQuery as AdminListQueryT } from '@psp/contracts';
import { validation } from './context';

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Querystring plano → objeto para `AdminListQuery.safeParse` (compuerta). */
export function parseListQuery(raw: unknown, schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: unknown } } = AdminListQuery): AdminListQueryT {
  const query = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    const match = /^filters\[(.+)\]$/.exec(key);
    if (match) {
      filters[match[1] ?? ''] = String(value);
      continue;
    }
    if (key === 'filters' && value && typeof value === 'object') {
      Object.assign(filters, value as Record<string, string>);
      continue;
    }
    if (key === 'page' || key === 'pageSize' || key === 'limit') {
      out[key] = Number(value);
      continue;
    }
    if (key === 'types' && typeof value === 'string') {
      out[key] = value.split(',').filter(Boolean);
      continue;
    }
    out[key] = value;
  }
  out['filters'] = filters;
  const parsed = schema.safeParse(out);
  if (!parsed.success) throw validation(parsed.error, 'Invalid list query');
  return parsed.data as AdminListQueryT;
}

function valueAt(item: unknown, path: string): unknown {
  let current: unknown = item;
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function textOf(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function matchesFilter(item: unknown, key: string, expected: string): boolean {
  const actual = valueAt(item, key);
  if (Array.isArray(actual)) return actual.some((v) => textOf(v) === expected);
  if (typeof actual === 'boolean') return String(actual) === expected;
  if (typeof actual === 'number') return String(actual) === expected;
  if (actual === undefined || actual === null) return expected === '' || expected === 'null';
  return textOf(actual) === expected;
}

/** Aplica `q`, `filters`, `sort` (`campo` o `-campo`) y paginación. */
export function applyListQuery<T>(items: T[], query: AdminListQueryT, searchFields: string[]): PageResult<T> {
  let result = items;
  const q = query.q?.trim().toLowerCase();
  if (q) {
    result = result.filter((item) =>
      [...searchFields, 'id'].some((field) => textOf(valueAt(item, field)).toLowerCase().includes(q)),
    );
  }
  for (const [key, expected] of Object.entries(query.filters)) {
    result = result.filter((item) => matchesFilter(item, key, expected));
  }
  if (query.sort) {
    const desc = query.sort.startsWith('-');
    const field = desc ? query.sort.slice(1) : query.sort;
    result = [...result].sort((a, b) => {
      const va = valueAt(a, field);
      const vb = valueAt(b, field);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : textOf(va).localeCompare(textOf(vb));
      return desc ? -cmp : cmp;
    });
  }
  const start = (query.page - 1) * query.pageSize;
  return { items: result.slice(start, start + query.pageSize), page: query.page, pageSize: query.pageSize, total: result.length };
}

/** Serializa entidades a CSV (campos de primer nivel; objetos como JSON). Nunca fotografías. */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  const escape = (value: unknown): string => {
    const text = textOf(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => escape(row[column])).join(','));
  return lines.join('\n') + '\n';
}

/** Fila CSV (texto) → objeto: JSON cuando el valor lo parece, números y booleanos; el resto texto. */
export function coerceRow(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(row)) {
    const value = raw.trim();
    if (value === '') continue;
    if (/^[\[{]/.test(value)) {
      try {
        out[key] = JSON.parse(value);
        continue;
      } catch {
        /* texto */
      }
    }
    if (value === 'true' || value === 'false') {
      out[key] = value === 'true';
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(value) && !/^0\d/.test(value) && !key.toLowerCase().includes('code') && !key.toLowerCase().includes('postal')) {
      out[key] = Number(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}
