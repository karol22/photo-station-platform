/**
 * RBAC con alcance (requisito 3): roles con permisos cerrados, asignaciones con alcance y
 * accesos de soporte con vigencia. El aislamiento entre franquicias sale de `scopeContains`.
 */
import {
  PermissionKey,
  type Id,
  type Principal,
  type Role,
  type RoleAssignment,
  type RoleKey,
  type Scope,
  type ScopeLevel,
  type SupportAccess,
  type User,
} from '@psp/contracts';
import { SCOPE_LEVEL_RANK, sameScope, scopeChain, scopeContains, scopeKey, type HierarchyIndex } from './hierarchy';

const ALL: PermissionKey[] = [...PermissionKey.options];
/** Todos los permisos de lectura (`*.view`). */
export const VIEW_PERMISSIONS: PermissionKey[] = ALL.filter((key) => key.endsWith('.view'));

const L = (es: string, en: string) => ({ es, en });
const without = (keys: PermissionKey[], ...excluded: PermissionKey[]): PermissionKey[] =>
  keys.filter((key) => !excluded.includes(key));
const unique = (keys: PermissionKey[]): PermissionKey[] => Array.from(new Set(keys));

/** Los 13 roles internos (requisito 3.1) con sus permisos por defecto. */
export const ROLE_DEFINITIONS: Role[] = [
  {
    key: 'platform_owner',
    name: L('Propietario de plataforma', 'Platform owner'),
    description: L('Ve y administra toda la red.', 'Sees and manages the whole network.'),
    permissions: ALL,
  },
  {
    key: 'superadmin',
    name: L('Superadministrador', 'Superadmin'),
    description: L('Administración total de la plataforma.', 'Full platform administration.'),
    permissions: ALL,
  },
  {
    key: 'brand_admin',
    name: L('Administrador de marca', 'Brand admin'),
    description: L('Administra una organización completa; no crea organizaciones.', 'Manages a whole organization; cannot create organizations.'),
    permissions: without(ALL, 'organizations.create'),
  },
  {
    key: 'franchise_owner',
    name: L('Propietario de franquicia', 'Franchise owner'),
    description: L('Administra su red: ubicaciones, máquinas, precios dentro de rangos, usuarios y mantenimiento.', 'Manages their network: locations, machines, prices within ranges, users and maintenance.'),
    permissions: [
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
    ],
  },
  {
    key: 'regional_manager',
    name: L('Gerente regional', 'Regional manager'),
    description: L('Lectura, mantenimiento e incidencias en su región.', 'Read, maintenance and incidents within the region.'),
    permissions: [
      'organizations.view',
      'franchises.view',
      'locations.view',
      'locations.edit',
      'machines.view',
      'machines.maintenance',
      'maintenance.log',
      'incidents.manage',
      'incidents.close',
      'metrics.view',
      'sessions.view',
      'data.export',
    ],
  },
  {
    key: 'location_manager',
    name: L('Gerente de ubicación', 'Location manager'),
    description: L('Lectura y mantenimiento de las máquinas de su ubicación.', 'Read and maintenance of the machines at the location.'),
    permissions: ['locations.view', 'machines.view', 'machines.maintenance', 'maintenance.log', 'incidents.manage', 'metrics.view', 'sessions.view'],
  },
  {
    key: 'operator',
    name: L('Operador', 'Operator'),
    description: L('Ve máquinas y sesiones; registra mantenimiento básico.', 'Sees machines and sessions; logs basic maintenance.'),
    permissions: ['machines.view', 'sessions.view', 'maintenance.log'],
  },
  {
    key: 'technician',
    name: L('Técnico de mantenimiento', 'Maintenance technician'),
    description: L('Mantenimiento, comandos remotos e incidencias.', 'Maintenance, remote commands and incidents.'),
    permissions: ['locations.view', 'machines.view', 'machines.maintenance', 'machines.commands', 'maintenance.log', 'incidents.manage', 'incidents.close'],
  },
  {
    key: 'content_designer',
    name: L('Diseñador de contenido', 'Content designer'),
    description: L('Plantillas, activos, campañas y productos.', 'Templates, assets, campaigns and products.'),
    permissions: ['templates.manage', 'assets.manage', 'campaigns.publish', 'products.manage'],
  },
  {
    key: 'analyst',
    name: L('Analista', 'Analyst'),
    description: L('Métricas, sesiones y exportación de datos.', 'Metrics, sessions and data export.'),
    permissions: ['organizations.view', 'franchises.view', 'locations.view', 'machines.view', 'metrics.view', 'sessions.view', 'data.export'],
  },
  {
    key: 'auditor',
    name: L('Auditor (sólo lectura)', 'Auditor (read-only)'),
    description: L('Lectura de todo y acceso a auditoría.', 'Read everything and access audit logs.'),
    permissions: unique([...VIEW_PERMISSIONS, 'audit.view']),
  },
  {
    key: 'internal_support',
    name: L('Soporte interno', 'Internal support'),
    description: L('Lectura, comandos remotos, mantenimiento y concesión de accesos de soporte.', 'Read, remote commands, maintenance and granting support access.'),
    permissions: unique([...VIEW_PERMISSIONS, 'machines.commands', 'machines.maintenance', 'maintenance.log', 'incidents.manage', 'support.grant']),
  },
  {
    key: 'temp_support',
    name: L('Usuario temporal de soporte', 'Temporary support user'),
    description: L('Sin permisos propios: los recibe de un acceso de soporte vigente.', 'No permissions of its own: they come from an active support access.'),
    permissions: [],
  },
];

