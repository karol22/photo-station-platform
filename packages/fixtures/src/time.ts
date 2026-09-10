/**
 * Tiempo fijo del dataset. `DEMO_NOW` es el "hoy" de todas las entidades relativas; las fechas
 * absolutas (creación, publicación) son literales. Nada usa `Date.now()`.
 */

/** Instante que el dataset trata como "hoy". */
export const DEMO_NOW = '2026-09-09T12:00:00Z';
export const DEMO_NOW_MS = Date.parse(DEMO_NOW);

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** ISO 8601 sin milisegundos cuando son cero (`2026-09-09T12:00:00Z`). */
export function iso(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

export function minutesAgo(minutes: number): string {
  return iso(DEMO_NOW_MS - minutes * MINUTE);
}
export function hoursAgo(hours: number): string {
  return iso(DEMO_NOW_MS - hours * HOUR);
}
export function daysAgo(days: number, hours = 0): string {
  return iso(DEMO_NOW_MS - days * DAY + hours * HOUR);
}
export function daysFromNow(days: number, hours = 0): string {
  return iso(DEMO_NOW_MS + days * DAY + hours * HOUR);
}

/**
 * Desfase fijo en horas respecto a UTC por zona. México no aplica horario de verano desde 2022
 * (salvo la franja fronteriza, que el dataset evita); Colombia nunca lo aplica. Suficiente para
 * horarios locales deterministas sin depender de datos ICU.
 */
export const TZ_OFFSET_HOURS: Readonly<Record<string, number>> = {
  'America/Mexico_City': -6,
  'America/Monterrey': -6,
  'America/Merida': -6,
  'America/Chihuahua': -6,
  'America/Cancun': -5,
  'America/Hermosillo': -7,
  'America/Mazatlan': -7,
  'America/Bogota': -5,
};

export function tzOffsetHours(timezone: string): number {
  return TZ_OFFSET_HOURS[timezone] ?? -6;
}

export interface LocalParts {
  /** Hora local 0..23. */
  hour: number;
  minute: number;
  /** Día de la semana local, 0 = domingo. */
  weekday: number;
  /** Fecha local `YYYY-MM-DD`. */
  isoDate: string;
}

/** Descompone un instante UTC en partes de hora local según la zona. */
export function localParts(utcMs: number, timezone: string): LocalParts {
  const shifted = new Date(utcMs + tzOffsetHours(timezone) * HOUR);
  return {
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
    isoDate: shifted.toISOString().slice(0, 10),
  };
}

/** Medianoche local (en ms UTC) del día local que contiene `utcMs`, desplazada `dayOffset` días. */
export function localMidnightUtcMs(utcMs: number, timezone: string, dayOffset = 0): number {
  const shifted = new Date(utcMs + tzOffsetHours(timezone) * HOUR);
  const midnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + dayOffset);
  return midnightShifted - tzOffsetHours(timezone) * HOUR;
}

/** Convierte `HH:mm` a minutos desde medianoche. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}
