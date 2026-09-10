/**
 * @psp/i18n: catálogos es/en, traducción con parámetros y formateo local.
 *
 * Superficie pública fijada en docs/arquitectura/01-apis-de-paquetes.md (sección @psp/i18n).
 * Todo es puro y determinista: el único estado es una caché de formateadores Intl.
 */
import type { CatalogEntry, LocaleCode, LocalizedText, Money } from '@psp/contracts';
import { es, type MessageKey } from './messages/es';
import { en } from './messages/en';

export type { MessageKey };
export { es, en };

/** Idiomas soportados por la plataforma (requisito 28): español principal, inglés permitido. */
export type Locale = LocaleCode;
export const LOCALES: readonly Locale[] = ['es', 'en'];
export const DEFAULT_LOCALE: Locale = 'es';

/** Parámetros de interpolación: cada `{{nombre}}` del texto se sustituye por `String(valor)`. */
export type MessageParams = Record<string, string | number>;

/** Clave conocida (con autocompletado) o cualquier cadena: una clave desconocida se devuelve tal cual. */
export type MessageKeyLike = MessageKey | (string & {});

export type MessageCatalog = Record<string, string>;
export type MessageCatalogs = Partial<Record<Locale, MessageCatalog>>;

/** Catálogos por idioma. Español es la fuente; inglés tiene exactamente las mismas claves. */
export const messages: Record<Locale, MessageCatalog> = { es, en };

/** Todas las claves del catálogo en el orden en que se declaran en `es`. */
export const MESSAGE_KEYS: readonly MessageKey[] = Object.keys(es) as MessageKey[];

export function isLocale(value: unknown): value is Locale {
  return value === 'es' || value === 'en';
}

/** Devuelve el idioma si es válido; si no, el idioma por defecto. */
export function resolveLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(value) ? value : fallback;
}

export function hasMessage(key: string): key is MessageKey {
  return Object.hasOwn(es, key);
}

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Sustituye `{{nombre}}` por el parámetro correspondiente. Un parámetro ausente deja el marcador visible. */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** Nombres de parámetros que usa un texto (`{{nombre}}`), en orden de aparición y sin repetir. */
export function placeholdersOf(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name !== undefined && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Traduce contra catálogos arbitrarios: idioma pedido → español → la clave misma.
 * `t` delega aquí con los catálogos del paquete; las pruebas usan catálogos ad hoc.
 */
export function translateWith(
  catalogs: MessageCatalogs,
  locale: Locale,
  key: MessageKeyLike,
  params?: MessageParams,
): string {
  const template = catalogs[locale]?.[key] ?? catalogs.es?.[key] ?? key;
  return interpolate(template, params);
}

/** Traduce una clave: cae a español si falta en el idioma pedido y a la clave si no existe. */
export function t(locale: Locale, key: MessageKeyLike, params?: MessageParams): string {
  return translateWith(messages, locale, key, params);
}

/** Resuelve un texto localizable de contenido configurable (`LocalizedText`): inglés opcional cae a español. */
export function tl(locale: Locale, text: LocalizedText | undefined, fallback = ''): string {
  if (!text) return fallback;
  const preferred = locale === 'en' ? text.en : undefined;
  return preferred || text.es || fallback;
}

/** Locales BCP 47 con los que se formatea: México para español, Estados Unidos para inglés. */
const INTL_LOCALE: Record<Locale, string> = { es: 'es-MX', en: 'en-US' };

export function intlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Formatea dinero en unidades menores (`Money.amount` son centavos): 8000 MXN → "$80.00" en es-MX.
 * Con un código de moneda inválido cae a "80.00 XYZ" en lugar de lanzar.
 */
export function formatMoney(money: Money, locale: Locale): string {
  const currency = money.currency.toUpperCase();
  const major = money.amount / 100;
  const cacheKey = `${locale}:${currency}`;
  let formatter = moneyFormatters.get(cacheKey);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency });
    } catch {
      return `${formatNumber(major, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    }
    moneyFormatters.set(cacheKey, formatter);
  }
  return formatter.format(major);
}

export function formatNumber(n: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  if (options) return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(n);
  let formatter = numberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale]);
    numberFormatters.set(locale, formatter);
  }
  return formatter.format(n);
}

function parseIso(iso: string): Date | undefined {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Formatea con la zona pedida; si la zona no es válida, usa UTC en lugar de fallar. */
function formatInZone(date: Date, locale: Locale, timezone: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: timezone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: 'UTC' }).format(date);
  }
}

/**
 * Fecha en la zona horaria dada. `short` → "09/09/2026"; `long` → "9 de septiembre de 2026" /
 * "September 9, 2026". Una marca de tiempo inválida produce cadena vacía.
 */
export function formatDate(
  iso: string,
  locale: Locale,
  timezone: string,
  style: 'short' | 'long' = 'short',
): string {
  const date = parseIso(iso);
  if (!date) return '';
  const options: Intl.DateTimeFormatOptions =
    style === 'long' ? { dateStyle: 'long' } : { year: 'numeric', month: '2-digit', day: '2-digit' };
  return formatInZone(date, locale, timezone, options);
}

/** Hora local en la zona dada con el ciclo horario del idioma ("2:05 p.m." / "2:05 PM"). */
export function formatTime(iso: string, locale: Locale, timezone: string): string {
  const date = parseIso(iso);
  if (!date) return '';
  return formatInZone(date, locale, timezone, { hour: 'numeric', minute: '2-digit' });
}

/** Duración compacta en horas, minutos y segundos: 150 → "2 min 30 s"; 0 → "0 s". */
export function formatDuration(seconds: number, locale: Locale): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${t(locale, 'units.h')}`);
  if (minutes > 0) parts.push(`${minutes} ${t(locale, 'units.min')}`);
  if (rest > 0 || parts.length === 0) parts.push(`${rest} ${t(locale, 'units.s')}`);
  return parts.join(' ');
}

/** Traductor ligado a un idioma, para pasar a componentes y pantallas. */
export interface Translator {
  readonly locale: Locale;
  t: (key: MessageKeyLike, params?: MessageParams) => string;
  tl: (text: LocalizedText | undefined, fallback?: string) => string;
  formatMoney: (money: Money) => string;
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
  formatDuration: (seconds: number) => string;
  formatDate: (iso: string, timezone: string, style?: 'short' | 'long') => string;
  formatTime: (iso: string, timezone: string) => string;
}

export function createTranslator(locale: Locale): Translator {
  return {
    locale,
    t: (key, params) => t(locale, key, params),
    tl: (text, fallback) => tl(locale, text, fallback),
    formatMoney: (money) => formatMoney(money, locale),
    formatNumber: (n, options) => formatNumber(n, locale, options),
    formatDuration: (seconds) => formatDuration(seconds, locale),
    formatDate: (iso, timezone, style) => formatDate(iso, locale, timezone, style),
    formatTime: (iso, timezone) => formatTime(iso, locale, timezone),
  };
}

/** Registro para `pnpm catalog`: lo no registrado no existe (AGENTS.md §3). */
export const CATALOG: CatalogEntry[] = [
  {
    kind: 'package',
    key: '@psp/i18n',
    name: '@psp/i18n',
    description:
      'Catálogos es/en con paridad de claves, t() con parámetros y fallback, tl() para contenido localizable y formateo de dinero, fecha, hora, número y duración.',
    package: '@psp/i18n',
    status: 'stable',
    docs: 'packages/i18n/README.md',
  },
];
