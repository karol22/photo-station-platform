/**
 * Jerarquía y alcance: plataforma → organización → franquicia → región → ubicación → máquina.
 *
 * Un `Scope` es nivel + id. La cadena de un alcance son sus ancestros en orden, empezando por la
 * plataforma. Todo aislamiento entre franquicias se construye sobre `scopeContains`.
 */
import type {
  Franchise,
  Id,
  Location,
  Machine,
  Organization,
  Region,
  RolloutTarget,
  Scope,
  ScopeLevel,
} from '@psp/contracts';
import { stableHash } from './ids';

export interface HierarchyIndex {
  organizations: Map<Id, Organization>;
  franchises: Map<Id, Franchise>;
  regions: Map<Id, Region>;
  locations: Map<Id, Location>;
  machines: Map<Id, Machine>;
}

/** Orden de los niveles: útil para ordenar alcances y decidir qué nivel es más específico. */
export const SCOPE_LEVEL_RANK: Record<ScopeLevel, number> = {
  platform: 0,
  organization: 1,
  franchise: 2,
  region: 3,
  location: 4,
  machine: 5,
};

export const PLATFORM_SCOPE: Scope = { level: 'platform' };

export function buildHierarchyIndex(data: {
  organizations: Organization[];
  franchises: Franchise[];
  regions: Region[];
  locations: Location[];
  machines: Machine[];
}): HierarchyIndex {
  return {
    organizations: new Map(data.organizations.map((o) => [o.id, o])),
    franchises: new Map(data.franchises.map((f) => [f.id, f])),
    regions: new Map(data.regions.map((r) => [r.id, r])),
    locations: new Map(data.locations.map((l) => [l.id, l])),
    machines: new Map(data.machines.map((m) => [m.id, m])),
  };
}

/** Dos alcances son el mismo si coinciden nivel e id (la plataforma no lleva id). */
export function sameScope(a: Scope, b: Scope): boolean {
  if (a.level !== b.level) return false;
  return a.level === 'platform' || a.id === b.id;
}

/** Clave estable de un alcance, útil para conjuntos y mapas. */
export function scopeKey(scope: Scope): string {
  return scope.level === 'platform' ? 'platform' : `${scope.level}:${scope.id ?? ''}`;
}

/**
 * Cadena de alcance hasta `target`: [platform, organization, franchise?, region?, location?, machine?].
 * Si la entidad no está en el índice, la cadena es [platform, target] (lo desconocido no hereda nada).
 */
export function scopeChain(index: HierarchyIndex, target: Scope): Scope[] {
  const chain: Scope[] = [PLATFORM_SCOPE];
  const push = (level: ScopeLevel, id: Id | undefined): void => {
    if (id !== undefined) chain.push({ level, id });
  };
  switch (target.level) {
    case 'platform':
      return chain;
    case 'organization':
      push('organization', target.id);
      return chain;
    case 'franchise': {
      const franchise = target.id === undefined ? undefined : index.franchises.get(target.id);
      if (franchise) push('organization', franchise.organizationId);
      push('franchise', target.id);
      return chain;
    }
    case 'region': {
      const region = target.id === undefined ? undefined : index.regions.get(target.id);
      if (region) {
        push('organization', region.organizationId);
        push('franchise', region.franchiseId);
      }
      push('region', target.id);
      return chain;
    }
    case 'location': {
      const location = target.id === undefined ? undefined : index.locations.get(target.id);
      if (location) {
        const region = location.regionId === undefined ? undefined : index.regions.get(location.regionId);
        push('organization', location.organizationId);
        push('franchise', location.franchiseId ?? region?.franchiseId);
        push('region', location.regionId);
      }
      push('location', target.id);
      return chain;
    }
    case 'machine': {
      const machine = target.id === undefined ? undefined : index.machines.get(target.id);
      if (machine) {
        const location = machine.locationId === undefined ? undefined : index.locations.get(machine.locationId);
        const regionId = machine.regionId ?? location?.regionId;
        const region = regionId === undefined ? undefined : index.regions.get(regionId);
        push('organization', machine.organizationId);
        push('franchise', machine.franchiseId ?? location?.franchiseId ?? region?.franchiseId);
        push('region', regionId);
        push('location', machine.locationId);
      }
      push('machine', target.id);
      return chain;
    }
    default:
      return chain;
  }
}

