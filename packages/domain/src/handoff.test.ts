import { describe, expect, it } from 'vitest';
import { CustomerHandoff } from '@psp/contracts';
import {
  canHandoffTransition,
  createHandoff,
  handoffCode,
  handoffToken,
  resolveHandoff,
  selectHandoffMethod,
  tickHandoff,
  type HandoffPolicy,
} from './handoff';

const POLICY: HandoffPolicy = { ttlSec: 180, rotateSec: 30, baseUrl: 'https://psp.local/e' };
const NOW = new Date('2026-09-09T12:00:00Z');
const SALT = 'mch_demo_doc_01';

const make = (method: Parameters<typeof createHandoff>[0]['method'] = 'display_qr') =>
  createHandoff({ id: 'hnd_1', sessionId: 'ses_1', method, purpose: 'delivery', policy: POLICY, now: NOW, salt: SALT });

describe('enlace efímero: creación', () => {
  it('nace ofrecido, con token, URL y código, y valida contra el contrato', () => {
    const h = make();
    expect(CustomerHandoff.safeParse(h).success).toBe(true);
    expect(h.state).toBe('offered');
    expect(h.url).toContain('https://psp.local/e/');
    expect(h.code).toHaveLength(6);
    expect(h.expiresAt).toBe('2026-09-09T12:03:00.000Z');
    expect(h.rotatesAt).toBe('2026-09-09T12:00:30.000Z');
  });

  it('el método sin pantalla no expone token', () => {
    const h = make('scan_qr');
    expect(h.token).toBeUndefined();
    expect(h.url).toBeUndefined();
  });

  it('el código corto no usa caracteres ambiguos', () => {
    expect(handoffCode(handoffToken('ses_1', 'delivery', 0, SALT))).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe('enlace efímero: elección de método', () => {
  it('respeta la preferencia configurada', () => {
    expect(selectHandoffMethod({ preferred: ['display_qr', 'short_code'], hasCamera: true, hasNfc: false })).toBe('display_qr');
  });

  it('salta los métodos que la máquina no soporta', () => {
    expect(selectHandoffMethod({ preferred: ['nfc_tap', 'scan_qr'], hasCamera: true, hasNfc: false })).toBe('scan_qr');
    expect(selectHandoffMethod({ preferred: ['nfc_tap'], hasCamera: false, hasNfc: false })).toBe('none');
  });

  it('un método pedido que no se soporta cae a la preferencia', () => {
    expect(selectHandoffMethod({ preferred: ['short_code'], requested: 'nfc_tap', hasCamera: false, hasNfc: false })).toBe('short_code');
  });
});

describe('enlace efímero: rotación y caducidad', () => {
  it('regenera el token al cumplirse la rotación', () => {
    const h = make();
    const rotated = tickHandoff(h, new Date('2026-09-09T12:00:31Z'), POLICY, SALT);
    expect(rotated.token).not.toBe(h.token);
    expect(rotated.url).not.toBe(h.url);
    expect(rotated.rotatesAt).toBe('2026-09-09T12:01:01.000Z');
  });

  it('no cambia nada antes de la rotación', () => {
    const h = make();
    expect(tickHandoff(h, new Date('2026-09-09T12:00:10Z'), POLICY, SALT)).toBe(h);
  });

  it('caduca y borra el token al vencer', () => {
    const h = make();
    const dead = tickHandoff(h, new Date('2026-09-09T12:03:01Z'), POLICY, SALT);
    expect(dead.state).toBe('expired');
    expect(dead.token).toBeUndefined();
    expect(dead.url).toBeUndefined();
  });

  it('un enlace terminal ya no se toca', () => {
    const linked = resolveHandoff(make(), 'link', NOW, 'ref_opaca');
    expect(tickHandoff(linked, new Date('2026-09-09T13:00:00Z'), POLICY, SALT)).toBe(linked);
  });
});

describe('enlace efímero: resolución', () => {
  it('escanear deja pendiente y enlazar consume el token', () => {
    const scanned = resolveHandoff(make(), 'scan', NOW);
    expect(scanned.state).toBe('pending');
    const linked = resolveHandoff(scanned, 'link', NOW, 'cupon_123');
    expect(linked.state).toBe('linked');
    expect(linked.reference).toBe('cupon_123');
    expect(linked.token).toBeUndefined();
  });

  it('un enlace ya consumido no se reusa', () => {
    const linked = resolveHandoff(make(), 'link', NOW);
    expect(resolveHandoff(linked, 'link', NOW).state).toBe('linked');
    expect(canHandoffTransition('linked', 'offered')).toBe(false);
  });

  it('el fallo permite reintentar', () => {
    const failed = resolveHandoff(make(), 'fail', NOW);
    expect(failed.state).toBe('failed');
    expect(canHandoffTransition('failed', 'offered')).toBe(true);
  });

  it('nunca guarda datos personales: la referencia es la que se le pase, opaca', () => {
    const linked = resolveHandoff(make(), 'link', NOW, 'opaque_ref');
    expect(JSON.stringify(linked)).not.toMatch(/@|\+\d{7,}/);
  });
});
