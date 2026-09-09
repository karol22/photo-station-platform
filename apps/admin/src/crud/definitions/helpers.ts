/**
 * Ayudas compartidas para declarar `ResourceDefinition`s rápido. Las etiquetas de columnas y
 * campos van por `labelKey` (i18n); las opciones de los `select` que vienen de listas cerradas de
 * `@psp/contracts` se muestran humanizadas (no son texto de negocio: son vocabulario del esquema,
 * p. ej. `out_of_service` → "Out of service"). Es una simplificación deliberada del mecanismo
 * genérico frente a traducir cada valor de cada enum de cada entidad; se documenta en el README.
 */
import type { FieldOption } from '../types';

export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function opts(values: readonly string[]): FieldOption[] {
  return values.map((v) => ({ value: v, label: humanize(v) }));
}

export function localizedText(value: unknown, fallback = ''): string {
  if (value !== null && typeof value === 'object') {
    const es = (value as Record<string, unknown>)['es'];
    if (typeof es === 'string' && es) return es;
  }
  return fallback;
}

export function str(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && value ? value : fallback;
}
