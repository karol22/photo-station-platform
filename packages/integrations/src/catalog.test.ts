import { CatalogEntry as CatalogEntrySchema } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import * as api from './index';

describe('CATALOG', () => {
  it('cada entrada cumple el contrato y las claves son únicas', () => {
    for (const entry of CATALOG) {
      expect(CatalogEntrySchema.safeParse(entry).success, entry.key).toBe(true);
      expect(entry.package).toBe('@psp/integrations');
      expect(entry.docs).toBeDefined();
    }
    const keys = CATALOG.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('registra el paquete, los cinco puertos y cada adaptador con su estado', () => {
    expect(CATALOG.filter((e) => e.kind === 'package')).toHaveLength(1);
    const ports = CATALOG.filter((e) => e.kind === 'port').map((e) => e.name);
    expect(ports).toEqual(['PaymentTerminal', 'AiProvider', 'DeliveryChannel', 'FiscalProvider', 'CrmProvider']);
    const byKey = new Map(CATALOG.map((e) => [e.key, e]));
    for (const key of ['payment.mock', 'ai.mock', 'delivery.mock', 'fiscal.mock', 'crm.mock']) {
      expect(byKey.get(key)?.status, key).toBe('mock');
      expect(byKey.get(key)?.kind, key).toBe('adapter');
    }
    for (const key of ['payment.nayax', 'payment.mercadopago_qr', 'ai.external', 'delivery.coming_soon']) {
      expect(byKey.get(key)?.status, key).toBe('stub');
    }
    expect(byKey.get('payment.nayax')?.docs).toBe(api.NAYAX_DOCS);
    expect(byKey.get('payment.mercadopago_qr')?.docs).toBe(api.MERCADOPAGO_QR_DOCS);
    const portGroups = new Set(CATALOG.filter((e) => e.kind === 'port').map((e) => e.key.split('.')[0]));
    for (const adapter of CATALOG.filter((e) => e.kind === 'adapter')) {
      expect(portGroups.has(adapter.key.split('.')[0] ?? ''), adapter.key).toBe(true);
    }
  });
});

describe('superficie pública', () => {
  it('expone lo que fija docs/arquitectura/01-apis-de-paquetes.md', () => {
    const expected = [
      'nextPaymentState',
      'initialPaymentState',
      'MockPaymentTerminal',
      'NayaxTerminalStub',
      'MercadoPagoQrStub',
      'createPaymentTerminal',
      'MockAiProvider',
      'ExternalAiProviderStub',
      'MockDeliveryChannel',
      'MockFiscalProvider',
      'NotAvailableFiscalProvider',
      'MockCrmProvider',
      'SecretHandle',
      'resolveSecret',
      'PaidCallLedger',
      'CATALOG',
    ] as const;
    for (const name of expected) expect(api[name], name).toBeDefined();
    expect(api.CATALOG).toBe(CATALOG);
  });
});
