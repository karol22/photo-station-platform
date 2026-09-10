import {
  DeliveryRequestRecord as DeliveryRequestRecordSchema,
  DeliveryState as DeliveryStateSchema,
  PaymentTerminalStatus as PaymentTerminalStatusSchema,
  SimulatePaymentRequest as SimulatePaymentRequestSchema,
} from '@psp/contracts';

/*
 * `@psp/contracts` exporta estos esquemas sin alias de tipo. Se derivan aquí a partir de
 * `parse` para no depender de `zod` de forma directa (no es dependencia de este paquete).
 */
export type PaymentTerminalStatus = ReturnType<typeof PaymentTerminalStatusSchema.parse>;
export type PaymentOutcome = ReturnType<typeof SimulatePaymentRequestSchema.parse>['outcome'];
export type DeliveryRequestRecord = ReturnType<typeof DeliveryRequestRecordSchema.parse>;
export type DeliveryState = ReturnType<typeof DeliveryStateSchema.parse>;
export type DeliveryChannelKey = DeliveryRequestRecord['channel'];

/** Listas cerradas tomadas del contrato, para iterar en UI y pruebas. */
export const PAYMENT_TERMINAL_STATUSES: readonly PaymentTerminalStatus[] = PaymentTerminalStatusSchema.options;
export const PAYMENT_OUTCOMES: readonly PaymentOutcome[] = SimulatePaymentRequestSchema.shape.outcome.options;
export const DELIVERY_CHANNELS: readonly DeliveryChannelKey[] = DeliveryRequestRecordSchema.shape.channel.options;
export const DELIVERY_STATES: readonly DeliveryState[] = DeliveryStateSchema.options;
