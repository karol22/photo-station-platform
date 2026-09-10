import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';
import {
  PAID_CALL_FIELDS,
  PaidCallLedger,
  formatPaidCallLine,
  paidCallIdempotencyKey,
  parsePaidCallLine,
  validatePaidCallEntry,
  type PaidCallEntry,
} from './ledger';

const KEY = paidCallIdempotencyKey('ses_y', 'stylize', 'sha256:abc');
const ENTRY: PaidCallEntry = {
  id: 'call_01',
  ts: '2026-09-09T08:00:00Z',
  provider: 'ai:mock',
  operation: 'stylize',
  inputHash: 'sha256:abc',
  outputRef: 'var/station/mch_x/sessions/ses_y/ai/out.png',
  cost: { amount: 0, currency: 'USD' },
  idempotencyKey: KEY,
  trace: 'ops/traces/2026-09-09/abc',
};

function ledgerWith(existing?: string[]) {
  const lines: string[] = [];
  const ledger = new PaidCallLedger((line) => lines.push(line), existing);
  return { lines, ledger };
}

describe('PaidCallLedger', () => {
  it('record escribe una línea JSON con el orden de campos del README', () => {
    const { lines, ledger } = ledgerWith();
    expect(ledger.record(ENTRY)).toBe(true);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');
    expect(JSON.parse(lines[0]!)).toEqual(ENTRY);
    expect(Object.keys(JSON.parse(lines[0]!))).toEqual([...PAID_CALL_FIELDS]);
    expect(ledger.has(KEY)).toBe(true);
    expect(ledger.size).toBe(1);
  });

  it('un duplicado por idempotencyKey no se escribe', () => {
    const { lines, ledger } = ledgerWith();
    ledger.record(ENTRY);
    expect(ledger.record({ ...ENTRY, id: 'call_02', ts: '2026-09-09T09:00:00Z' })).toBe(false);
    expect(lines).toHaveLength(1);
    expect(ledger.record({ ...ENTRY, id: 'call_03', idempotencyKey: paidCallIdempotencyKey('ses_y', 'stylize', 'sha256:def') })).toBe(true);
    expect(lines).toHaveLength(2);
  });

  it('existing siembra las claves e ignora líneas en blanco', () => {
    const { lines, ledger } = ledgerWith([formatPaidCallLine(ENTRY), '', '   ']);
    expect(ledger.has(KEY)).toBe(true);
    expect(ledger.record(ENTRY)).toBe(false);
    expect(lines).toEqual([]);
  });

  it('una línea existente malformada lanza con su número de línea', () => {
    expect(() => ledgerWith([formatPaidCallLine(ENTRY), '{"id":'])).toThrow(/ledger line 2/);
    expect(() => ledgerWith(['{"id":"x"}'])).toThrow(ValidationError);
  });

  it('rechaza entradas inválidas sin escribir', () => {
    const { lines, ledger } = ledgerWith();
    expect(() => ledger.record({ ...ENTRY, cost: { amount: 0.5, currency: 'USD' } })).toThrow(ValidationError);
    expect(() => ledger.record({ ...ENTRY, ts: '2026-09-09T08:00:00' })).toThrow(ValidationError);
    expect(() => ledger.record({ ...ENTRY, idempotencyKey: '' })).toThrow(ValidationError);
    expect(() => ledger.record({ ...ENTRY, trace: 5 as unknown as string })).toThrow(ValidationError);
    expect(lines).toEqual([]);
  });
});

describe('formato y parseo', () => {
  it('formatPaidCallLine omite opcionales ausentes; parsePaidCallLine invierte', () => {
    const { outputRef: _o, trace: _t, ...minimal } = ENTRY;
    const line = formatPaidCallLine(minimal);
    expect(line).not.toContain('outputRef');
    expect(parsePaidCallLine(line)).toEqual(minimal);
    expect(parsePaidCallLine('   ')).toBeUndefined();
    expect(() => parsePaidCallLine('nope')).toThrow(ValidationError);
    expect(validatePaidCallEntry(JSON.parse(formatPaidCallLine(ENTRY)))).toEqual(ENTRY);
    expect(() => validatePaidCallEntry(null)).toThrow(ValidationError);
  });

  it('paidCallIdempotencyKey sigue la convención sessionId:operation:inputHash', () => {
    expect(KEY).toBe('ses_y:stylize:sha256:abc');
  });
});
