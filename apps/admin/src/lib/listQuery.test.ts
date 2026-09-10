import { describe, expect, it } from 'vitest';
import {
  adminQueryToSearchParams,
  parseListState,
  parseSort,
  toAdminListQuery,
  toggleSort,
  writeListState,
} from './listQuery';

describe('parseListState', () => {
  it('lee búsqueda, página, tamaño, orden y filtros con prefijo f.', () => {
    const params = new URLSearchParams('q=alpha&page=3&pageSize=100&sort=-name&f.status=active&f.city=x&org=org_1');
    expect(parseListState(params)).toEqual({
      q: 'alpha',
      page: 3,
      pageSize: 100,
      sort: '-name',
      filters: { status: 'active', city: 'x' },
    });
  });
  it('aplica valores por defecto y protege contra números inválidos', () => {
    const params = new URLSearchParams('page=abc&pageSize=99999');
    const state = parseListState(params, { sort: 'code', filters: { kind: 'document' } });
    expect(state.page).toBe(1);
    expect(state.pageSize).toBe(500);
    expect(state.sort).toBe('code');
    expect(state.filters).toEqual({ kind: 'document' });
  });
});

describe('writeListState', () => {
  it('conserva las claves de alcance y elimina las de lista anteriores', () => {
    const params = new URLSearchParams('org=org_1&fr=fr_1&q=old&f.status=x&tab=config');
    const next = writeListState(params, { q: 'new', page: 2, pageSize: 25, sort: 'name', filters: { status: 'active', city: '' } });
    expect(next.get('org')).toBe('org_1');
    expect(next.get('fr')).toBe('fr_1');
    expect(next.get('tab')).toBe('config');
    expect(next.get('q')).toBe('new');
    expect(next.get('page')).toBe('2');
    expect(next.get('pageSize')).toBeNull();
    expect(next.get('sort')).toBe('name');
    expect(next.get('f.status')).toBe('active');
    expect(next.has('f.city')).toBe(false);
  });
});

describe('toAdminListQuery + adminQueryToSearchParams', () => {
  it('produce filters[clave]=valor y el alcance plano', () => {
    const query = toAdminListQuery(
      { q: 'a b', page: 2, pageSize: 50, sort: '-lastSeenAt', filters: { status: 'active' } },
      { organizationId: 'org_1', franchiseId: 'fr_2' },
    );
    expect(query).toEqual({
      q: 'a b',
      page: 2,
      pageSize: 50,
      sort: '-lastSeenAt',
      filters: { status: 'active' },
      organizationId: 'org_1',
      franchiseId: 'fr_2',
    });
    const params = adminQueryToSearchParams(query);
    expect(params.get('filters[status]')).toBe('active');
    expect(params.get('organizationId')).toBe('org_1');
    expect(params.get('franchiseId')).toBe('fr_2');
    expect(params.get('q')).toBe('a b');
    expect(params.has('regionId')).toBe(false);
  });
});

describe('sort helpers', () => {
  it('interpreta el prefijo - y alterna dirección', () => {
    expect(parseSort('-name')).toEqual({ key: 'name', dir: 'desc' });
    expect(parseSort(undefined)).toBeUndefined();
    expect(toggleSort(undefined, 'name')).toBe('name');
    expect(toggleSort('name', 'name')).toBe('-name');
    expect(toggleSort('-name', 'name')).toBe('name');
    expect(toggleSort('-name', 'code')).toBe('code');
  });
});
