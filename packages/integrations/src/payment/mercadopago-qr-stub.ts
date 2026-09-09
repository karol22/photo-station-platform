import { NotConfiguredPaymentTerminal } from './not-configured';

export const MERCADOPAGO_QR_DOCS = 'packages/integrations/docs/mercadopago-qr.md';

/** QR dinámico de Mercado Pago: plan documentado, sin integración. */
export class MercadoPagoQrStub extends NotConfiguredPaymentTerminal {
  readonly adapter = 'mercadopago_qr';
  readonly docs = MERCADOPAGO_QR_DOCS;
  protected readonly integrationPath =
    'Integration path: one dynamic QR per session created by the station agent, which polls the order status from the machine; the control plane receives webhooks for reconciliation. Requires a Mercado Pago merchant account and credentials resolved through resolveSecret.';
}