/** `outer` contiene a `inner` cuando es uno de sus ancestros o el mismo alcance. */
export function scopeContains(index: HierarchyIndex, outer: Scope, inner: Scope): boolean {
  if (outer.level === 'platform') return true;
  if (sameScope(outer, inner)) return true;
  return scopeChain(index, inner).some((scope) => sameScope(scope, outer));
}

/** Máquinas cuya cadena incluye `scope`, en el orden del índice. */
export function machinesInScope(index: HierarchyIndex, scope: Scope): Machine[] {
  const machines: Machine[] = [];
  for (const machine of index.machines.values()) {
    if (scopeContains(index, scope, { level: 'machine', id: machine.id })) machines.push(machine);
  }
  return machines;
}

function machinesMatchingTarget(index: HierarchyIndex, target: Exclude<RolloutTarget, { kind: 'percentage' }>): Machine[] {
  const all = Array.from(index.machines.values());
  switch (target.kind) {
    case 'machines': {
      const wanted = new Set(target.machineIds);
      return all.filter((m) => wanted.has(m.id));
    }
    case 'location':
      return machinesInScope(index, { level: 'location', id: target.locationId });
    case 'franchise':
      return machinesInScope(index, { level: 'franchise', id: target.franchiseId });
    case 'region':
      return machinesInScope(index, { level: 'region', id: target.regionId });
    case 'organization':
      return machinesInScope(index, { level: 'organization', id: target.organizationId });
    case 'hardwareProfile':
      return all.filter((m) => m.hardwareProfileId === target.hardwareProfileId);
    case 'channel':
      return all.filter((m) => m.releaseChannel === target.channel);
    case 'tags': {
      const wanted = new Set(target.tags);
      return all.filter((m) => m.tags.some((tag) => wanted.has(tag)));
    }
    default:
      return [];
  }
}

/**
 * Toma el `percent` % de `machines` de forma determinista: ordena por
 * `stableHash(seed + machineId)` y redondea hacia arriba. Mismo seed → mismas máquinas.
 */
export function selectPercentage(machines: Machine[], percent: number, seed: string): Machine[] {
  if (machines.length === 0) return [];
  const clamped = Math.min(100, Math.max(0, percent));
  const count = Math.ceil((machines.length * clamped) / 100);
  const ranked = machines
    .map((machine) => ({ machine, rank: stableHash(seed + machine.id) }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.machine.id < b.machine.id ? -1 : 1));
  return ranked.slice(0, count).map((entry) => entry.machine);
}

/**
 * Resuelve los objetivos de un rollout a máquinas concretas.
 *
 * Los objetivos no porcentuales se unen (sin duplicados, en el orden del índice). Un objetivo
 * `percentage` filtra esa población (o toda la flota si es el único objetivo) de forma determinista.
 */
export function resolveRolloutTargets(index: HierarchyIndex, targets: RolloutTarget[]): Machine[] {
  const percentages = targets.filter((t): t is Extract<RolloutTarget, { kind: 'percentage' }> => t.kind === 'percentage');
  const others = targets.filter((t): t is Exclude<RolloutTarget, { kind: 'percentage' }> => t.kind !== 'percentage');

  let population: Machine[];
  if (others.length === 0) {
    population = Array.from(index.machines.values());
  } else {
    const selected = new Set<Id>();
    for (const target of others) for (const machine of machinesMatchingTarget(index, target)) selected.add(machine.id);
    population = Array.from(index.machines.values()).filter((m) => selected.has(m.id));
  }
  for (const target of percentages) population = selectPercentage(population, target.percent, target.seed);
  return population;
}
