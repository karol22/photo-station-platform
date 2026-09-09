import type { ConfigKeyDefinition, ConfigLayer, ConfigLock } from '@psp/contracts';
import { CONFIG_KEYS } from '@psp/contracts';
import { layerRank } from './levels';
import { canApplyLock, foldLocks, indexDefinitions, normalizeLock, rejectionReason } from './rules';

export interface LayerViolation {
  key: string;
  reason: string;
}

export interface LayerValidation {
  ok: boolean;
  violations: LayerViolation[];
}

/**
 * Violación del valor respecto a la definición de la clave (tipo, enum, min/max), o `undefined`.
 * `asset` y `json` admiten `null`; `stringList` exige un array de cadenas.
 */
export function definitionViolation(
  value: unknown,
  definition: ConfigKeyDefinition,
): string | undefined {
  switch (definition.type) {
    case 'string':
    case 'text':
    case 'color':
      return typeof value === 'string' ? undefined : 'invalid_type';
    case 'asset':
      return value === null || typeof value === 'string' ? undefined : 'invalid_type';
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'invalid_type';
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'invalid_type';
      if (definition.min !== undefined && value < definition.min) return 'out_of_definition_range';
      if (definition.max !== undefined && value > definition.max) return 'out_of_definition_range';
      return undefined;
    }
    case 'enum': {
      if (typeof value !== 'string') return 'invalid_type';
      if (definition.enumValues !== undefined && !definition.enumValues.includes(value))
        return 'not_in_enum';
      return undefined;
    }
    case 'stringList':
      return Array.isArray(value) && value.every((item) => typeof item === 'string')
        ? undefined
        : 'invalid_type';
    case 'json':
      return undefined;
  }
}

function lockViolation(lock: ConfigLock): string | undefined {
  if (lock.policy !== 'range') return undefined;
  const range = lock.range;
  const constrained =
    range !== undefined &&
    (range.min !== undefined || range.max !== undefined || range.allowed !== undefined);
  if (!constrained) return 'invalid_lock';
  if (range.min !== undefined && range.max !== undefined && range.min > range.max)
    return 'invalid_lock';
  return undefined;
}

/**
 * Valida una capa antes de guardarla, con la misma lógica que el resolve pero sin ejecutarlo:
 * `editableAt`, bloqueos de las capas superiores (`parents`; las de nivel igual o inferior se
 * ignoran), consistencia con la definición y bloqueos propios que no tendrían efecto.
 */
export function validateLayer(
  layer: ConfigLayer,
  parents: ConfigLayer[],
  definitions: ConfigKeyDefinition[] = CONFIG_KEYS,
): LayerValidation {
  const index = indexDefinitions(definitions);
  const rank = layerRank(layer.level);
  const parentLocks = foldLocks(parents.filter((parent) => layerRank(parent.level) < rank));
  const violations: LayerViolation[] = [];

  for (const key of Object.keys(layer.values).sort()) {
    const value = layer.values[key];
    if (value === undefined) continue;
    const definition = index.get(key);
    const reason =
      rejectionReason({ key, value, level: layer.level, lock: parentLocks[key], definition }) ??
      (definition ? definitionViolation(value, definition) : undefined);
    if (reason !== undefined) violations.push({ key, reason });
  }

  for (const declared of layer.locks) {
    const lock = normalizeLock(declared, layer.level, layer.entityId);
    const reason =
      lockViolation(lock) ??
      (canApplyLock(parentLocks[lock.key], lock) ? undefined : 'lock_ignored');
    if (reason !== undefined) violations.push({ key: lock.key, reason });
  }

  return { ok: violations.length === 0, violations };
}
