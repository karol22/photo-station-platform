import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex, stableHash, stableStringify, utf8Encode } from '../index';

const nodeSha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('sha256Hex', () => {
  it('coincide con los vectores conocidos', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('maneja los bordes de bloque (55, 56, 64 bytes) y mensajes largos', () => {
    expect(sha256Hex('a'.repeat(55))).toBe(
      '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318',
    );
    expect(sha256Hex('a'.repeat(56))).toBe(
      'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a',
    );
    expect(sha256Hex('a'.repeat(64))).toBe(
      'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb',
    );
    expect(sha256Hex('a'.repeat(1000))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    );
  });

  it('codifica UTF-8 igual que Node (latino, CJK, emoji)', () => {
    expect(sha256Hex('ñandú ÁÉÍÓÚ')).toBe(
      '01ea9ea8d4bab5a29db793a4fafd6d29c4de642a14740da5f2762a66f7daa756',
    );
    expect(sha256Hex('配置 🚀')).toBe(
      '52eadc128c33acb7c0d68c62aca8227dd47a9481096db198e1271b3b8364429e',
    );
    expect(Array.from(utf8Encode('€'))).toEqual([0xe2, 0x82, 0xac]);
    expect(Array.from(utf8Encode('🚀'))).toEqual([0xf0, 0x9f, 0x9a, 0x80]);
    expect(Array.from(utf8Encode('\ud800'))).toEqual([0xef, 0xbf, 0xbd]);
  });

  it('coincide con node:crypto para longitudes 0..300 y bytes crudos', () => {
    for (let n = 0; n <= 300; n++) {
      const text = 'x'.repeat(n);
      expect(sha256Hex(text), `longitud ${n}`).toBe(nodeSha256(text));
    }
    const bytes = Uint8Array.from([0, 1, 2, 255, 254, 128]);
    expect(sha256Hex(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
});

describe('stableStringify', () => {
  it('ordena claves en todos los niveles y conserva el orden de los arrays', () => {
    const a = { b: 1, a: { z: [3, 1, 2], y: 'x' } };
    const b = { a: { y: 'x', z: [3, 1, 2] }, b: 1 };
    expect(stableStringify(a)).toBe('{"a":{"y":"x","z":[3,1,2]},"b":1}');
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(stableStringify({ a: [1, 2] })).not.toBe(stableStringify({ a: [2, 1] }));
  });

  it('omite undefined en objetos y lo vuelve null en arrays, como JSON.stringify', () => {
    expect(stableStringify({ a: undefined, b: 1, c: () => 1 })).toBe('{"b":1}');
    expect(stableStringify([1, undefined, 2])).toBe('[1,null,2]');
    expect(stableStringify(undefined)).toBe('null');
    expect(stableStringify({ n: Number.NaN, i: Number.POSITIVE_INFINITY })).toBe(
      '{"i":null,"n":null}',
    );
  });

  it('respeta toJSON (fechas) y escapa cadenas', () => {
    expect(stableStringify({ at: new Date('2026-09-09T12:00:00Z') })).toBe(
      '{"at":"2026-09-09T12:00:00.000Z"}',
    );
    expect(stableStringify('a"b\n')).toBe(JSON.stringify('a"b\n'));
  });

  it('produce JSON válido equivalente al valor original', () => {
    const value = { z: [{ b: null, a: true }], y: 'ñ', x: 1.5, w: { deep: { k: 'v' } } };
    expect(JSON.parse(stableStringify(value))).toEqual(value);
  });

  it('rechaza estructuras circulares y bigint', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => stableStringify(circular)).toThrow(TypeError);
    expect(() => stableStringify({ big: 1n })).toThrow(TypeError);
  });
});

describe('stableHash', () => {
  it('es independiente del orden de claves y sensible a cualquier cambio de valor', () => {
    const base = stableHash({ values: { b: 2, a: 1 }, locks: {} });
    expect(stableHash({ locks: {}, values: { a: 1, b: 2 } })).toBe(base);
    expect(stableHash({ values: { a: 1, b: 3 }, locks: {} })).not.toBe(base);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
  });

  it('es sha256 de la serialización canónica', () => {
    expect(stableHash({ a: 'ñ' })).toBe(nodeSha256('{"a":"ñ"}'));
  });
});
