/** Formateos auxiliares de la consola: tiempo relativo, bytes, porcentajes, dinero seguro. */
import type { LocaleCode, Money } from '@psp/contracts';

export function relativeTime(iso: string | undefined, now: Date, locale: LocaleCode): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.round((then - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'es', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatPct(value: number | undefined, digits = 0): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

/** Dinero con Intl; nunca lanza (cae a `amount currency`). */
export function money(value: Money | undefined, locale: LocaleCode): string {
  if (!value) return '—';
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-MX', { style: 'currency', currency: value.currency }).format(value.amount / 100);
  } catch {
    return `${(value.amount / 100).toFixed(2)} ${value.currency}`;
  }
}

export function dateTime(iso: string | undefined, locale: LocaleCode, timezone?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function dateOnly(iso: string | undefined, locale: LocaleCode, timezone?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-MX', { dateStyle: 'medium', ...(timezone ? { timeZone: timezone } : {}) }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function duration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** ISO de hace N días a medianoche UTC; útil para periodos por defecto. */
export function daysAgoIso(days: number, now: Date): string {
  const d = new Date(now.getTime() - days * 86400 * 1000);
  return d.toISOString();
}

export function toDateInput(iso: string | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function toDateTimeInput(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeInput(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function fromDateInput(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
