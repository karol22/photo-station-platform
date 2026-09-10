/**
 * Autenticación y alcance.
 *
 * Administración: `Authorization: Bearer <token>` → `Principal` (resolvePrincipal de @psp/domain).
 * Flota: `Authorization: Machine <machineId>:<secret>` comparado en tiempo constante.
 * El aislamiento entre franquicias es por construcción: todo listado pasa por `narrowToPrincipal`
 * y toda mutación por `assertCan`.
 */
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Id, Principal, PermissionKey, RoleAssignment, Scope, ScopeLevel, SupportAccess, User } from '@psp/contracts';
import {
  can,
  narrowListToPrincipal,
  resolvePrincipal,
  sameScope,
  scopeChain,
  scopeContains,
  sha256Hex,
  type HierarchyIndex,
} from '@psp/domain';
import type { AppContext } from './context';
import { forbidden, unauthorized } from './context';
import { getCredential, getToken, type ScopeColumns } from './store';

/** Credencial de usuario sembrada en `entities` (type `credentials`) para no depender de fixtures en runtime. */
export interface UserCredential {
  id: Id;
  userId: Id;
  email: string;
  /** sha256 hex de la contraseña. */
  passwordHash: string;
}

export function sha256HexOf(text: string): string {
  return sha256Hex(new TextEncoder().encode(text));
}

export function principalFor(ctx: AppContext, userId: Id): Principal | undefined {
  const user = ctx.repo.get<User>('users', userId);
  if (!user) return undefined;
  const assignments = ctx.repo.list<RoleAssignment>('roleAssignments').filter((a) => a.userId === userId);
  const supports = ctx.repo.list<SupportAccess>('supportAccesses').filter((s) => s.userId === userId);
  return resolvePrincipal(user, assignments, supports, ctx.now());
}

/** Principal de la petición administrativa o 401. */
export function requirePrincipal(ctx: AppContext, request: FastifyRequest): Principal {
  const header = request.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw unauthorized('Missing bearer token');
  const token = getToken(ctx.db, match[1] ?? '');
  if (!token) throw unauthorized('Invalid token');
  if (token.expiresAt <= ctx.nowIso()) throw unauthorized('Token expired');
  const principal = principalFor(ctx, token.userId);
  if (!principal) throw unauthorized('Unknown user');
  if (principal.user.status === 'suspended') throw forbidden('User suspended');
  return principal;
}

/** Máquina autenticada de la petición de flota o 401 (`machine_unauthorized`). */
export function requireMachine(ctx: AppContext, request: FastifyRequest): Id {
  const header = request.headers.authorization ?? '';
  const match = /^Machine\s+([^:\s]+):(.+)$/i.exec(header);
  if (!match) throw unauthorized('Missing machine credential');
  const machineId = match[1] ?? '';
  const secret = match[2] ?? '';
  const stored = getCredential(ctx.db, machineId);
  if (!stored) throw unauthorized('Unknown machine');
  const a = Buffer.from(stored);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw unauthorized('Invalid machine credential');
  return machineId;
}

const LEVEL_FIELD: Record<Exclude<ScopeLevel, 'platform'>, keyof ScopeColumns> = {
  organization: 'organizationId',
  franchise: 'franchiseId',
  region: 'regionId',
  location: 'locationId',
  machine: 'machineId',
};

/** Campos de alcance de un elemento: explícitos, `scope`/`ownerScope` y ancestros vía índice. */
export function scopeFieldsOf(item: Record<string, unknown>, index: HierarchyIndex): ScopeColumns {
  const out: ScopeColumns = {};
  const str = (key: string): string | undefined => (typeof item[key] === 'string' ? (item[key] as string) : undefined);
  for (const level of ['organization', 'franchise', 'region', 'location', 'machine'] as const) {
    const value = str(LEVEL_FIELD[level]);
    if (value !== undefined) out[LEVEL_FIELD[level]] = value;
  }
  const scope = (item['scope'] ?? item['ownerScope']) as Scope | undefined;
  if (scope && scope.level !== 'platform' && scope.id !== undefined) out[LEVEL_FIELD[scope.level]] = scope.id;
  const deepest = deepestScope(out);
  if (deepest.level !== 'platform') {
    for (const ancestor of scopeChain(index, deepest)) {
      if (ancestor.level === 'platform' || ancestor.id === undefined) continue;
      const field = LEVEL_FIELD[ancestor.level];
      if (out[field] === undefined) out[field] = ancestor.id;
    }
  }
  return out;
}

