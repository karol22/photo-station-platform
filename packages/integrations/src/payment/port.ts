import type { Id, Money, PaymentIntent } from '@psp/contracts';
import type { PaymentOutcome, PaymentTerminalStatus } from '../types';

export { NotConfiguredError } from '../errors';

export interface PaymentIntentInput {
  sessionId: Id;
  amount: Money;
  /** Segundos hasta que el intent vence (`payment.timeoutSec`). */
  timeoutSec: number;
}

/**
 * Puerto de terminal de pago (ADR-006). El agente de estación programa contra esta interfaz;
 * el kiosco nunca la ve: recibe `PaymentIntent` por `/station/v1` y SSE.
 */
export interface PaymentTerminal {
  readonly adapter: string;
  status(): PaymentTerminalStatus;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntent>;
  cancel(intentId: Id): Promise<PaymentIntent>;
  get(intentId: Id): PaymentIntent | undefined;
  /** Notifica cada cambio de un intent. Devuelve la función para darse de baja. */
  onUpdate(cb: (intent: PaymentIntent) => void): () => void;
  /** Fuerza un resultado desde el panel técnico, administración o CLI. */
  simulate(intentId: Id, outcome: PaymentOutcome): Promise<PaymentIntent>;
  setDeviceState(state: PaymentTerminalStatus): void;
}

/** Valores de `payment.terminalAdapter` en contracts. */
export type PaymentAdapterKey = 'none' | 'mock' | 'nayax' | 'mercadopago_qr';

export const PAYMENT_ADAPTERS: readonly PaymentAdapterKey[] = ['none', 'mock', 'nayax', 'mercadopago_qr'];

export function isPaymentAdapterKey(value: unknown): value is PaymentAdapterKey {
  return typeof value === 'string' && (PAYMENT_ADAPTERS as readonly string[]).includes(value);
}
