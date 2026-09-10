import type { Id, PaymentIntent } from '@psp/contracts';
import { NotConfiguredError } from '../errors';
import type { PaymentOutcome, PaymentTerminalStatus } from '../types';
import type { PaymentIntentInput, PaymentTerminal } from './port';

/**
 * Base de los adaptadores reales que aún no existen. Las consultas (`status`, `get`, `onUpdate`)
 * son seguras para que el agente arranque con cualquier adaptador; toda operación sobre el
 * dispositivo lanza `NotConfiguredError` con el documento del plan de integración.
 */
export abstract class NotConfiguredPaymentTerminal implements PaymentTerminal {
  abstract readonly adapter: string;
  /** Ruta del documento que describe el plan de integración. */
  abstract readonly docs: string;
  /** Resumen del camino de integración; forma parte del mensaje de error. */
  protected abstract readonly integrationPath: string;

  status(): PaymentTerminalStatus {
    return 'not_configured';
  }

  get(_intentId: Id): PaymentIntent | undefined {
    return undefined;
  }

  onUpdate(_cb: (intent: PaymentIntent) => void): () => void {
    return () => {};
  }

  async createIntent(_input: PaymentIntentInput): Promise<PaymentIntent> {
    throw this.notConfigured('createIntent');
  }

  async cancel(_intentId: Id): Promise<PaymentIntent> {
    throw this.notConfigured('cancel');
  }

  async simulate(_intentId: Id, _outcome: PaymentOutcome): Promise<PaymentIntent> {
    throw this.notConfigured('simulate');
  }

  setDeviceState(_state: PaymentTerminalStatus): void {
    throw this.notConfigured('setDeviceState');
  }

  protected notConfigured(operation: string): NotConfiguredError {
    return new NotConfiguredError(
      this.adapter,
      `Payment adapter '${this.adapter}' is not configured: ${operation} is unavailable. ${this.integrationPath} See ${this.docs}.`,
      this.docs,
    );
  }
}
