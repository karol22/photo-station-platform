import { PermissionKey, type Scope } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { ROLE_DEFINITIONS, ROLE_INDEX, can, narrowListToPrincipal, resolvePrincipal, visibleScopes } from './rbac';
import { FR_BAJIO, FR_NORTE, LOC_N1, NOW, ORG, ORG_OTHER, assignment, demoHierarchy, scope, supportAccess, user } from './__tests__/fixtures';

const index = demoHierarchy();

describe('ROLE_DEFINITIONS', () => {
  it('define los 13 roles con permisos válidos', () => {
    expect(ROLE_DEFINITIONS).toHaveLength(13);
    expect(new Set(ROLE_DEFINITIONS.map((r) => r.key)).size).toBe(13);
    for (const role of ROLE_DEFINITIONS) for (const p of role.permissions) expect(PermissionKey.options).toContain(p);
    expect(ROLE_INDEX.platform_owner.permissions).toHaveLength(PermissionKey.options.length);
    expect(ROLE_INDEX.brand_admin.permissions).not.toContain('organizations.create');
    expect(ROLE_INDEX.brand_admin.permissions).toContain('support.grant');
    for (const forbidden of ['features.manage', 'releases.manage', 'branding.manage', 'presets.manage']) {
      expect(ROLE_INDEX.franchise_owner.permissions).not.toContain(forbidden);
    }
    expect(ROLE_INDEX.franchise_owner.permissions).toContain('pricing.edit');
    expect(ROLE_INDEX.operator.permissions).toEqual(['machines.view', 'sessions.view', 'maintenance.log']);
    expect(ROLE_INDEX.temp_support.permissions).toEqual([]);
    expect(ROLE_INDEX.auditor.permissions.every((p) => p.endsWith('.view'))).toBe(true);
    expect(ROLE_INDEX.auditor.permissions).toContain('audit.view');
  });
});

describe('resolvePrincipal', () => {
  it('sólo toma asignaciones y accesos de soporte vigentes del usuario', () => {
    const u = user('usr_1');
    const principal = resolvePrincipal(
      u,
      [
        assignment('ra_1', 'usr_1', 'operator', scope.machine('mch_n1')),
        assignment('ra_2', 'usr_1', 'technician', scope.franchise(FR_NORTE), { expiresAt: '2026-09-08T00:00:00Z' }),
        assignment('ra_3', 'usr_1', 'auditor', scope.platform(), { grantedAt: '2026-12-01T00:00:00Z' }),
        assignment('ra_4', 'usr_2', 'platform_owner', scope.platform()),
      ],
      [
        supportAccess('sa_1', 'usr_1', scope.machine('mch_b1'), ['machines.commands']),
        supportAccess('sa_2', 'usr_1', scope.machine('mch_b2'), ['machines.commands'], { revokedAt: '2026-09-08T12:00:00Z', revokedBy: 'usr_platform' }),
        supportAccess('sa_3', 'usr_1', scope.organization(ORG), ['machines.edit'], { startsAt: '2026-01-01T00:00:00Z', expiresAt: '2026-02-01T00:00:00Z' }),
      ],
      NOW,
    );
    expect(principal.assignments.map((a) => a.id)).toEqual(['ra_1']);
    expect(principal.supportAccesses.map((s) => s.id)).toEqual(['sa_1']);
    expect(principal.permissions).toEqual([
      { key: 'machines.view', scope: scope.machine('mch_n1') },
      { key: 'sessions.view', scope: scope.machine('mch_n1') },
      { key: 'maintenance.log', scope: scope.machine('mch_n1') },
      { key: 'machines.commands', scope: scope.machine('mch_b1') },
    ]);
  });

  it('un usuario suspendido no recibe permisos', () => {
    const principal = resolvePrincipal(user('usr_s', { status: 'suspended' }), [assignment('ra', 'usr_s', 'superadmin', scope.platform())], [], NOW);
    expect(principal.permissions).toEqual([]);
    expect(can(principal, 'machines.view', scope.machine('mch_n1'), index)).toBe(false);
  });
});

