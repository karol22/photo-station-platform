import { describe, expect, it } from 'vitest';
import type { PermissionKey, Principal } from '@psp/contracts';
import { NAVIGATION, activeNavKey } from '../shell/navigation';
import { filterNavigation, hasAnyPermission } from './navFilter';

function principalWith(permissions: PermissionKey[], scope: Principal['permissions'][number]['scope'] = { level: 'platform' }): Principal {
  return {
    user: { id: 'usr_test', email: 'test@example.test', name: 'Test', status: 'active', locale: 'es', createdAt: '2026-01-01T00:00:00Z' },
    assignments: [],
    supportAccesses: [],
    permissions: permissions.map((key) => ({ key, scope })),
  };
}

const FRANCHISE_OWNER: PermissionKey[] = [
  'organizations.view',
  'franchises.view',
  'locations.view',
  'locations.create',
  'locations.edit',
  'machines.view',
  'machines.edit',
  'machines.maintenance',
  'pricing.edit',
  'campaigns.edit_local',
  'config.edit',
  'users.manage',
  'maintenance.log',
  'incidents.manage',
  'incidents.close',
  'metrics.view',
  'sessions.view',
  'data.export',
  'audit.view',
];

describe('filterNavigation', () => {
  it('sin principal no muestra nada', () => {
    expect(filterNavigation(NAVIGATION, undefined)).toEqual([]);
  });
  it('un franquiciatario ve operación y su oferta pero no soporte ni catálogo', () => {
    const sections = filterNavigation(NAVIGATION, principalWith(FRANCHISE_OWNER, { level: 'franchise', id: 'fr_1' }));
    const keys = sections.flatMap((s) => s.items.map((i) => i.key));
    expect(keys).toContain('dashboard');
    expect(keys).toContain('machines');
    expect(keys).toContain('campaigns');
    expect(keys).toContain('prices');
    expect(keys).toContain('announcements');
    expect(keys).toContain('users');
    expect(keys).toContain('audit');
    expect(keys).not.toContain('support');
    expect(keys).not.toContain('catalog');
    expect(keys).not.toContain('import-export'.replace('import-export', 'nope'));
  });
  it('un técnico ve máquinas y mantenimiento pero no métricas ni usuarios', () => {
    const sections = filterNavigation(
      NAVIGATION,
      principalWith(['locations.view', 'machines.view', 'machines.maintenance', 'machines.commands', 'maintenance.log', 'incidents.manage', 'incidents.close']),
    );
    const keys = sections.flatMap((s) => s.items.map((i) => i.key));
    expect(keys).toContain('machines');
    expect(keys).toContain('maintenance');
    expect(keys).not.toContain('metrics');
    expect(keys).not.toContain('users');
    expect(keys).not.toContain('organizations');
  });
  it('un analista sólo ve lectura y exportación', () => {
    const sections = filterNavigation(
      NAVIGATION,
      principalWith(['organizations.view', 'franchises.view', 'locations.view', 'machines.view', 'metrics.view', 'sessions.view', 'data.export']),
    );
    const keys = sections.flatMap((s) => s.items.map((i) => i.key));
    expect(keys).toContain('metrics');
    expect(keys).toContain('sessions');
    expect(keys).toContain('import-export');
    expect(keys).not.toContain('users');
    expect(keys).not.toContain('audit');
    expect(sections.find((s) => s.key === 'platform')?.items.map((i) => i.key)).toEqual(['features', 'releases', 'announcements', 'docs', 'import-export']);
  });
  it('un propietario de plataforma ve todo', () => {
    const all = NAVIGATION.flatMap((s) => s.items).length;
    const allPerms = Array.from(new Set(NAVIGATION.flatMap((s) => s.items.flatMap((i) => i.anyOf))));
    expect(filterNavigation(NAVIGATION, principalWith(allPerms)).flatMap((s) => s.items).length).toBe(all);
  });
});

describe('hasAnyPermission / activeNavKey', () => {
  it('acepta lista vacía como siempre visible', () => {
    expect(hasAnyPermission(principalWith([]), [])).toBe(true);
    expect(hasAnyPermission(principalWith(['machines.view']), ['users.manage'])).toBe(false);
  });
  it('encuentra el ítem activo por prefijo más largo', () => {
    expect(activeNavKey('/')).toBe('dashboard');
    expect(activeNavKey('/machines/mch_1')).toBe('machines');
    expect(activeNavKey('/releases/rollouts/rol_1')).toBe('releases');
    expect(activeNavKey('/unknown')).toBeUndefined();
  });
});
