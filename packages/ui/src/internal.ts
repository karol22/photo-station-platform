/** Une clases ignorando valores falsy. */
export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  let out = '';
  for (const part of parts) {
    if (part) out = out ? `${out} ${part}` : part;
  }
  return out;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Convierte un número a `px` y deja pasar cadenas CSS tal cual. */
export function toCssSize(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

/** Fracción 0..1 de `part` sobre `total`; devuelve 0 cuando `total` no es positivo. */
export function fraction(part: number, total: number): number {
  if (!(total > 0)) return 0;
  return clamp(part / total, 0, 1);
}

/** Ajusta `value` al múltiplo de `step` más cercano dentro de [min, max], corrigiendo errores de coma flotante. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return clamp(value, min, max);
  const steps = Math.round((value - min) / step);
  const decimals = (step.toString().split('.')[1] ?? '').length;
  const snapped = Number((min + steps * step).toFixed(decimals));
  return clamp(snapped, min, max);
}
