import { describe, expect, it } from 'vitest';
import { auditDiff } from './audit';

describe('auditDiff', () => {
  it('devuelve sólo las claves de primer nivel que cambian', () => {
    const before = { name: 'A', price: { amount: 1, currency: 'MXN' }, tags: ['x'], removed: true };
    const after = { name: 'A', price: { amount: 2, currency: 'MXN' }, tags: ['x'], added: 1 };
    expect(auditDiff(before, after)).toEqual({
      before: { price: { amount: 1, currency: 'MXN' }, removed: true },
      after: { price: { amount: 2, currency: 'MXN' }, added: 1 },
    });
    expect(auditDiff({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toEqual({ before: {}, after: {} });
  });

  it('con valores no objeto devuelve ambos si difieren', () => {
    expect(auditDiff('a', 'b')).toEqual({ before: 'a', after: 'b' });
    expect(auditDiff(1, 1)).toEqual({ before: undefined, after: undefined });
    expect(auditDiff(undefined, { a: 1 })).toEqual({ before: undefined, after: { a: 1 } });
  });
});
