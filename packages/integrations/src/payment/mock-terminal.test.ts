import { PaymentIntent as PaymentIntentSchema } from '@psp/contracts';
import type { PaymentIntent, PaymentState } from '@psp/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvalidTransitionError, NotFoundError, ValidationError } from '../errors';
import { manualClock, sequentialIdFactory } from '../support';
import { PAYMENT_STATE_MESSAGES } from './messages';
import { MockPaymentTerminal, type MockPaymentTerminalOptions } from './mock-terminal';

const START = '2026-09-09T08:00:00.000Z';
const INPUT = { sessionId: 'ses_1', amount: { amount: 8000, currency: 'MXN' }, timeoutSec: 90 };

function setup(opts: Partial<MockPaymentTerminalOptions> = {}) {
  const clock = manualClock(START);
  const terminal = new MockPaymentTerminal({ clock, idFactory: sequentialIdFactory('pay_'), ...opts });
  const seen: PaymentState[] = [];
  const updates: PaymentIntent[] = [];
  const unsubscribe = terminal.onUpdate((intent) => {
    seen.push(intent.state);
    updates.push(intent);
  });
  return { clock, terminal, seen, updates, unsubscribe };
}

describe('MockPaymentTerminal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('crea intents en awaiting con expiresAt = now + timeoutSec y forma válida', async () => {
    const { terminal } = setup();
    const intent = await terminal.createIntent(INPUT);
    expect(PaymentIntentSchema.safeParse(intent).success).toBe(true);
    expect(intent).toMatchObject({
      id: 'pay_000001',
      sessionId: 'ses_1',
      amount: { amount: 8000, currency: 'MXN' },
      state: 'awaiting',
      adapter: 'mock',
      createdAt: START,
      updatedAt: START,
      expiresAt: '2026-09-09T08:01:30.000Z',
    });
    expect(intent.message).toEqual(PAYMENT_STATE_MESSAGES.awaiting);
    expect(intent.ref).toBeUndefined();
    expect(terminal.status()).toBe('busy');
    expect(terminal.get(intent.id)).toEqual(intent);
    expect(terminal.list()).toHaveLength(1);
  });

  it('approve desde awaiting pasa por initiated y termina en approved con ref', async () => {
    const { terminal, seen, clock } = setup();
    const { id } = await terminal.createIntent(INPUT);
    clock.advance(5000);
    const approved = await terminal.simulate(id, 'approve');
    expect(approved.state).toBe('approved');
    expect(approved.ref).toBe('mock-auth-pay_000001');
    expect(approved.updatedAt).toBe('2026-09-09T08:00:05.000Z');
    expect(approved.message).toEqual(PAYMENT_STATE_MESSAGES.approved);
    expect(seen).toEqual(['awaiting', 'initiated', 'approved']);
    expect(terminal.status()).toBe('ready');
    expect(PaymentIntentSchema.safeParse(approved).success).toBe(true);
  });

  it('approve desde initiated no repite initiated', async () => {
    const { terminal, seen } = setup();
    const { id } = await terminal.createIntent(INPUT);
    await terminal.simulate(id, 'review');
    await terminal.simulate(id, 'approve');
    expect(seen).toEqual(['awaiting', 'under_review', 'approved']);
  });

  it('decline y cancel', async () => {
    const { terminal, seen } = setup();
    const a = await terminal.createIntent(INPUT);
    expect((await terminal.simulate(a.id, 'decline')).state).toBe('declined');
    const b = await terminal.createIntent({ ...INPUT, sessionId: 'ses_2' });
    expect((await terminal.simulate(b.id, 'cancel')).state).toBe('cancelled');
    expect(seen).toEqual(['awaiting', 'declined', 'awaiting', 'cancelled']);
    expect(terminal.status()).toBe('ready');
  });

  it('review → approve y review → decline', async () => {
    const { terminal } = setup();
    const a = await terminal.createIntent(INPUT);
    expect((await terminal.simulate(a.id, 'review')).state).toBe('under_review');
    expect((await terminal.simulate(a.id, 'approve')).state).toBe('approved');
    const b = await terminal.createIntent({ ...INPUT, sessionId: 'ses_2' });
    await terminal.simulate(b.id, 'review');
    expect((await terminal.simulate(b.id, 'decline')).state).toBe('declined');
  });

  it('expira por tick cuando pasa expiresAt', async () => {
    const { terminal, clock, seen } = setup();
    const { id } = await terminal.createIntent(INPUT);
    clock.advance(90_000 - 1);
    expect(terminal.tick()).toEqual([]);
    clock.advance(1);
    const changed = terminal.tick();
    expect(changed.map((i) => i.state)).toEqual(['expired']);
    expect(terminal.get(id)?.message).toEqual(PAYMENT_STATE_MESSAGES.expired);
    expect(seen).toEqual(['awaiting', 'expired']);
    expect(terminal.tick()).toEqual([]);
  });

  it('tick no expira un pago en revisión', async () => {
    const { terminal, clock } = setup();
    const { id } = await terminal.createIntent(INPUT);
    await terminal.simulate(id, 'review');
    clock.advance(100_000);
    expect(terminal.tick()).toEqual([]);
    expect(terminal.get(id)?.state).toBe('under_review');
  });

  it('simulate expire aplica el evento directamente', async () => {
    const { terminal } = setup();
    const { id } = await terminal.createIntent(INPUT);
    expect((await terminal.simulate(id, 'expire')).state).toBe('expired');
  });

  it('device_out → recover', async () => {
    const { terminal, seen } = setup();
    const { id } = await terminal.createIntent(INPUT);
    const out = await terminal.simulate(id, 'device_out');
    expect(out.state).toBe('device_out_of_service');
    expect(out.message).toEqual(PAYMENT_STATE_MESSAGES.device_out_of_service);
    expect(terminal.status()).toBe('out_of_service');
    const back = await terminal.simulate(id, 'recover');
    expect(back.state).toBe('awaiting');
    expect(terminal.status()).toBe('busy');
    expect(seen).toEqual(['awaiting', 'device_out_of_service', 'awaiting']);
  });

  it('setDeviceState propaga a los intents activos y createIntent con dispositivo caído nace fuera de servicio', async () => {
    const { terminal } = setup();
    const a = await terminal.createIntent(INPUT);
    terminal.setDeviceState('offline');
    expect(terminal.get(a.id)?.state).toBe('device_out_of_service');
    const b = await terminal.createIntent({ ...INPUT, sessionId: 'ses_2' });
    expect(b.state).toBe('device_out_of_service');
    expect(terminal.status()).toBe('offline');
    terminal.setDeviceState('ready');
    expect(terminal.get(a.id)?.state).toBe('awaiting');
    expect(terminal.get(b.id)?.state).toBe('awaiting');
    terminal.setDeviceState('busy');
    expect(terminal.status()).toBe('busy');
    expect(terminal.get(a.id)?.state).toBe('awaiting');
  });

  it('device_out y recover exigen que el intent pueda transitar', async () => {
    const { terminal } = setup();
    const { id } = await terminal.createIntent(INPUT);
    await terminal.simulate(id, 'approve');
    await expect(terminal.simulate(id, 'device_out')).rejects.toBeInstanceOf(InvalidTransitionError);
    await expect(terminal.simulate(id, 'recover')).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(terminal.status()).toBe('ready');
  });

  it('onUpdate recibe cada cambio y la baja deja de notificar', async () => {
    const { terminal, seen, updates, unsubscribe } = setup();
    const { id } = await terminal.createIntent(INPUT);
    await terminal.simulate(id, 'approve');
    expect(seen).toEqual(['awaiting', 'initiated', 'approved']);
    expect(updates.every((u) => u.id === id)).toBe(true);
    unsubscribe();
    const other = await terminal.createIntent({ ...INPUT, sessionId: 'ses_2' });
    await terminal.simulate(other.id, 'decline');
    expect(seen).toEqual(['awaiting', 'initiated', 'approved']);
  });

  it('autoOutcome approve con autoDelayMs usa timers (falsos en la prueba)', async () => {
    vi.useFakeTimers();
    const { terminal, seen } = setup({ autoOutcome: 'approve', autoDelayMs: 500 });
    const { id } = await terminal.createIntent(INPUT);
    expect(terminal.get(id)?.state).toBe('awaiting');
    vi.advanceTimersByTime(499);
    expect(terminal.get(id)?.state).toBe('awaiting');
    vi.advanceTimersByTime(1);
    expect(terminal.get(id)?.state).toBe('approved');
    expect(seen).toEqual(['awaiting', 'initiated', 'approved']);
    terminal.dispose();
  });

  it('autoOutcome decline con autoDelayMs', async () => {
    vi.useFakeTimers();
    const { terminal } = setup({ autoOutcome: 'decline', autoDelayMs: 200 });
    const { id } = await terminal.createIntent(INPUT);
    vi.advanceTimersByTime(200);
    expect(terminal.get(id)?.state).toBe('declined');
    terminal.dispose();
  });

  it('autoOutcome sin autoDelayMs se aplica en el siguiente tick, sin timers', async () => {
    const { terminal, seen } = setup({ autoOutcome: 'approve' });
    const { id } = await terminal.createIntent(INPUT);
    expect(terminal.get(id)?.state).toBe('awaiting');
    const changed = terminal.tick();
    expect(changed.map((i) => i.state)).toEqual(['approved']);
    expect(seen).toEqual(['awaiting', 'initiated', 'approved']);
  });

  it('tick con autoDelayMs respeta el reloj inyectado', async () => {
    const { terminal, clock } = setup({ autoOutcome: 'approve', autoDelayMs: 1000 });
    const { id } = await terminal.createIntent(INPUT);
    clock.advance(999);
    expect(terminal.tick()).toEqual([]);
    clock.advance(1);
    expect(terminal.tick().map((i) => i.state)).toEqual(['approved']);
    expect(terminal.get(id)?.state).toBe('approved');
    terminal.dispose();
  });

  it('un resultado manual o un dispositivo caído cancelan el resultado automático pendiente', async () => {
    vi.useFakeTimers();
    const { terminal } = setup({ autoOutcome: 'approve', autoDelayMs: 500 });
    const a = await terminal.createIntent(INPUT);
    await terminal.simulate(a.id, 'device_out');
    vi.advanceTimersByTime(500);
    expect(terminal.get(a.id)?.state).toBe('device_out_of_service');
    terminal.setDeviceState('ready');
    const b = await terminal.createIntent({ ...INPUT, sessionId: 'ses_2' });
    await terminal.simulate(b.id, 'decline');
    vi.advanceTimersByTime(500);
    expect(terminal.get(b.id)?.state).toBe('declined');
    terminal.dispose();
  });

  it('createIntent es idempotente por sesión mientras el intent sigue activo', async () => {
    const { terminal } = setup();
    const a = await terminal.createIntent(INPUT);
    const again = await terminal.createIntent(INPUT);
    expect(again.id).toBe(a.id);
    expect(terminal.list()).toHaveLength(1);
    await terminal.simulate(a.id, 'decline');
    const b = await terminal.createIntent(INPUT);
    expect(b.id).toBe('pay_000002');
    expect(b.state).toBe('awaiting');
  });

  it('retry vuelve a awaiting con vencimiento nuevo y sin ref', async () => {
    const { terminal, clock } = setup();
    const { id } = await terminal.createIntent(INPUT);
    await terminal.simulate(id, 'decline');
    clock.advance(60_000);
    const retried = await terminal.retry(id);
    expect(retried.state).toBe('awaiting');
    expect(retried.expiresAt).toBe('2026-09-09T08:02:30.000Z');
    expect(retried.ref).toBeUndefined();
    await expect(terminal.retry(id)).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('valida entradas', async () => {
    const { terminal } = setup();
    await expect(terminal.createIntent({ ...INPUT, amount: { amount: 0, currency: 'MXN' } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(terminal.createIntent({ ...INPUT, amount: { amount: 10.5, currency: 'MXN' } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(terminal.createIntent({ ...INPUT, amount: { amount: 100, currency: 'MX' } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(terminal.createIntent({ ...INPUT, timeoutSec: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(terminal.createIntent({ ...INPUT, sessionId: '' })).rejects.toBeInstanceOf(ValidationError);
    expect(terminal.list()).toHaveLength(0);
  });

  it('cancelar dos veces es idempotente; cancelar un pago aprobado lanza InvalidTransitionError', async () => {
    const { terminal, seen } = setup();
    const a = await terminal.createIntent(INPUT);
    await terminal.cancel(a.id);
    expect((await terminal.cancel(a.id)).state).toBe('cancelled');
    expect(seen).toEqual(['awaiting', 'cancelled']);
    const b = await terminal.createIntent(INPUT);
    await terminal.simulate(b.id, 'approve');
    await expect(terminal.cancel(b.id)).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(terminal.get(b.id)?.state).toBe('approved');
  });

  it('intent desconocido lanza NotFoundError', async () => {
    const { terminal } = setup();
    expect(terminal.get('pay_nope')).toBeUndefined();
    await expect(terminal.simulate('pay_nope', 'approve')).rejects.toBeInstanceOf(NotFoundError);
    await expect(terminal.cancel('pay_nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('dispose limpia timers y bloquea operaciones nuevas', async () => {
    vi.useFakeTimers();
    const { terminal, seen } = setup({ autoOutcome: 'approve', autoDelayMs: 500 });
    const { id } = await terminal.createIntent(INPUT);
    terminal.dispose();
    vi.advanceTimersByTime(1000);
    expect(terminal.get(id)?.state).toBe('awaiting');
    expect(seen).toEqual(['awaiting']);
    await expect(terminal.createIntent({ ...INPUT, sessionId: 'ses_2' })).rejects.toMatchObject({ code: 'disposed' });
  });

  it('initialStatus define el estado inicial del dispositivo', () => {
    const { terminal } = setup({ initialStatus: 'out_of_service' });
    expect(terminal.status()).toBe('out_of_service');
  });
});
