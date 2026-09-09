/**
 * Auditoría: diferencia de primer nivel entre dos valores para registrar sólo lo que cambia.
 */
import { stableStringify } from './ids';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Igualdad estructural por JSON canónico. */
export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * Devuelve sólo las claves de primer nivel cuyo valor cambia. Si alguno de los dos no es un objeto,
 * devuelve ambos valores tal cual (o `undefined` en ambos cuando son iguales).
 */
export function auditDiff(before: unknown, after: unknown): { before: unknown; after: unknown } {
  if (!isPlainObject(before) || !isPlainObject(after)) {
    return deepEqual(before, after) ? { before: undefined, after: undefined } : { before, after };
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  for (const key of Array.from(keys).sort()) {
    if (deepEqual(before[key], after[key])) continue;
    if (key in before) changedBefore[key] = before[key];
    if (key in after) changedAfter[key] = after[key];
  }
  return { before: changedBefore, after: changedAfter };
}
