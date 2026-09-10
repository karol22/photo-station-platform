import { NotConfiguredPaymentTerminal } from './not-configured';

export const NAYAX_DOCS = 'packages/integrations/docs/nayax.md';

/** Lector cashless Nayax: plan documentado, sin integración. */
export class NayaxTerminalStub extends NotConfiguredPaymentTerminal {
  readonly adapter = 'nayax';
  readonly docs = NAYAX_DOCS;
  protected readonly integrationPath =
    'Integration paths under evaluation: (a) the station agent drives the reader over USB/serial with a vending-style protocol, or (b) the control plane uses the Nayax cloud API for telemetry and reconciliation. Requires a Nayax account, a provisioned terminal and the protocol documentation.';
}
