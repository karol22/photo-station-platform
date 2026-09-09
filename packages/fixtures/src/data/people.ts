/** Usuarios demo prometidos en `docs/operacion/como-correr.md`, sus roles y el acceso de soporte. */
import { RoleAssignment, SupportAccess, User, type RoleKey, type Scope } from '@psp/contracts';
import { DEMO_IDS } from '../ids';
import { sha256Hex } from '../sha256';
import { daysAgo, daysFromNow, hoursAgo } from '../time';
import { audit } from './common';
import type { DemoUser } from '../types';

const ID = DEMO_IDS;
export const DEMO_PASSWORD = 'demo';

interface Seed { id: string; email: string; name: string; roleKey: RoleKey; scope: Scope; locale: 'es' | 'en' }

const seeds: Seed[] = [
  { id: ID.user.owner, email: 'owner@platform.demo', name: 'Propietario de plataforma', roleKey: 'platform_owner', scope: { level: 'platform' }, locale: 'es' },
  { id: ID.user.adminUnaDeTodos, email: 'admin@unadetodos.demo', name: 'Andrea Solís', roleKey: 'brand_admin', scope: { level: 'organization', id: ID.org.unaDeTodos }, locale: 'es' },
  { id: ID.user.franqNorte, email: 'franq@norte.demo', name: 'Rodrigo Treviño', roleKey: 'franchise_owner', scope: { level: 'franchise', id: ID.franchise.norte }, locale: 'es' },
  { id: ID.user.tecnicoNorte, email: 'tecnico@norte.demo', name: 'Luis Garza', roleKey: 'technician', scope: { level: 'franchise', id: ID.franchise.norte }, locale: 'es' },
  { id: ID.user.analistaUnaDeTodos, email: 'analista@unadetodos.demo', name: 'Mariana Campos', roleKey: 'analyst', scope: { level: 'organization', id: ID.org.unaDeTodos }, locale: 'en' },
  { id: ID.user.adminFotorapida, email: 'admin@fotorapida.demo', name: 'Camila Restrepo', roleKey: 'brand_admin', scope: { level: 'organization', id: ID.org.fotorapida }, locale: 'es' },
  { id: ID.user.soporte, email: 'soporte@platform.demo', name: 'Soporte temporal', roleKey: 'temp_support', scope: { level: 'machine', id: ID.machine.cinema }, locale: 'es' },
];

export function buildDemoUsers(): DemoUser[] {
  const passwordHash = sha256Hex(DEMO_PASSWORD);
  return seeds.map((s) => ({ id: s.id, email: s.email, password: DEMO_PASSWORD, passwordHash, name: s.name, roleKey: s.roleKey, scope: s.scope }));
}

export function buildUsers(): User[] {
  return seeds.map((s, i) =>
    User.parse({ id: s.id, email: s.email, name: s.name, status: 'active', locale: s.locale, lastLoginAt: hoursAgo(2 + i * 5), ...audit(ID.user.owner), createdAt: '2026-01-20T12:00:00Z' }),
  );
}

export function buildRoleAssignments(): RoleAssignment[] {
  return seeds.map((s) =>
    RoleAssignment.parse({
      id: `ra_${s.id.slice(4)}`,
      userId: s.id,
      roleKey: s.roleKey,
      scope: s.scope,
      grantedBy: s.id === ID.user.owner ? undefined : ID.user.owner,
      grantedAt: '2026-01-20T12:00:00Z',
      ...(s.roleKey === 'temp_support' ? { expiresAt: daysFromNow(7), reason: 'Soporte de la incidencia de cámara del cine' } : {}),
    }),
  );
}

export function buildSupportAccesses(): SupportAccess[] {
  return [
    SupportAccess.parse({
      id: ID.supportAccess.cinemaCamera,
      userId: ID.user.soporte,
      scope: { level: 'machine', id: ID.machine.cinema },
      permissions: ['machines.view', 'machines.commands', 'machines.maintenance', 'incidents.manage', 'sessions.view'],
      reason: 'Diagnóstico remoto de la cámara de mch_cine_01 (incidencia inc_cine_camera)',
      grantedBy: ID.user.adminUnaDeTodos,
      startsAt: daysAgo(1),
      expiresAt: daysFromNow(7),
    }),
  ];
}
