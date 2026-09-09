/**
 * @psp/integrations — puertos y adaptadores mock para pagos, IA, entrega digital, fiscal y CRM.
 * Ningún proveedor real: los adaptadores reales son stubs documentados que lanzan `NotConfiguredError`.
 */

// soporte
export type { Clock, IdFactory, IntegrationDeps, ManualClock } from './support';
export { manualClock, sequentialIdFactory, toTimestamp } from './support';
export type {
  DeliveryChannelKey,
  DeliveryRequestRecord,
  DeliveryState,
  PaymentOutcome,
  PaymentTerminalStatus,
} from './types';
export { DELIVERY_CHANNELS, DELIVERY_STATES, PAYMENT_OUTCOMES, PAYMENT_TERMINAL_STATUSES } from './types';

// errores
export {
  IntegrationError,
  InvalidTransitionError,
  NotConfiguredError,
  NotFoundError,
  ValidationError,
} from './errors';

// pagos
export type { InitialPaymentInput, PaymentEvent } from './payment/state-machine';
export {
  ACTIVE_PAYMENT_STATES,
  PAYMENT_EVENTS,
  PAYMENT_TRANSITIONS,
  SETTLED_PAYMENT_STATES,
  TERMINAL_PAYMENT_STATES,
  canTransitionPayment,
  initialPaymentState,
  isActivePaymentState,
  isTerminalPaymentState,
  nextPaymentState,
  paymentAllowsProgress,
} from './payment/state-machine';
export { PAYMENT_STATE_MESSAGES, paymentMessage } from './payment/messages';
export type { PaymentAdapterKey, PaymentIntentInput, PaymentTerminal } from './payment/port';
export { PAYMENT_ADAPTERS, isPaymentAdapterKey } from './payment/port';
export type { AutoOutcome, MockPaymentTerminalOptions } from './payment/mock-terminal';
export { MockPaymentTerminal } from './payment/mock-terminal';
export { NotConfiguredPaymentTerminal } from './payment/not-configured';
export { NAYAX_DOCS, NayaxTerminalStub } from './payment/nayax-stub';
export { MERCADOPAGO_QR_DOCS, MercadoPagoQrStub } from './payment/mercadopago-qr-stub';
export { NoPaymentTerminal } from './payment/none-terminal';
export type { PaymentTerminalDeps } from './payment/factory';
export { createPaymentTerminal } from './payment/factory';

// IA
export type { AiAdapterKey, AiProvider, AiSubmitInput, AiTransform } from './ai/port';
export { AI_ADAPTERS, ALL_AI_EXPERIENCES, consentAllowsExternalAi } from './ai/port';
export { AI_JOB_STATE_MESSAGES, aiJobMessage } from './ai/messages';
export type { MockAiProviderOptions } from './ai/mock-provider';
export { DEFAULT_MOCK_AI_CAPABILITIES, MockAiProvider } from './ai/mock-provider';
export type { ExternalAiProviderStubOptions } from './ai/external-stub';
export { ExternalAiProviderStub } from './ai/external-stub';
export type { AiProviderDeps } from './ai/factory';
export { createAiProvider, identityTransform } from './ai/factory';

// entrega digital
export type { DeliveryAdapterKey, DeliveryChannel, DeliverySendInput } from './delivery/port';
export { DELIVERY_ADAPTERS } from './delivery/port';
export type { DestinationCheck, DestinationFailureReason } from './delivery/destination';
export { maskDestination, validateDestination } from './delivery/destination';
export type {
  DeliveryFailureReason,
  MockDeliveryChannelOptions,
  MockDeliveryRequest,
} from './delivery/mock-channel';
export { MockDeliveryChannel } from './delivery/mock-channel';
export type { DeliveryStubOptions } from './delivery/stubs';
export { ComingSoonDeliveryChannel, NotAvailableDeliveryChannel } from './delivery/stubs';
export { createDeliveryChannel } from './delivery/factory';

// fiscal
export type { FiscalIssueInput, FiscalIssueResult, FiscalIssuedRecord, FiscalProvider } from './fiscal/port';
export { MockFiscalProvider, NotAvailableFiscalProvider } from './fiscal/providers';

// CRM
export type { CrmEvent, CrmProvider } from './crm/port';
export { MockCrmProvider } from './crm/mock-provider';

// secretos y libro mayor
export type { SecretSources } from './secrets';
export { SECRETS_FILE, SecretHandle, parseSecretsFile, resolveSecret } from './secrets';
export type { PaidCallEntry } from './ledger';
export {
  PAID_CALL_FIELDS,
  PaidCallLedger,
  formatPaidCallLine,
  paidCallIdempotencyKey,
  parsePaidCallLine,
  validatePaidCallEntry,
} from './ledger';

// catálogo
export { CATALOG } from './catalog';