export const ROLE_INDEX: Record<RoleKey, Role> = Object.fromEntries(ROLE_DEFINITIONS.map((r) => [r.key, r])) as Record<RoleKey, Role>;

/** Permisos por defecto de un rol; lista vacía para roles desconocidos. */
export function permissionsForRole(roleKey: RoleKey): PermissionKey[] {
  return ROLE_INDEX[roleKey]?.permissions ?? [];
}

function parseTime(value: string | undefined): number {
  return value === undefined ? Number.NaN : Date.parse(value);
}

/** Asignación vigente: ya concedida y no expirada. Fechas inválidas = no vigente. */
export function isAssignmentActive(assignment: RoleAssignment, now: Date): boolean {
  const granted = parseTime(assignment.grantedAt);
  if (Number.isNaN(granted) || granted > now.getTime()) return false;
  if (assignment.expiresAt === undefined) return true;
  const expires = parseTime(assignment.expiresAt);
  return !Number.isNaN(expires) && now.getTime() < expires;
}

/** Acceso de soporte vigente: dentro de su ventana y no revocado. */
export function isSupportAccessActive(access: SupportAccess, now: Date): boolean {
  if (access.revokedAt !== undefined) return false;
  const starts = parseTime(access.startsAt);
  const expires = parseTime(access.expiresAt);
  if (Number.isNaN(starts) || Number.isNaN(expires)) return false;
  return starts <= now.getTime() && now.getTime() < expires;
}

/**
 * Resuelve la identidad de una sesión administrativa: sólo asignaciones y accesos de soporte del
 * usuario que están vigentes en `now`. Un usuario suspendido no recibe permisos.
 */
export function resolvePrincipal(user: User, assignments: RoleAssignment[], supportAccesses: SupportAccess[], now: Date): Principal {
  const activeAssignments = assignments.filter((a) => a.userId === user.id && isAssignmentActive(a, now));
  const activeSupport = supportAccesses.filter((s) => s.userId === user.id && isSupportAccessActive(s, now));
  const permissions: Principal['permissions'] = [];
  const seen = new Set<string>();
  const add = (key: PermissionKey, scope: Scope): void => {
    const id = `${key}@${scopeKey(scope)}`;
    if (seen.has(id)) return;
    seen.add(id);
    permissions.push({ key, scope });
  };
  if (user.status !== 'suspended') {
    for (const assignment of activeAssignments) {
      for (const key of permissionsForRole(assignment.roleKey)) add(key, assignment.scope);
    }
    for (const access of activeSupport) {
      for (const key of access.permissions) add(key, access.scope);
    }
  }
  return { user, assignments: activeAssignments, supportAccesses: activeSupport, permissions };
}

/** ¿Tiene el permiso en un alcance que contiene a `target`? */
export function can(principal: Principal, permission: PermissionKey, target: Scope, index: HierarchyIndex): boolean {
  return principal.permissions.some((entry) => entry.key === permission && scopeContains(index, entry.scope, target));
}

