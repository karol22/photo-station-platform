import { describe, expect, it } from 'vitest';
import { changedTopLevelKeys, diffPatch, getPath, setPath } from './paths';

describe('paths', () => {
  it('lee rutas anidadas y devuelve undefined si faltan', () => {
    expect(getPath({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
    expect(getPath({ a: 1 }, 'a.b')).toBeUndefined();
    expect(getPath(null, 'a')).toBeUndefined();
  });
  it('escribe sin mutar el original', () => {
    const original = { a: { b: 1 }, x: 2 };
    const next = setPath(original, 'a.c', 3);
    expect(next).toEqual({ a: { b: 1, c: 3 }, x: 2 });
    expect(original).toEqual({ a: { b: 1 }, x: 2 });
    expect(setPath({ a: { b: 1 } }, 'a.b', undefined)).toEqual({ a: {} });
  });
  it('detecta claves cambiadas de primer nivel', () => {
    expect(changedTopLevelKeys({ a: 1, b: { x: 1 } }, { a: 1, b: { x: 2 } })).toEqual(['b']);
    expect(diffPatch({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })).toEqual({ b: 3, c: 4 });
    expect(diffPatch({ a: 1 }, {})).toEqual({ a: null });
  });
});