export function deepestScope(fields: ScopeColumns): Scope {
  if (fields.machineId !== undefined) return { level: 'machine', id: fields.machineId };
  if (fields.locationId !== undefined) return { level: 'location', id: fields.locationId };
  if (fields.regionId !== undefined) return { level: 'region', id: fields.regionId };
  if (fields.franchiseId !== undefined) return { level: 'franchise', id: fields.franchiseId };
  if (fields.organizationId !== undefined) return { level: 'organization', id: fields.organizationId };
  return { level: 'platform' };
}

/** Alcance propio de una entidad de jerarquía (su propio id) o el más profundo de sus campos. */
export function ownScopeOf(item: Record<string, unknown>, level: ScopeLevel | 'auto', index: HierarchyIndex): Scope {
  if (level !== 'auto' && level !== 'platform' && typeof item['id'] === 'string') return { level, id: item['id'] };
  return deepestScope(scopeFieldsOf(item, index));
}

/**
 * ¿El principal ve el elemento con `permission`? Sí cuando tiene el permiso en un alcance que lo
 * contiene, o cuando el elemento es un contenedor (o entidad compartida de plataforma) de algo
 * que administra. Nunca un hermano.
 */
export function visibleTo(principal: Principal, permission: PermissionKey, own: Scope, index: HierarchyIndex): boolean {
  return principal.permissions.some((entry) => {
    if (entry.key !== permission) return false;
    if (entry.scope.level === 'platform') return true;
    if (scopeContains(index, entry.scope, own)) return true;
    return scopeContains(index, own, entry.scope);
  });
}

/** Filtra un listado al alcance del principal. Las entidades de jerarquía usan `narrowListToPrincipal`. */
export function narrowToPrincipal<T extends Record<string, unknown>>(
  items: T[],
  principal: Principal,
  permission: PermissionKey,
  level: ScopeLevel | 'auto',
  index: HierarchyIndex,
  type?: string,
): T[] {
  if (type === 'users') return items.filter((item) => userVisible(item, principal, index));
  if (level !== 'auto') return narrowListToPrincipal(items as Array<T & { id?: string }>, principal, index, permission, level);
  return items.filter((item) => visibleTo(principal, permission, ownScopeOf(item, 'auto', index), index));
}

/** Un usuario es visible si alguna de sus asignaciones cae dentro de un alcance donde el principal administra usuarios. */
function userVisible(item: Record<string, unknown>, principal: Principal, index: HierarchyIndex): boolean {
  const entries = principal.permissions.filter((entry) => entry.key === 'users.manage');
  if (entries.some((entry) => entry.scope.level === 'platform')) return true;
  if (item['id'] === principal.user.id) return true;
  const assignments = (item['__assignments'] as RoleAssignment[] | undefined) ?? [];
  return assignments.some((assignment) => entries.some((entry) => scopeContains(index, entry.scope, assignment.scope) || sameScope(entry.scope, assignment.scope)));
}

/** 403 si el principal no tiene `permission` sobre `target`. */
export function assertCan(principal: Principal, permission: PermissionKey, target: Scope, index: HierarchyIndex): void {
  if (!can(principal, permission, target, index)) throw forbidden(`Missing permission ${permission} at ${target.level}${target.id ? ':' + target.id : ''}`);
}

/** Filtro de alcance (ScopeFilter) → alcance objetivo para comprobar permisos. */
export function scopeFromFilter(filter: ScopeColumns): Scope {
  return deepestScope(filter);
}
