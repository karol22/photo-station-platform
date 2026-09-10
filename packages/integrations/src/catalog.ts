import type { CatalogEntry } from '@psp/contracts';
import { MERCADOPAGO_QR_DOCS } from './payment/mercadopago-qr-stub';
import { NAYAX_DOCS } from './payment/nayax-stub';

const PACKAGE = '@psp/integrations';
const README = 'packages/integrations/README.md';

const entry = (item: Omit<CatalogEntry, 'package'>): CatalogEntry => ({ package: PACKAGE, ...item });

/** Capacidades registrables de este paquete: lo que no está aquí no existe (`pnpm catalog`). */
export const CATALOG: CatalogEntry[] = [
  entry({
    kind: 'package',
    key: 'integrations',
    name: PACKAGE,
    description: 'Puertos y adaptadores mock para pagos, IA, entrega digital, fiscal y CRM. Ningún proveedor real.',
    status: 'stable',
    docs: README,
  }),

  // pagos
  entry({
    kind: 'port',
    key: 'payment.terminal',
    name: 'PaymentTerminal',
    description: 'Puerto de terminal de pago: intents, estados, simulación y estado del dispositivo.',
    status: 'stable',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'payment.mock',
    name: 'MockPaymentTerminal',
    description: 'Terminal simulado y controlable desde panel técnico, admin y CLI; resultado automático opcional.',
    status: 'mock',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'payment.none',
    name: 'NoPaymentTerminal',
    description: 'Sin terminal: estado not_configured; el pago de la sesión nace unavailable.',
    status: 'stable',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'payment.nayax',
    name: 'NayaxTerminalStub',
    description: 'Lector cashless Nayax: plan de integración documentado; lanza NotConfiguredError.',
    status: 'stub',
    docs: NAYAX_DOCS,
  }),
  entry({
    kind: 'adapter',
    key: 'payment.mercadopago_qr',
    name: 'MercadoPagoQrStub',
    description: 'QR dinámico de Mercado Pago: plan de integración documentado; lanza NotConfiguredError.',
    status: 'stub',
    docs: MERCADOPAGO_QR_DOCS,
  }),

  // IA
  entry({
    kind: 'port',
    key: 'ai.provider',
    name: 'AiProvider',
    description: 'Puerto de proveedor de IA: capacidades, jobs con consentimiento y estados representables.',
    status: 'stable',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'ai.mock',
    name: 'MockAiProvider',
    description: 'Transformación local inyectada; exige consentimiento external_future; fallas simulables.',
    status: 'mock',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'ai.external',
    name: 'ExternalAiProviderStub',
    description: 'Proveedor externo futuro: todo job nace en coming_soon.',
    status: 'stub',
    docs: README,
  }),

  // entrega digital
  entry({
    kind: 'port',
    key: 'delivery.channel',
    name: 'DeliveryChannel',
    description: 'Puerto de entrega digital por WhatsApp, SMS o correo.',
    status: 'stable',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'delivery.mock',
    name: 'MockDeliveryChannel',
    description: 'Valida el destino, encola y marca sent_simulated en tick; nada sale de la máquina.',
    status: 'mock',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'delivery.coming_soon',
    name: 'ComingSoonDeliveryChannel',
    description: 'Canal anunciado sin proveedor: cada petición nace en coming_soon.',
    status: 'stub',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'delivery.none',
    name: 'NotAvailableDeliveryChannel',
    description: 'Canal no disponible: cada petición nace en not_available.',
    status: 'stable',
    docs: README,
  }),

  // fiscal
  entry({
    kind: 'port',
    key: 'fiscal.provider',
    name: 'FiscalProvider',
    description: 'Puerto de facturación fiscal: emisión con resultado simulated o not_available.',
    status: 'stable',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'fiscal.mock',
    name: 'MockFiscalProvider',
    description: 'Emite comprobantes simulados y los conserva en memoria.',
    status: 'mock',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'fiscal.none',
    name: 'NotAvailableFiscalProvider',
    description: 'Sin proveedor fiscal: toda emisión responde not_available.',
    status: 'stable',
    docs: README,
  }),

  // CRM
  entry({
    kind: 'port',
    key: 'crm.provider',
    name: 'CrmProvider',
    description: 'Puerto de CRM externo: eventos de negocio sin fotografías ni datos sensibles.',
    status: 'stable',
    docs: README,
  }),
  entry({
    kind: 'adapter',
    key: 'crm.mock',
    name: 'MockCrmProvider',
    description: 'Acumula eventos en memoria con deduplicación por idempotencyKey.',
    status: 'mock',
    docs: README,
  }),
];
