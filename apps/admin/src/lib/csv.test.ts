import { describe, expect, it } from 'vitest';
import { csvToObjects, objectsToCsv, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('separa por comas y saltos de línea', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });
  it('respeta comillas, comas internas y comillas escapadas', () => {
    expect(parseCsv('name,note\r\n"Alpha, Inc","dice ""hola"""\r\n')).toEqual([
      ['name', 'note'],
      ['Alpha, Inc', 'dice "hola"'],
    ]);
  });
  it('acepta saltos de línea dentro de comillas y BOM inicial', () => {
    expect(parseCsv('﻿a,b\n"x\ny",z')).toEqual([
      ['a', 'b'],
      ['x\ny', 'z'],
    ]);
  });
  it('conserva campos vacíos', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });
});

describe('csvToObjects', () => {
  it('usa la primera fila como encabezados', () => {
    const result = csvToObjects('code,name\nm1,Alpha\nm2,Beta');
    expect(result.headers).toEqual(['code', 'name']);
    expect(result.rows).toEqual([
      { code: 'm1', name: 'Alpha' },
      { code: 'm2', name: 'Beta' },
    ]);
  });
});

describe('toCsv', () => {
  it('escapa comas, comillas y saltos', () => {
    expect(toCsv([['a,b', 'c"d', 'e\nf'], [1, null, undefined]])).toBe('"a,b","c""d","e\nf"\r\n1,,');
  });
  it('objectsToCsv es inverso de csvToObjects', () => {
    const csv = objectsToCsv([{ code: 'm1', name: 'Alpha, Inc' }], ['code', 'name']);
    expect(csvToObjects(csv).rows).toEqual([{ code: 'm1', name: 'Alpha, Inc' }]);
  });
});
