import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SHORT_CODE_ALPHABET, makeId, sha256Hex, shortCode, stableHash, stableStringify } from './ids';

const nodeSha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

describe('sha256 puro', () => {
  it('coincide con los vectores conocidos y con node:crypto', () => {
    expect(sha256Hex(new TextEncoder().encode(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const samples = ['hola', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'ñandú 🦤 ' + 'x'.repeat(200), JSON.stringify({ a: [1, 2, { b: null }] })];
    for (const sample of samples) expect(sha256Hex(new TextEncoder().encode(sample))).toBe(nodeSha(sample));
  });
});

describe('stableStringify', () => {
  it('ordena claves en todos los niveles y respeta la semántica de JSON', () => {
    const a = stableStringify({ z: 1, a: { d: [3, { y: 1, x: 2 }], c: undefined, b: 'x' } });
    const b = stableStringify({ a: { b: 'x', d: [3, { x: 2, y: 1 }] }, z: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"b":"x","d":[3,{"x":2,"y":1}]},"z":1}');
    expect(stableStringify([undefined, Number.NaN, () => 1])).toBe('[null,null,null]');
    expect(stableStringify(new Date('2026-09-09T00:00:00Z'))).toBe('"2026-09-09T00:00:00.000Z"');
    expect(stableStringify(undefined)).toBe('null');
  });

  it('stableHash es sha256 del JSON canónico', () => {
    expect(stableHash({ b: 1, a: 2 })).toBe(nodeSha('{"a":2,"b":1}'));
    expect(stableHash({ b: 1, a: 2 })).toBe(stableHash({ a: 2, b: 1 }));
  });
});

describe('makeId', () => {
  it('produce prefijo + 12 caracteres base36 y es determinista con random inyectado', () => {
    const id = makeId('mch', () => 'ABC-123');
    expect(id).toMatch(/^mch_[0-9a-z]{12}$/);
    expect(makeId('mch_', () => 'ABC-123')).toBe(id);
    expect(makeId('mch', () => 'otra')).not.toBe(id);
    expect(makeId('usr', () => 'abcdefghijklmnopqrstuvwxyz')).toBe('usr_abcdefghijkl');
  });

  it('sin random inyectado usa crypto y sigue el formato', () => {
    const a = makeId('ses');
    const b = makeId('ses');
    expect(a).toMatch(/^ses_[0-9a-z]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('shortCode', () => {
  it('es determinista, usa el alfabeto sin ambigüedad y respeta la longitud', () => {
    const code = shortCode('ses_1');
    expect(code).toHaveLength(6);
    expect(shortCode('ses_1')).toBe(code);
    expect(shortCode('ses_2')).not.toBe(code);
    for (const char of shortCode('semilla', 80)) expect(SHORT_CODE_ALPHABET).toContain(char);
    expect(shortCode('semilla', 80)).toHaveLength(80);
    expect(SHORT_CODE_ALPHABET).not.toMatch(/[01OI]/);
    expect(() => shortCode('x', 0)).toThrow();
  });
});
