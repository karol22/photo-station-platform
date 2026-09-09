import { describe, expect, it } from 'vitest';
import { MockCrmProvider } from './crm/mock-provider';
import { ValidationError } from './errors';
import { MockFiscalProvider, NotAvailableFiscalProvider } from './fiscal/providers';
import { manualClock, sequentialIdFactory } from './support';

const START = '2026-09-09T08:00:00.000Z';

describe('FiscalProvider', () => {
  it('mock emite simulated con referencia y conserva lo emitido', async () => {
    const provider = new MockFiscalProvider({ clock: manualClock(START), idFactory: sequentialIdFactory('fis_') });
    const input = { sessionId: 'ses_1', amount: { amount: 8000, currency: 'MXN' }, concept: 'Foto infantil' };
    const result = await provider.issue(input);
    expect(result).toEqual({ state: 'simulated', ref: 'fiscal-sim-fis_000001' });
    expect(provider.issued).toEqual([{ ref: 'fiscal-sim-fis_000001', at: START, input }]);
    await expect(provider.issue({ ...input, amount: { amount: 10.5, currency: 'MXN' } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(provider.issue({ ...input, sessionId: '' })).rejects.toBeInstanceOf(ValidationError);
    expect(provider.provider).toBe('mock');
  });

  it('not_available responde sin referencia', async () => {
    const provider = new NotAvailableFiscalProvider();
    expect(await provider.issue({ sessionId: 'ses_1', amount: { amount: 1, currency: 'MXN' }, concept: 'x' })).toEqual({
      state: 'not_available',
    });
    expect(provider.provider).toBe('none');
  });
});

describe('MockCrmProvider', () => {
  it('acumula eventos, deduplica por idempotencyKey y copia el evento', async () => {
    const crm = new MockCrmProvider();
    const event = { type: 'session_completed', at: START, sessionId: 'ses_1', idempotencyKey: 'ses_1:completed' };
    await crm.track(event);
    await crm.track({ ...event });
    await crm.track({ type: 'print_completed', at: START, sessionId: 'ses_1', properties: { copies: 2 } });
    expect(crm.events).toHaveLength(2);
    expect(crm.events[0]).toEqual(event);
    expect(crm.events[0]).not.toBe(event);
    await expect(crm.track({ type: '', at: START })).rejects.toBeInstanceOf(ValidationError);
    crm.clear();
    expect(crm.events).toEqual([]);
    await crm.track(event);
    expect(crm.events).toHaveLength(1);
  });
});
