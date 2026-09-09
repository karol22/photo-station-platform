// Stub tipado de la API pública de @psp/i18n (docs/arquitectura/01-apis-de-paquetes.md).
// Cada función se implementa en el paso siguiente; las firmas ya son las definitivas.
import type { CatalogEntry, LocaleCode, LocalizedText, Money } from '@psp/contracts';

export type Locale = LocaleCode;
export type MessageKey = string;
export type MessageParams = Record<string, string | number>;

export const messages: Record<Locale, Record<string, string>> = { es: {}, en: {} };

export function t(_locale: Locale, _key: MessageKey, _params?: MessageParams): string {
  throw new Error('pending');
}

export function tl(_locale: Locale, _text: LocalizedText | undefined, _fallback?: string): string {
  throw new Error('pending');
}

export interface Translator {
  readonly locale: Locale;
  t: (key: MessageKey, params?: MessageParams) => string;
  tl: (text: LocalizedText | undefined, fallback?: string) => string;
}

export function createTranslator(_locale: Locale): Translator {
  throw new Error('pending');
}

export function formatMoney(_money: Money, _locale: Locale): string {
  throw new Error('pending');
}

export function formatDate(
  _iso: string,
  _locale: Locale,
  _timezone: string,
  _style: 'short' | 'long' = 'short',
): string {
  throw new Error('pending');
}

export function formatTime(_iso: string, _locale: Locale, _timezone: string): string {
  throw new Error('pending');
}

export function formatNumber(_n: number, _locale: Locale): string {
  throw new Error('pending');
}

export function formatDuration(_seconds: number, _locale: Locale): string {
  throw new Error('pending');
}

export const CATALOG: CatalogEntry[] = [];
