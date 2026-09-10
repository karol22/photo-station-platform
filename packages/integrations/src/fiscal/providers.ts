import { Money as MoneySchema } from '@psp/contracts';
import { ValidationError } from '../errors';
import type { Clock, IdFactory, IntegrationDeps } from '../support';
import { toTimestamp } from '../support';
import type { FiscalIssueInput, FiscalIssueResult, FiscalIssuedRecord, FiscalProvider } from './port';

/** Emite comprobantes simulados y los conserva en memoria para inspección. */
export class MockFiscalProvider implements FiscalProvider {
  readonly provider = 'mock';
  readonly issued: FiscalIssuedRecord[] = [];

  readonly #clock: Clock;
  readonly #ids: IdFactory;

  constructor(opts: IntegrationDeps) {
    this.#clock = opts.clock;
    this.#ids = opts.idFactory;
  }

  async issue(input: FiscalIssueInput): Promise<FiscalIssueResult> {
    if (!input.sessionId) throw new ValidationError('sessionId is required');
    if (!MoneySchema.safeParse(input.amount).success) throw new ValidationError('amount must be a valid Money');
    const ref = `fiscal-sim-${this.#ids()}`;
    this.issued.push({ ref, at: toTimestamp(this.#clock()), input: { ...input } });
    return { state: 'simulated', ref };
  }
}

/** Sin proveedor fiscal: toda emisión responde `not_available`. */
export class NotAvailableFiscalProvider implements FiscalProvider {
  readonly provider = 'none';

  async issue(_input: FiscalIssueInput): Promise<FiscalIssueResult> {
    return { state: 'not_available' };
  }
}
