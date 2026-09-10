/**
 * Enlace efímero de cliente (ADR-011): lógica pura de estados, rotación y caducidad.
 * El cliente nunca escribe una contraseña ni crea una cuenta; el enlace vive dentro de la sesión
 * y muere con ella. Sin reloj propio: todo instante entra como parámetro.
 */
import type { CustomerHandoff, HandoffMethod, HandoffPurpose, HandoffState } from '@psp/contracts';
import { shortCode, stableHash } from './ids';

/** Transiciones válidas del enlace. Lo que no está aquí no ocurre. */
export const HANDOFF_TRANSITIONS: Record<HandoffState, HandoffState[]> = {
  unavailable: ['offered'],
  coming_soon: ['offered'],
  offered: ['pending', 'linked', 'expired', 'cancelled', 'failed'],
  pending: ['linked', 'expired', 'cancelled', 'failed'],
  linked: [],
  expired: [],
  cancelled: [],
  failed: ['offered'],
};

/** Estados en los que el enlace ya no cambia y puede borrarse con la sesión. */
export const HANDOFF_TERMINAL: HandoffState[] = ['linked', 'expired', 'cancelled'];

export function canHandoffTransition(from: HandoffState, to: HandoffState): boolean {
  return (HANDOFF_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Elige el método a ofrecer: el primero de la preferencia configurada que la máquina soporte.
 * `scan_qr` necesita cámara; `nfc_tap` necesita lector sin contacto. Si nada aplica, `none`.
 */
export function selectHandoffMethod(input: {
  preferred: string[];
  requested?: HandoffMethod | undefined;
  hasCamera: boolean;
  hasNfc: boolean;
}): HandoffMethod {
  const supports = (m: string): m is HandoffMethod => {
    if (m === 'display_qr' || m === 'short_code') return true;
    if (m === 'scan_qr') return input.hasCamera;
    if (m === 'nfc_tap') return input.hasNfc;
    return false;
  };
  if (input.requested && supports(input.requested)) return input.requested;
  for (const m of input.preferred) if (supports(m)) return m;
  return 'none';
}

/** Token opaco de un solo uso, derivado de la sesión, el propósito y el turno de rotación. */
export function handoffToken(sessionId: string, purpose: HandoffPurpose, rotation: number, salt: string): string {
  return stableHash(`handoff:${sessionId}:${purpose}:${rotation}:${salt}`).slice(0, 32);
}

/** Código corto legible que el cliente teclea en su propio teléfono, nunca en la cabina. */
export function handoffCode(token: string): string {
  return shortCode(token, 6);
}

export interface HandoffPolicy {
  ttlSec: number;
  rotateSec: number;
  baseUrl: string;
}

/** Crea el enlace inicial en estado `offered`, ya con token, URL y caducidades calculadas. */
export function createHandoff(input: {
  id: string;
  sessionId: string;
  method: HandoffMethod;
  purpose: HandoffPurpose;
  policy: HandoffPolicy;
  now: Date;
  salt: string;
}): CustomerHandoff {
  const { id, sessionId, method, purpose, policy, now, salt } = input;
  const token = handoffToken(sessionId, purpose, 0, salt);
  const showsToken = method === 'display_qr' || method === 'short_code';
  return {
    id,
    sessionId,
    method,
    purpose,
    state: method === 'none' ? 'unavailable' : 'offered',
    ...(showsToken ? { token, url: handoffUrl(policy.baseUrl, token), code: handoffCode(token) } : {}),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(showsToken ? { rotatesAt: new Date(now.getTime() + policy.rotateSec * 1000).toISOString() } : {}),
    expiresAt: new Date(now.getTime() + policy.ttlSec * 1000).toISOString(),
  };
}

export function handoffUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${token}`;
}

/**
 * Avanza el reloj del enlace: caduca si venció y regenera el token si tocó rotación.
 * Devuelve el mismo objeto cuando nada cambia, para que quien llame sepa si debe notificar.
 */
export function tickHandoff(handoff: CustomerHandoff, now: Date, policy: HandoffPolicy, salt: string): CustomerHandoff {
  if (HANDOFF_TERMINAL.includes(handoff.state)) return handoff;
  const t = now.getTime();
  if (t >= Date.parse(handoff.expiresAt)) {
    return { ...handoff, state: 'expired', token: undefined, url: undefined, code: undefined, rotatesAt: undefined, updatedAt: now.toISOString() };
  }
  if (handoff.rotatesAt && t >= Date.parse(handoff.rotatesAt) && handoff.state === 'offered') {
    const rotation = Math.floor((t - Date.parse(handoff.createdAt)) / (policy.rotateSec * 1000));
    const token = handoffToken(handoff.sessionId, handoff.purpose, rotation, salt);
    return {
      ...handoff,
      token,
      url: handoffUrl(policy.baseUrl, token),
      code: handoffCode(token),
      rotatesAt: new Date(t + policy.rotateSec * 1000).toISOString(),
      updatedAt: now.toISOString(),
    };
  }
  return handoff;
}

/** Aplica un resultado del lado del cliente. `reference` es opaca: nunca datos personales. */
export function resolveHandoff(
  handoff: CustomerHandoff,
  outcome: 'scan' | 'link' | 'expire' | 'cancel' | 'fail',
  now: Date,
  reference?: string,
): CustomerHandoff {
  const to: HandoffState =
    outcome === 'scan' ? 'pending' : outcome === 'link' ? 'linked' : outcome === 'expire' ? 'expired' : outcome === 'cancel' ? 'cancelled' : 'failed';
  if (!canHandoffTransition(handoff.state, to)) return handoff;
  const cleared = to === 'linked' || to === 'expired' || to === 'cancelled';
  return {
    ...handoff,
    state: to,
    ...(reference !== undefined ? { reference } : {}),
    // Un solo uso: al consumirse o morir, el token deja de existir.
    ...(cleared ? { token: undefined, url: undefined, code: undefined, rotatesAt: undefined } : {}),
    updatedAt: now.toISOString(),
  };
}
