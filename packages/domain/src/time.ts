/**
 * Tiempo local: todo recibe `now: Date` y una zona horaria IANA; nunca lee el reloj del sistema.
 */
import type { DailySchedule } from '@psp/contracts';

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function buildFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Zona inválida o desconocida: se usa UTC para que un kiosco nunca se detenga por un dato malo. */
function formatterFor(timezone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timezone);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = buildFormatter(timezone);
  } catch {
    formatter = buildFormatter('UTC');
  }
  formatters.set(timezone, formatter);
  return formatter;
}

/** Partes de hora local: `hhmm` ('HH:mm'), `day` (0=domingo..6=sábado) e `isoDate` ('AAAA-MM-DD'). */
export function localTimeParts(now: Date, timezone: string): { hhmm: string; day: number; isoDate: string } {
  if (Number.isNaN(now.getTime())) throw new Error('localTimeParts: fecha inválida');
  const parts = formatterFor(timezone).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour').padStart(2, '0');
  const minute = get('minute').padStart(2, '0');
  return {
    hhmm: `${hour}:${minute}`,
    day: WEEKDAYS[get('weekday')] ?? 0,
    isoDate: `${get('year').padStart(4, '0')}-${get('month').padStart(2, '0')}-${get('day').padStart(2, '0')}`,
  };
}

/** 'HH:mm' → minutos desde medianoche. Texto inválido → NaN. */
export function hhmmToMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

/**
 * ¿`hhmm` cae dentro de [from, to)? Si `from > to` la ventana cruza medianoche.
 * Devuelve además si el instante pertenece a la parte posterior a medianoche (día siguiente).
 */
function inDailyRange(minutes: number, from: number, to: number): { inside: boolean; afterMidnight: boolean } {
  if (Number.isNaN(from) || Number.isNaN(to)) return { inside: false, afterMidnight: false };
  if (from === to) return { inside: true, afterMidnight: false }; // ventana de 24 h
  if (from < to) return { inside: minutes >= from && minutes < to, afterMidnight: false };
  if (minutes >= from) return { inside: true, afterMidnight: false };
  return { inside: minutes < to, afterMidnight: true };
}

/** Lista vacía = siempre. Un horario que cruza medianoche cuenta el día en que empieza. */
export function scheduleMatches(schedules: DailySchedule[], now: Date, timezone: string): boolean {
  if (schedules.length === 0) return true;
  const { hhmm, day } = localTimeParts(now, timezone);
  const minutes = hhmmToMinutes(hhmm);
  return schedules.some((schedule) => {
    const range = inDailyRange(minutes, hhmmToMinutes(schedule.from), hhmmToMinutes(schedule.to));
    if (!range.inside) return false;
    const startDay = range.afterMidnight ? (day + 6) % 7 : day;
    return schedule.days.includes(startDay);
  });
}

/** Ventana absoluta semiabierta [start, end). Sin ventana = siempre; sin `end` = sin fin. */
export function windowMatches(window: { start: string; end?: string } | undefined, now: Date): boolean {
  if (!window) return true;
  const start = Date.parse(window.start);
  if (Number.isNaN(start) || now.getTime() < start) return false;
  if (window.end === undefined) return true;
  const end = Date.parse(window.end);
  if (Number.isNaN(end)) return false;
  return now.getTime() < end;
}

/**
 * Ventana de mantenimiento en hora local. Sin `start` ni `end` = siempre dentro.
 * Soporta ventanas que cruzan medianoche (`22:00`–`06:00`).
 */
export function inMaintenanceWindow(hhmm: string, start?: string, end?: string): boolean {
  const minutes = hhmmToMinutes(hhmm);
  if (Number.isNaN(minutes)) return false;
  if (start === undefined && end === undefined) return true;
  if (start !== undefined && end === undefined) return minutes >= hhmmToMinutes(start);
  if (start === undefined && end !== undefined) return minutes < hhmmToMinutes(end);
  return inDailyRange(minutes, hhmmToMinutes(start ?? ''), hhmmToMinutes(end ?? '')).inside;
}

interface Semver {
  main: [number, number, number];
  prerelease: string[];
}

function parseSemver(version: string): Semver | undefined {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim());
  if (!match) return undefined;
  return {
    main: [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)],
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function compareIdentifiers(a: string, b: string): number {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) return Math.sign(Number(a) - Number(b));
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Comparación semver: -1 si a < b, 0 si iguales, 1 si a > b. Pre-release < release; build ignorado. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return a < b ? -1 : a > b ? 1 : 0;
  for (let i = 0; i < 3; i++) {
    const diff = (pa.main[i] ?? 0) - (pb.main[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0;
  if (pa.prerelease.length === 0) return 1;
  if (pb.prerelease.length === 0) return -1;
  const length = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < length; i++) {
    const ia = pa.prerelease[i];
    const ib = pb.prerelease[i];
    if (ia === undefined) return -1;
    if (ib === undefined) return 1;
    const diff = compareIdentifiers(ia, ib);
    if (diff !== 0) return diff;
  }
  return 0;
}
