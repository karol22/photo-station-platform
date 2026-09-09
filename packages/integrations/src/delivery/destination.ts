import type { DeliveryChannelKey } from '../types';

export type DestinationFailureReason = 'empty' | 'invalid_phone' | 'invalid_email';

export type DestinationCheck =
  | { ok: true; normalized: string }
  | { ok: false; reason: DestinationFailureReason };

/** E.164 aproximado: `+`, primer dígito 1-9 y entre 7 y 15 dígitos en total. */
const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_NOISE = /[\s().-]/g;

/** Valida el formato mínimo del destino según el canal; no verifica que exista. */
export function validateDestination(channel: DeliveryChannelKey, destination: string): DestinationCheck {
  const trimmed = (destination ?? '').trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (channel === 'email') {
    return EMAIL_RE.test(trimmed)
      ? { ok: true, normalized: trimmed.toLowerCase() }
      : { ok: false, reason: 'invalid_email' };
  }
  const digits = trimmed.replace(PHONE_NOISE, '');
  return PHONE_RE.test(digits) ? { ok: true, normalized: digits } : { ok: false, reason: 'invalid_phone' };
}

/** Versión enmascarada para registros y pantallas: `+52********90`, `a***@dominio.com`. */
export function maskDestination(destination: string): string {
  const value = (destination ?? '').trim();
  const at = value.indexOf('@');
  if (at > 0) return `${value.slice(0, 1)}***@${value.slice(at + 1)}`;
  const digits = value.replace(PHONE_NOISE, '');
  if (digits.length <= 4) return '****';
  return `${digits.slice(0, 3)}${'*'.repeat(digits.length - 5)}${digits.slice(-2)}`;
}