/** Alcances distintos desde los que el usuario ve algo. Si ve la plataforma, sólo ésta. */
export function visibleScopes(principal: Principal): Scope[] {
  const byKey = new Map<string, Scope>();
  for (const entry of principal.permissions) byKey.set(scopeKey(entry.scope), entry.scope);
  if (byKey.has('platform')) return [{ level: 'platform' }];
  return Array.from(byKey.values()).sort((a, b) => {
    const rank = SCOPE_LEVEL_RANK[a.level] - SCOPE_LEVEL_RANK[b.level];
    if (rank !== 0) return rank;
    return (a.id ?? '') < (b.id ?? '') ? -1 : (a.id ?? '') > (b.id ?? '') ? 1 : 0;
  });
}

/**
 * Forma mínima que aceptan los listados: la jerarquía a la que pertenece cada elemento. Una
 * organización se lista con su propio `id` (no lleva `organizationId`).
 */
export interface ScopedItem {
  organizationId?: Id;
  franchiseId?: Id;
  regionId?: Id;
  locationId?: Id;
  machineId?: Id;
  id?: Id;
}

/** Id de organización del elemento: explícito o, al listar organizaciones, su propio id. */
function organizationIdOf(item: ScopedItem, level: ScopeLevel): Id | undefined {
  return item.organizationId ?? (level === 'organization' ? item.id : undefined);
}

/** Alcance propio del elemento según el nivel del listado. */
function ownScope(item: ScopedItem, level: ScopeLevel): Scope {
  const organizationId = organizationIdOf(item, level);
  const organization: Scope = organizationId === undefined ? { level: 'platform' } : { level: 'organization', id: organizationId };
  switch (level) {
    case 'platform':
      return { level: 'platform' };
    case 'organization':
      return organization;
    case 'franchise':
      return item.franchiseId !== undefined || item.id !== undefined ? { level: 'franchise', id: item.franchiseId ?? item.id } : organization;
    case 'region':
      return item.regionId !== undefined || item.id !== undefined ? { level: 'region', id: item.regionId ?? item.id } : organization;
    case 'location':
      return item.locationId !== undefined || item.id !== undefined ? { level: 'location', id: item.locationId ?? item.id } : organization;
    case 'machine':
      return item.machineId !== undefined || item.id !== undefined ? { level: 'machine', id: item.machineId ?? item.id } : organization;
    default:
      return organization;
  }
}

/** Cadena del elemento: sus propios campos más lo que el índice sepa de su alcance propio. */
export function itemScopeChain(item: ScopedItem, level: ScopeLevel, index: HierarchyIndex): Scope[] {
  const own = ownScope(item, level);
  const organizationId = organizationIdOf(item, level);
  const chain: Scope[] = [{ level: 'platform' }];
  if (organizationId !== undefined) chain.push({ level: 'organization', id: organizationId });
  if (item.franchiseId !== undefined) chain.push({ level: 'franchise', id: item.franchiseId });
  if (item.regionId !== undefined) chain.push({ level: 'region', id: item.regionId });
  if (item.locationId !== undefined) chain.push({ level: 'location', id: item.locationId });
  if (item.machineId !== undefined) chain.push({ level: 'machine', id: item.machineId });
  for (const scope of scopeChain(index, own)) if (!chain.some((s) => sameScope(s, scope))) chain.push(scope);
  if (!chain.some((s) => sameScope(s, own))) chain.push(own);
  return chain;
}

/**
 * Filtra un listado a lo que el usuario puede ver con `permission`.
 *
 * Un elemento es visible cuando el permiso se tiene en un alcance que lo contiene. Para permisos
 * de lectura (`*.view`) también es visible el contenedor de algo que el usuario administra
 * (p. ej. un franquiciatario ve su organización), nunca un hermano.
 */
export function narrowListToPrincipal<T extends ScopedItem>(
  items: T[],
  principal: Principal,
  index: HierarchyIndex,
  permission: PermissionKey,
  level: ScopeLevel,
): T[] {
  const entries = principal.permissions.filter((entry) => entry.key === permission);
  if (entries.length === 0) return [];
  const isView = permission.endsWith('.view');
  return items.filter((item) => {
    const chain = itemScopeChain(item, level, index);
    const own = chain[chain.length - 1] ?? { level: 'platform' };
    return entries.some((entry) => {
      if (entry.scope.level === 'platform') return true;
      if (chain.some((scope) => sameScope(scope, entry.scope))) return true;
      return isView && scopeContains(index, own, entry.scope);
    });
  });
}
