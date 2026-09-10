import { describe, expect, it } from 'vitest';
import { NotConfiguredError, ValidationError } from '../errors';
import { manualClock, sequentialIdFactory } from '../support';
import { createPaymentTerminal } from './factory';
import { MERCADOPAGO_QR_DOCS, MercadoPagoQrStub } from './mercadopago-qr-stub';
import { MockPaymentTerminal } from './mock-terminal';
import { NAYAX_DOCS, NayaxTerminalStub } from './nayax-stub';
import { NoPaymentTerminal } from './none-terminal';
import type { PaymentTerminal } from './port';
import { PAYMENT_ADAPTERS, isPaymentAdapterKey } from './port';

const INPUT = { sessionId: 'ses_1', amount: { amount: 8000, currency: 'MXN' }, timeoutSec: 90 };

const STUBS: Array<[string, () => PaymentTerminal, string]> = [
  ['nayax', () => new NayaxTerminalStub(), 'docs/nayax.md'],
  ['mercadopago_qr', () => new MercadoPagoQrStub(), 'docs/mercadopago-qr.md'],
  ['none', () => new NoPaymentTerminal(), 'README.md'],
];

describe.each(STUBS)('stub %s', (adapter, make, doc) => {
  it('status es not_configured y las consultas son seguras', () => {
    const terminal = make();
    expect(terminal.adapter).toBe(adapter);
    expect(terminal.status()).toBe('not_configured');
    expect(terminal.get('pay_1')).toBeUndefined();
    const unsubscribe = terminal.onUpdate(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  it('createIntent, cancel y simulate rechazan con NotConfiguredError que menciona el documento', async () => {
    const terminal = make();
    await expect(terminal.createIntent(INPUT)).rejects.toBeInstanceOf(NotConfiguredError);
    await expect(terminal.createIntent(INPUT)).rejects.toThrow(doc);
    await expect(terminal.cancel('pay_1')).rejects.toThrow(doc);
    await expect(terminal.simulate('pay_1', 'approve')).rejects.toThrow(doc);
    const error = (await terminal.createIntent(INPUT).catch((e: unknown) => e)) as NotConfiguredError;
    expect(error).toMatchObject({ code: 'not_configured', adapter, name: 'NotConfiguredError' });
    expect(error.docs).toContain(doc);
    expect(error.message).toContain(adapter);
  });

  it('setDeviceState lanza NotConfiguredError', () => {
    expect(() => make().setDeviceState('ready')).toThrow(NotConfiguredError);
  });
});

describe('stubs: rutas de documentación', () => {
  it('apuntan a los documentos del paquete', () => {
    expect(NAYAX_DOCS).toBe('packages/integrations/docs/nayax.md');
    expect(MERCADOPAGO_QR_DOCS).toBe('packages/integrations/docs/mercadopago-qr.md');
    expect(new NayaxTerminalStub().docs).toBe(NAYAX_DOCS);
    expect(new MercadoPagoQrStub().docs).toBe(MERCADOPAGO_QR_DOCS);
  });
});

describe('createPaymentTerminal', () => {
  const deps = { clock: manualClock('2026-09-09T08:00:00Z'), idFactory: sequentialIdFactory('pay_') };

  it('devuelve la clase de cada adaptador', () => {
    expect(createPaymentTerminal('mock', deps)).toBeInstanceOf(MockPaymentTerminal);
    expect(createPaymentTerminal('nayax', deps)).toBeInstanceOf(NayaxTerminalStub);
    expect(createPaymentTerminal('mercadopago_qr', deps)).toBeInstanceOf(MercadoPagoQrStub);
    expect(createPaymentTerminal('none', deps)).toBeInstanceOf(NoPaymentTerminal);
    expect(createPaymentTerminal('none', deps).status()).toBe('not_configured');
  });

  it('pasa las opciones del mock', async () => {
    const terminal = createPaymentTerminal('mock', { ...deps, mock: { autoOutcome: 'approve' } });
    const intent = await terminal.createIntent(INPUT);
    expect(intent.state).toBe('awaiting');
    (terminal as MockPaymentTerminal).tick();
    expect(terminal.get(intent.id)?.state).toBe('approved');
  });

  it('rechaza adaptadores desconocidos', () => {
    expect(() => createPaymentTerminal('stripe' as never, deps)).toThrow(ValidationError);
  });

  it('isPaymentAdapterKey reconoce la lista cerrada', () => {
    for (const key of PAYMENT_ADAPTERS) expect(isPaymentAdapterKey(key)).toBe(true);
    expect(isPaymentAdapterKey('stripe')).toBe(false);
    expect(isPaymentAdapterKey(undefined)).toBe(false);
  });
});
