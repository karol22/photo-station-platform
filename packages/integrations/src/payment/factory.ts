import { ValidationError } from '../errors';
import type { IntegrationDeps } from '../support';
import { MercadoPagoQrStub } from './mercadopago-qr-stub';
import { MockPaymentTerminal, type MockPaymentTerminalOptions } from './mock-terminal';
import { NayaxTerminalStub } from './nayax-stub';
import { NoPaymentTerminal } from './none-terminal';
import type { PaymentAdapterKey, PaymentTerminal } from './port';

export interface PaymentTerminalDeps extends IntegrationDeps {
  /** Opciones sólo para el adaptador `mock`. */
  mock?: Omit<MockPaymentTerminalOptions, 'clock' | 'idFactory'>;
}

/** Construye el terminal que indica `payment.terminalAdapter`. Agregar Nayax es registrar una clase aquí. */
export function createPaymentTerminal(adapter: PaymentAdapterKey, deps: PaymentTerminalDeps): PaymentTerminal {
  switch (adapter) {
    case 'mock':
      return new MockPaymentTerminal({ clock: deps.clock, idFactory: deps.idFactory, ...deps.mock });
    case 'nayax':
      return new NayaxTerminalStub();
    case 'mercadopago_qr':
      return new MercadoPagoQrStub();
    case 'none':
      return new NoPaymentTerminal();
    default:
      throw new ValidationError(`Unknown payment adapter: ${String(adapter)}`);
  }
}
