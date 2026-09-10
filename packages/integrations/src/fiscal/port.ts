import type { Id, Money, Timestamp } from '@psp/contracts';

export interface FiscalIssueInput {
  sessionId: Id;
  amount: Money;
  /** Concepto de la venta (nombre del producto). */
  concept: string;
  /** Datos del receptor cuando el cliente los proporciona; el mock no los valida. */
  customer?: { name?: string; taxId?: string; email?: string };
}

export interface FiscalIssueResult {
  state: 'not_available' | 'simulated';
  ref?: string;
}

export interface FiscalIssuedRecord {
  ref: string;
  at: Timestamp;
  input: FiscalIssueInput;
}

/** Puerto de facturación fiscal (requisito 47). Sólo representable en esta fase. */
export interface FiscalProvider {
  readonly provider: string;
  issue(input: FiscalIssueInput): Promise<FiscalIssueResult>;
}
