// Reglas compartidas por `resolveEffectiveConfig` y `validateLayer`: quién puede escribir una
// clave, qué bloqueos aplican y cuándo un bloqueo inferior se ignora.
import type {
  ConfigKeyDefinition,
  ConfigLayer,
  ConfigLevel,
  ConfigLock,
  Id,
  LockPolicy,
} from '@psp/contracts';
import { layerRank, scopeLevelFor } from './levels';

export type LockMap = Record<string, ConfigLock>;
export type DefinitionIndex = ReadonlyMap<string, ConfigKeyDefinition>;

/** Motivos de rechazo que produce el motor. `locked_by_<level>` lleva el nivel que bloquea. */
export const REJECTION_REASONS = [
  'not_editable_at_level',
  'locked_by_<level>',
  'out_of_range',
  'lock_ignored',
] as const;

/** Motivos adicionales que sólo reporta `validateLayer` (chequeo contra la definición). */
export const VALIDATION_REASONS = [
  'invalid_type',
  'not_in_enum',
  'out_of_definition_range',
  'invalid_lock',
] as const;

/** Fuerza de cada política: un nivel inferior sólo puede endurecer, nunca debilitar. */
export const LOCK_STRENGTH: Record<LockPolicy, number> = {
  editable: 0,
  range: 1,
  mandatory: 2,
  hidden: 3,
};

export function indexDefinitions(definitions: ConfigKeyDefinition[]): DefinitionIndex {
  const index = new Map<string, ConfigKeyDefinition>();
  for (const definition of definitions) index.set(definition.key, definition);
  return index;
}

type Range = NonNullable<ConfigLock['range']>;

function hasConstraints(range: Range | undefined): range is Range {
  return (
    range !== undefined &&
    (range.min !== undefined || range.max !== undefined || range.allowed !== undefined)
  );
}

/**
 * Un número cumple `min`/`max` (o `allowed` cuando es la única restricción); una cadena cumple
 * `allowed`. Cualquier otro tipo queda fuera de rango. Un rango sin restricciones acepta todo.
 */
export function isWithinRange(value: unknown, range: ConfigLock['range']): boolean {
  if (!hasConstraints(range)) return true;
  const { min, max, allowed } = range;
  const hasBounds = min !== undefined || max !== undefined;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    if (hasBounds)
      return (min === undefined || value >= min) && (max === undefined || value <= max);
    return allowed !== undefined && allowed.includes(String(value));
  }
  if (typeof value === 'string') {
    return allowed !== undefined && allowed.includes(value);
  }
  return false;
}

/** `inner` no relaja ninguna restricción de `outer`. */
export function isRangeContained(inner: ConfigLock['range'], outer: ConfigLock['range']): boolean {
  if (!hasConstraints(outer)) return true;
  if (!hasConstraints(inner)) return false;
  if (outer.min !== undefined && (inner.min === undefined || inner.min < outer.min)) return false;
  if (outer.max !== undefined && (inner.max === undefined || inner.max > outer.max)) return false;
  if (outer.allowed !== undefined) {
    if (inner.allowed === undefined) return false;
    const permitted = new Set(outer.allowed);
    for (const option of inner.allowed) if (!permitted.has(option)) return false;
  }
  return true;
}

export interface WriteCheck {
  key: string;
  value: unknown;
  level: ConfigLevel;
  lock?: ConfigLock | undefined;
  definition?: ConfigKeyDefinition | undefined;
}

/**
 * Motivo por el que `level` no puede escribir `key`, o `undefined` si puede.
 * Orden: primero `editableAt` de la definición, después el bloqueo efectivo de un nivel superior.
 * Un bloqueo del mismo nivel o de uno inferior nunca aplica.
 */
export function rejectionReason({
  key: _key,
  value,
  level,
  lock,
  definition,
}: WriteCheck): string | undefined {
  if (definition && !definition.editableAt.includes(scopeLevelFor(level))) {
    return 'not_editable_at_level';
  }
  if (lock && layerRank(lock.setBy) < layerRank(level)) {
    switch (lock.policy) {
      case 'mandatory':
      case 'hidden':
        return `locked_by_${lock.setBy}`;
      case 'range':
        return isWithinRange(value, lock.range) ? undefined : 'out_of_range';
      case 'editable':
        return undefined;
    }
  }
  return undefined;
}

/**
 * Un bloqueo entrante sustituye al efectivo cuando no hay ninguno, cuando viene del mismo nivel
 * (la última declaración gana) o cuando es estrictamente más fuerte. Un `range` bajo otro
 * `range` sólo se acepta si está contenido en él.
 */
export function canApplyLock(current: ConfigLock | undefined, incoming: ConfigLock): boolean {
  if (!current) return true;
  if (layerRank(current.setBy) >= layerRank(incoming.setBy)) return true;
  const currentStrength = LOCK_STRENGTH[current.policy];
  const incomingStrength = LOCK_STRENGTH[incoming.policy];
  if (incomingStrength > currentStrength) return true;
  if (incomingStrength < currentStrength) return false;
  if (incoming.policy === 'range') return isRangeContained(incoming.range, current.range);
  return false;
}

/** El bloqueo tal como lo declara la capa: `setBy` es siempre el nivel de la capa que lo declara. */
export function normalizeLock(
  lock: ConfigLock,
  level: ConfigLevel,
  entityId: Id | undefined,
): ConfigLock {
  const setById = entityId ?? lock.setById;
  const normalized: ConfigLock = { key: lock.key, policy: lock.policy, setBy: level };
  if (lock.range !== undefined) normalized.range = lock.range;
  if (setById !== undefined) normalized.setById = setById;
  return normalized;
}

/**
 * Aplica los bloqueos de una capa sobre el mapa efectivo. Llama a `onIgnored` por cada bloqueo
 * que intenta debilitar (o repetir) uno de un nivel superior.
 */
export function applyLayerLocks(
  locks: LockMap,
  layer: ConfigLayer,
  entityId: Id | undefined,
  onIgnored?: (lock: ConfigLock) => void,
): void {
  for (const declared of layer.locks) {
    const lock = normalizeLock(declared, layer.level, entityId);
    if (canApplyLock(locks[lock.key], lock)) {
      locks[lock.key] = lock;
    } else {
      onIgnored?.(lock);
    }
  }
}

/** Bloqueos efectivos que resultan de aplicar `layers` en orden de rango (orden estable). */
export function foldLocks(layers: ConfigLayer[]): LockMap {
  const locks: LockMap = {};
  const ordered = [...layers].sort((a, b) => layerRank(a.level) - layerRank(b.level));
  for (const layer of ordered) applyLayerLocks(locks, layer, layer.entityId);
  return locks;
}

/** Copia de un registro con las claves en orden alfabético. */
export function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};
  for (const key of Object.keys(record).sort()) {
    const value = record[key];
    if (value !== undefined) sorted[key] = value;
  }
  return sorted;
}
