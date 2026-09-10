/**
 * Estado de una lista administrativa (búsqueda, página, orden, filtros) y su ida y vuelta con la
 * URL y con los parámetros de `AdminListQuery` del control-plane.
 */
import type { AdminListQuery, ScopeFilter } from '@psp/contracts';

export interface ListState {
  q: string;
  page: number;
  pageSize: number;
  sort?: string;
  filters: Record<string, string>;
}

export const DEFAULT_PAGE_SIZE = 25;

export const EMPTY_LIST_STATE: ListState = { q: '', page: 1, pageSize: DEFAULT_PAGE_SIZE, filters: {} };

/** Claves de la URL que pertenecen al selector de alcance y no a la lista. */
export const SCOPE_URL_KEYS = ['org', 'fr', 'reg', 'loc'] as const;

const RESERVED = new Set<string>(['q', 'page', 'pageSize', 'sort', ...SCOPE_URL_KEYS]);

function positiveInt(value: string | null, fallback: number, max = 500): number {
  if (value === null) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** Lee el estado de lista desde `?q=&page=&pageSize=&sort=&f.<clave>=<valor>`. */
export function parseListState(params: URLSearchParams, defaults: Partial<ListState> = {}): ListState {
  const state: ListState = {
    q: params.get('q') ?? defaults.q ?? '',
    page: positiveInt(params.get('page'), defaults.page ?? 1, 1_000_000),
    pageSize: positiveInt(params.get('pageSize'), defaults.pageSize ?? DEFAULT_PAGE_SIZE),
    filters: { ...(defaults.filters ?? {}) },
  };
  const sort = params.get('sort') ?? defaults.sort;
  if (sort) state.sort = sort;
  params.forEach((value, key) => {
    if (key.startsWith('f.') && key.length > 2 && !RESERVED.has(key)) {
      if (value === '') delete state.filters[key.slice(2)];
      else state.filters[key.slice(2)] = value;
    }
  });
  return state;
}

/** Escribe el estado de lista en la URL sin tocar las claves de alcance ni otras ajenas. */
export function writeListState(params: URLSearchParams, state: ListState): URLSearchParams {
  const next = new URLSearchParams();
  params.forEach((value, key) => {
    if (RESERVED.has(key) && !SCOPE_URL_KEYS.includes(key as (typeof SCOPE_URL_KEYS)[number])) return;
    if (key.startsWith('f.')) return;
    next.set(key, value);
  });
  if (state.q) next.set('q', state.q);
  if (state.page > 1) next.set('page', String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) next.set('pageSize', String(state.pageSize));
  if (state.sort) next.set('sort', state.sort);
  for (const [key, value] of Object.entries(state.filters)) {
    if (value !== '') next.set(`f.${key}`, value);
  }
  return next;
}

export type ListQueryInput = Partial<Omit<AdminListQuery, 'filters'>> & { filters?: Record<string, string> };

/** Construye la consulta que entiende el control-plane a partir del estado de lista y el alcance. */
export function toAdminListQuery(state: Partial<ListState>, scope: ScopeFilter = {}): ListQueryInput {
  const query: ListQueryInput = {
    page: state.page ?? 1,
    pageSize: state.pageSize ?? DEFAULT_PAGE_SIZE,
  };
  if (state.q) query.q = state.q;
  if (state.sort) query.sort = state.sort;
  if (state.filters && Object.keys(state.filters).length > 0) query.filters = { ...state.filters };
  if (scope.organizationId) query.organizationId = scope.organizationId;
  if (scope.franchiseId) query.franchiseId = scope.franchiseId;
  if (scope.regionId) query.regionId = scope.regionId;
  if (scope.locationId) query.locationId = scope.locationId;
  if (scope.machineId) query.machineId = scope.machineId;
  return query;
}

/** Serializa `AdminListQuery` como cadena de consulta: `filters[clave]=valor`, alcance plano. */
export function adminQueryToSearchParams(query: ListQueryInput): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.sort) params.set('sort', query.sort);
  for (const [key, value] of Object.entries(query.filters ?? {})) {
    if (value !== undefined && value !== '') params.set(`filters[${key}]`, value);
  }
  for (const key of ['organizationId', 'franchiseId', 'regionId', 'locationId', 'machineId'] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  return params;
}

/** Nombre de columna y dirección a partir de `sort` (`-name` = descendente). */
export function parseSort(sort: string | undefined): { key: string; dir: 'asc' | 'desc' } | undefined {
  if (!sort) return undefined;
  return sort.startsWith('-') ? { key: sort.slice(1), dir: 'desc' } : { key: sort, dir: 'asc' };
}

export function toggleSort(current: string | undefined, key: string): string {
  const parsed = parseSort(current);
  if (parsed?.key === key && parsed.dir === 'asc') return `-${key}`;
  return key;
}
