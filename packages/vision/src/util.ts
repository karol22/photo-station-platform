/** Utilidades numéricas puras compartidas por el paquete. */

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const degrees = (rad: number): number => (rad * 180) / Math.PI;

export const radians = (deg: number): number => (deg * Math.PI) / 180;

export const midpoint = (range: { min: number; max: number }): number => (range.min + range.max) / 2;

/** Elimina claves con valor `undefined` para que los spreads no pisen valores por defecto. */
export function definedOnly<T extends object>(obj: Partial<T>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}