describe('escenario D: franquicia', () => {
  const owner = resolvePrincipal(user('usr_norte'), [assignment('ra_n', 'usr_norte', 'franchise_owner', scope.franchise(FR_NORTE))], [], NOW);

  it('administra sus cinco máquinas pero no ve las de otra franquicia', () => {
    for (const id of ['mch_n1', 'mch_n2', 'mch_n3', 'mch_n4', 'mch_n5']) {
      expect(can(owner, 'machines.view', scope.machine(id), index), id).toBe(true);
      expect(can(owner, 'machines.edit', scope.machine(id), index), id).toBe(true);
    }
    expect(can(owner, 'machines.view', scope.machine('mch_b1'), index)).toBe(false);
    expect(can(owner, 'machines.view', scope.machine('mch_hq'), index)).toBe(false);
    expect(can(owner, 'machines.view', scope.franchise(FR_BAJIO), index)).toBe(false);
    expect(can(owner, 'pricing.edit', scope.location(LOC_N1), index)).toBe(true);
    expect(can(owner, 'machines.view', scope.organization(ORG), index)).toBe(false);
  });

  it('no puede modificar funciones bloqueadas por la marca', () => {
    expect(can(owner, 'features.manage', scope.franchise(FR_NORTE), index)).toBe(false);
    expect(can(owner, 'branding.manage', scope.machine('mch_n1'), index)).toBe(false);
    expect(can(owner, 'releases.manage', scope.machine('mch_n1'), index)).toBe(false);
  });

  it('los listados quedan acotados a su red', () => {
    const machines = narrowListToPrincipal(index.all.machines, owner, index, 'machines.view', 'machine');
    expect(machines.map((m) => m.id)).toEqual(['mch_n1', 'mch_n2', 'mch_n3', 'mch_n4', 'mch_n5']);
    expect(narrowListToPrincipal(index.all.locations, owner, index, 'locations.view', 'location').map((l) => l.id)).toEqual(['loc_norte_1', 'loc_norte_2']);
    // Ve su propia franquicia y la organización que la contiene, nunca a la franquicia hermana ni a otra marca.
    expect(narrowListToPrincipal(index.all.franchises, owner, index, 'franchises.view', 'franchise').map((f) => f.id)).toEqual([FR_NORTE]);
    expect(narrowListToPrincipal(index.all.organizations, owner, index, 'organizations.view', 'organization').map((o) => o.id)).toEqual([ORG]);
    // Sin el permiso, la lista es vacía aunque la jerarquía coincida.
    expect(narrowListToPrincipal(index.all.machines, owner, index, 'features.manage', 'machine')).toEqual([]);
    // Registros que no están en el índice (sesiones, incidencias) se acotan por sus propios campos.
    const records = [
      { id: 'ses_1', organizationId: ORG, franchiseId: FR_NORTE, machineId: 'mch_n1' },
      { id: 'ses_2', organizationId: ORG, franchiseId: FR_BAJIO, machineId: 'mch_b1' },
      { id: 'ses_3', organizationId: ORG, machineId: 'mch_n3' },
      { id: 'ses_4', organizationId: ORG_OTHER, machineId: 'mch_other' },
    ];
    expect(narrowListToPrincipal(records, owner, index, 'sessions.view', 'machine').map((r) => r.id)).toEqual(['ses_1', 'ses_3']);
  });

  it('visibleScopes devuelve los alcances distintos del usuario', () => {
    expect(visibleScopes(owner)).toEqual([scope.franchise(FR_NORTE)]);
    const admin = resolvePrincipal(user('usr_p'), [assignment('ra', 'usr_p', 'platform_owner', scope.platform()), assignment('ra2', 'usr_p', 'operator', scope.machine('mch_n1'))], [], NOW);
    expect(visibleScopes(admin)).toEqual([scope.platform()]);
    const multi = resolvePrincipal(
      user('usr_m'),
      [assignment('a', 'usr_m', 'operator', scope.machine('mch_b1')), assignment('b', 'usr_m', 'location_manager', scope.location(LOC_N1))],
      [],
      NOW,
    );
    expect(visibleScopes(multi)).toEqual([scope.location(LOC_N1), scope.machine('mch_b1')]);
  });
});

describe('soporte temporal', () => {
  it('temp_support sólo puede lo que su acceso de soporte vigente le concede', () => {
    const temp = resolvePrincipal(
      user('usr_temp'),
      [assignment('ra_t', 'usr_temp', 'temp_support', scope.platform())],
      [supportAccess('sa_t', 'usr_temp', scope.location('loc_bajio_1'), ['machines.view', 'machines.commands'])],
      NOW,
    );
    expect(can(temp, 'machines.commands', scope.machine('mch_b1'), index)).toBe(true);
    expect(can(temp, 'machines.commands', scope.machine('mch_n1'), index)).toBe(false);
    expect(can(temp, 'machines.edit', scope.machine('mch_b1'), index)).toBe(false);
    const target: Scope = scope.machine('mch_b2');
    expect(narrowListToPrincipal(index.all.machines, temp, index, 'machines.view', 'machine').map((m) => m.id)).toEqual(['mch_b1', target.id]);
    // Al expirar, no queda nada.
    const later = resolvePrincipal(temp.user, temp.assignments, temp.supportAccesses, new Date('2026-09-11T00:00:00Z'));
    expect(later.permissions).toEqual([]);
  });
});
