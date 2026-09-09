import { NotConfiguredPaymentTerminal } from './not-configured';

/** `payment.terminalAdapter = 'none'`: la máquina no tiene terminal y el pago nace `unavailable`. */
export class NoPaymentTerminal extends NotConfiguredPaymentTerminal {
  readonly adapter = 'none';
  readonly docs = 'packages/integrations/README.md';
  protected readonly integrationPath =
    "No payment adapter is selected: set payment.terminalAdapter to 'mock' for a controllable terminal, or to a real adapter once one exists.";
}
