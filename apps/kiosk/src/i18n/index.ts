/**
 * Traducción del kiosco: el catálogo de `@psp/i18n` tiene prioridad y `extra.ts` cubre las claves
 * que todavía viven aquí. `useT()` devuelve un traductor ligado al idioma del store.
 */
import { useMemo } from 'react';
import type { LocalizedText, Money } from '@psp/contracts';
import { formatDuration, formatMoney, messages, tl as tlBase, translateWith, type Locale, type MessageParams } from '@psp/i18n';
import { EXTRA_MESSAGES } from './extra';
import { useKioskStore } from '../store';

const CATALOGS: Record<Locale, Record<string, string>> = {
  es: { ...EXTRA_MESSAGES.es, ...messages.es },
  en: { ...EXTRA_MESSAGES.en, ...messages.en },
};

export function t(locale: Locale, key: string, params?: MessageParams): string {
  return translateWith(CATALOGS, locale, key, params);
}

export function tl(locale: Locale, text: LocalizedText | undefined, fallback = ''): string {
  return tlBase(locale, text, fallback);
}

export interface KioskTranslator {
  locale: Locale;
  t: (key: string, params?: MessageParams) => string;
  tl: (text: LocalizedText | undefined, fallback?: string) => string;
  money: (money: Money | undefined) => string;
  duration: (seconds: number) => string;
}

export function createKioskTranslator(locale: Locale): KioskTranslator {
  return {
    locale,
    t: (key, params) => t(locale, key, params),
    tl: (text, fallback) => tl(locale, text, fallback),
    money: (money) => (money ? formatMoney(money, locale) : ''),
    duration: (seconds) => formatDuration(seconds, locale),
  };
}

export function useT(): KioskTranslator {
  const locale = useKioskStore((s) => s.locale);
  return useMemo(() => createKioskTranslator(locale), [locale]);
}
