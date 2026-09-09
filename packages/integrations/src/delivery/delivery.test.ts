import { DeliveryRequestRecord as DeliveryRequestRecordSchema } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors';
import { manualClock, sequentialIdFactory } from '../support';
import type { DeliveryState } from '../types';
import { DELIVERY_CHANNELS } from '../types';
import { maskDestination, validateDestination } from './destination';
import { createDeliveryChannel } from './factory';
import { MockDeliveryChannel } from './mock-channel';
import { ComingSoonDeliveryChannel, NotAvailableDeliveryChannel } from './stubs';

const START = '2026-09-09T08:00:00.000Z';
const deps = () => ({ clock: manualClock(START), idFactory: sequentialIdFactory('dlv_') });

describe('validateDestination', () => {
  it('teléfonos: E.164 aproximado con separadores tolerados', () => {
    expect(validateDestination('whatsapp', '+52 (55) 1234-5678')).toEqual({ ok: true, normalized: '+525512345678' });
    expect(validateDestination('sms', '+14155552671')).toEqual({ ok: true, normalized: '+14155552671' });
    expect(validateDestination('sms', '5512345678')).toEqual({ ok: false, reason: 'invalid_phone' });
    expect(validateDestination('whatsapp', '+0123456789')).toEqual({ ok: false, reason: 'invalid_phone' });
    expect(validateDestination('whatsapp', '+52 abc')).toEqual({ ok: false, reason: 'invalid_phone' });
    expect(validateDestination('whatsapp', '   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('correos: formato mínimo, normalizado a minúsculas', () => {
    expect(validateDestination('email', ' Ana@Example.com ')).toEqual({ ok: true, normalized: 'ana@example.com' });
    expect(validateDestination('email', 'ana@')).toEqual({ ok: false, reason: 'invalid_email' });
    expect(validateDestination('email', 'ana@example')).toEqual({ ok: false, reason: 'invalid_email' });
    expect(validateDestination('email', '')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('maskDestination', () => {
  it('oculta la mayor parte del destino', () => {
    expect(maskDestination('+525512345678')).toBe('+52********78');
    expect(maskDestination('ana@example.com')).toBe('a***@example.com');
    expect(maskDestination('123')).toBe('****');
  });
});

describe('MockDeliveryChannel', () => {
  it('destino inválido → failed con razón, sin guardar el destino en claro', async () => {
    const channel = new MockDeliveryChannel({ ...deps(), channel: 'whatsapp' });
    const request = await channel.send({ sessionId: 'ses_1', destination: '5512345678', imageRef: 'var/x.png' });
    expect(request).toMatchObject({ id: 'dlv_000001', channel: 'whatsapp', state: 'failed', reason: 'invalid_phone' });
    expect(JSON.stringify(request)).not.toContain('5512345678');
    expect(channel.tick()).toEqual([]);
    expect(channel.get(request.id)?.state).toBe('failed');
    expect(DeliveryRequestRecordSchema.safeParse(request).success).toBe(true);
  });

  it('destino válido → queued → sent_simulated en tick, con notificaciones', async () => {
    const { clock, idFactory } = deps();
    const channel = new MockDeliveryChannel({ clock, idFactory, channel: 'email' });
    const seen: DeliveryState[] = [];
    const unsubscribe = channel.onUpdate((r) => seen.push(r.state));
    const request = await channel.send({ sessionId: 'ses_1', destination: 'ana@example.com', imageRef: 'var/x.png' });
    expect(request).toMatchObject({ state: 'queued', destinationMasked: 'a***@example.com', imageRef: 'var/x.png', createdAt: START });
    clock.advance(1500);
    const changed = channel.tick();
    expect(changed.map((r) => r.state)).toEqual(['sent_simulated']);
    expect(channel.get(request.id)).toMatchObject({ state: 'sent_simulated', updatedAt: '2026-09-09T08:00:01.500Z' });
    expect(channel.tick()).toEqual([]);
    expect(seen).toEqual(['queued', 'sent_simulated']);
    unsubscribe();
    expect(channel.list()).toHaveLength(1);
    expect(DeliveryRequestRecordSchema.safeParse(channel.get(request.id)).success).toBe(true);
  });

  it('sin imagen → failed missing_image', async () => {
    const channel = new MockDeliveryChannel({ ...deps(), channel: 'sms' });
    const request = await channel.send({ sessionId: 'ses_1', destination: '+525512345678', imageRef: '' });
    expect(request).toMatchObject({ state: 'failed', reason: 'missing_image' });
  });
});

describe('stubs y fábrica', () => {
  it('coming_soon y not_available devuelven registros válidos con estado fijo', async () => {
    const soon = new ComingSoonDeliveryChannel({ ...deps(), channel: 'whatsapp' });
    const none = new NotAvailableDeliveryChannel({ ...deps(), channel: 'sms' });
    const input = { sessionId: 'ses_1', destination: '+525512345678', imageRef: 'var/x.png' };
    const a = await soon.send(input);
    const b = await none.send(input);
    expect(a).toMatchObject({ id: 'dlv_000001', channel: 'whatsapp', state: 'coming_soon', createdAt: START });
    expect(b).toMatchObject({ channel: 'sms', state: 'not_available' });
    expect(DeliveryRequestRecordSchema.safeParse(a).success).toBe(true);
    expect(DeliveryRequestRecordSchema.safeParse(b).success).toBe(true);
  });

  it('createDeliveryChannel construye cada adaptador para cada canal', () => {
    for (const channel of DELIVERY_CHANNELS) {
      expect(createDeliveryChannel('mock', channel, deps())).toBeInstanceOf(MockDeliveryChannel);
      expect(createDeliveryChannel('coming_soon', channel, deps())).toBeInstanceOf(ComingSoonDeliveryChannel);
      expect(createDeliveryChannel('none', channel, deps()).channel).toBe(channel);
    }
    expect(() => createDeliveryChannel('twilio' as never, 'sms', deps())).toThrow(ValidationError);
  });
});
