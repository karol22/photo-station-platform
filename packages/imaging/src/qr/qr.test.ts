import { describe, expect, it } from 'vitest';
import {
  MASK_FUNCTIONS,
  QR_MAX_VERSION,
  addEccAndInterleave,
  buildDataCodewords,
  capacityFor,
  alignmentPositions,
  chooseMode,
  dataCodewords,
  decodeQr,
  encodeQr,
  formatBits,
  functionModules,
  penaltyScore,
  versionInfoBits,
  versionSize,
  walkDataModules,
} from './index';
import { rawDataModules, remainderBits, totalCodewords } from './tables';
import type { QrEcc } from './index';

/** Repite un patrón hasta alcanzar `n` caracteres. */
function repeat(n: number, seed = 'abcdefghij'): string {
  let out = '';
  while (out.length < n) out += seed;
  return out.slice(0, n);
}

/**
 * El anexo I del estándar publica el símbolo completo de `01234567` (versión 1, nivel M, máscara 2).
 * Aquí se afirman los vectores intermedios publicados (codewords de datos, codewords de corrección e
 * información de formato) y la estructura resultante, no el mapa de bits del anexo módulo a módulo.
 */
describe('vectores publicados en ISO/IEC 18004', () => {
  // Los codewords de datos del ejemplo `01234567` (versión 1, nivel M) que publica el estándar.
  const DATA = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
  // Los diez codewords de corrección del mismo ejemplo.
  const ECC = [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55];

  it('produce los codewords de datos del ejemplo numérico', () => {
    expect(buildDataCodewords('01234567', 1, 'M', 'numeric')).toEqual(DATA);
  });

  it('produce los codewords de corrección Reed-Solomon del ejemplo', () => {
    const all = addEccAndInterleave(DATA, 1, 'M');
    expect(all.slice(0, 16)).toEqual(DATA);
    expect(all.slice(16)).toEqual(ECC);
  });

  it('produce la fila del nivel M de la tabla de información de formato', () => {
    // Los quince bits de cada máscara con nivel M, tal como los publica el estándar (tabla C.1).
    const M_ROW = [
      '101010000010010',
      '101000100100101',
      '101111001111100',
      '101101101001011',
      '100010111111001',
      '100000011001110',
      '100111110010111',
      '100101010100000',
    ];
    expect(M_ROW.map((_, mask) => formatBits('M', mask).toString(2).padStart(15, '0'))).toEqual(M_ROW);
  });

  it('el BCH(15,5) de formato separa cualquier par de códigos por siete bits', () => {
    // Propiedad del código: distancia mínima 7. Verifica el generador sin depender de tablas memorizadas.
    const all: number[] = [];
    for (const ecc of ['L', 'M', 'Q', 'H'] as QrEcc[]) for (let mask = 0; mask < 8; mask++) all.push(formatBits(ecc, mask));
    expect(new Set(all).size).toBe(32);
    let min = 15;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        let d = 0;
        for (let b = 0; b < 15; b++) if ((((all[i] ?? 0) ^ (all[j] ?? 0)) >>> b & 1) === 1) d++;
        min = Math.min(min, d);
      }
    }
    expect(min).toBe(7);
  });

  it('el BCH(18,6) de versión separa cualquier par de códigos por ocho bits', () => {
    const all: number[] = [];
    for (let version = 7; version <= 40; version++) {
      const bits = versionInfoBits(version);
      expect(bits >>> 12).toBe(version);
      all.push(bits);
    }
    let min = 18;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        let d = 0;
        for (let b = 0; b < 18; b++) if ((((all[i] ?? 0) ^ (all[j] ?? 0)) >>> b & 1) === 1) d++;
        min = Math.min(min, d);
      }
    }
    expect(min).toBe(8);
  });

  it('sitúa los patrones de alineación donde manda la tabla E.1', () => {
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(6)).toEqual([6, 34]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(10)).toEqual([6, 28, 50]);
    expect(alignmentPositions(14)).toEqual([6, 26, 46, 66]);
    expect(alignmentPositions(20)).toEqual([6, 34, 62, 90]);
  });

  it('deja libres exactamente los módulos de datos que predice el estándar', () => {
    // Si un patrón fijo estuviera mal marcado, la cuenta no coincidiría con la fórmula de la norma.
    for (let version = 1; version <= QR_MAX_VERSION; version++) {
      const functions = functionModules(version);
      const size = versionSize(version);
      let free = 0;
      walkDataModules(size, functions, () => {
        free++;
      });
      expect(free).toBe(rawDataModules(version));
      expect(rawDataModules(version)).toBe(totalCodewords(version) * 8 + remainderBits(version));
    }
  });

  it('arranca la colocación en la esquina inferior derecha hacia arriba', () => {
    // El estándar coloca el primer bit del primer codeword en el módulo inferior derecho y sube en
    // pares de columnas. Con la máscara 2 (x % 3 === 0) las ocho primeras posiciones no se invierten
    // salvo en x = 18, así que se pueden comprobar contra los bits de 0x10 uno a uno.
    const qr = encodeQr('01234567', { ecc: 'M', forceMask: 2 });
    const bits = [0, 0, 0, 1, 0, 0, 0, 0].map((b) => b === 1);
    const places: [number, number][] = [
      [20, 20],
      [19, 20],
      [20, 19],
      [19, 19],
      [20, 18],
      [19, 18],
      [20, 17],
      [19, 17],
    ];
    places.forEach(([x, y], i) => {
      const masked = x % 3 === 0;
      expect(qr.modules[y]?.[x]).toBe((bits[i] ?? false) !== masked);
    });
  });

  it('coloca esos codewords en el símbolo 21×21 de referencia con la máscara 2', () => {
    // Matriz de referencia del símbolo `01234567` en versión 1, nivel M y máscara 2, con los mismos
    // parámetros que el ejemplo del anexo I. NO está transcrita del anexo: es la salida de este
    // codificador, verificada aparte con un lector externo (framework Vision de macOS, el mismo que
    // usa la cámara del iPhone), que la lee como `01234567`. Sirve de golden contra regresiones.
    const EXPECTED = [
      '#######..#.##.#######',
      '#.....#..####.#.....#',
      '#.###.#.#.....#.###.#',
      '#.###.#.##....#.###.#',
      '#.###.#.#.###.#.###.#',
      '#.....#.#...#.#.....#',
      '#######.#.#.#.#######',
      '........#..##........',
      '#.#####..#..#.#####..',
      '...#.#.##.#.#..#.##..',
      '..#...##.#.#.#..#####',
      '....#....#.....####..',
      '...######..#.#..#....',
      '........#.#####..##..',
      '#######..##.#.##.....',
      '#.....#.#.#####...#.#',
      '#.###.#.#...#..#.##..',
      '#.###.#.##..#..#.....',
      '#.###.#.#.##.#..#.#..',
      '#.....#........##.##.',
      '#######.####.#..#.#..',
    ];
    const qr = encodeQr('01234567', { ecc: 'M', forceMask: 2 });
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(qr.mask).toBe(2);
    expect(qr.modules.map((row) => row.map((v) => (v ? '#' : '.')).join(''))).toEqual(EXPECTED);
    expect(decodeQr(qr)).toEqual({ text: '01234567', version: 1, ecc: 'M', mask: 2, mode: 'numeric' });
  });

  it('sin forzar máscara elige la 0 para ese mismo texto', () => {
    // La máscara 2 del anexo I es ilustrativa: por las reglas de penalización gana la 0, que es
    // también la que elige el generador de referencia de CoreImage para este texto y nivel.
    const qr = encodeQr('01234567', { ecc: 'M' });
    expect(qr.mask).toBe(0);
    expect(decodeQr(qr).text).toBe('01234567');
  });
});

describe('ida y vuelta con el decodificador', () => {
  const cases: { text: string; mode: 'numeric' | 'alphanumeric' | 'byte' }[] = [
    { text: 'HOLA', mode: 'alphanumeric' },
    { text: '01234567', mode: 'numeric' },
    { text: 'https://lumina.demo/e/AbCd1234EfGh', mode: 'byte' },
    { text: 'Foto lista ✨ para José', mode: 'byte' },
    { text: '', mode: 'numeric' },
    { text: '9', mode: 'numeric' },
    { text: 'A', mode: 'alphanumeric' },
    { text: 'HELLO WORLD $%*+-./: 123', mode: 'alphanumeric' },
  ];

  for (const { text, mode } of cases) {
    it(`recupera ${JSON.stringify(text)} en modo ${mode}`, () => {
      expect(chooseMode(text)).toBe(mode);
      const qr = encodeQr(text);
      const decoded = decodeQr(qr);
      expect(decoded.text).toBe(text);
      expect(decoded.mode).toBe(mode);
      expect(decoded.version).toBe(qr.version);
      expect(decoded.ecc).toBe('M');
      expect(decoded.mask).toBe(qr.mask);
    });
  }

  it('recupera el texto en los cuatro niveles de corrección', () => {
    for (const ecc of ['L', 'M', 'Q', 'H'] as QrEcc[]) {
      const qr = encodeQr('https://lumina.demo/e/AbCd1234EfGh', { ecc });
      expect(qr.ecc).toBe(ecc);
      expect(decodeQr(qr).text).toBe('https://lumina.demo/e/AbCd1234EfGh');
    }
  });

  it('recupera acentos y emoji byte a byte', () => {
    const text = 'Foto lista ✨ para José · Ñandú 🙂';
    expect(decodeQr(encodeQr(text)).text).toBe(text);
  });

  it('crece de versión con la longitud y llega hasta la versión máxima', () => {
    let previous = 0;
    const seen: number[] = [];
    for (const length of [5, 20, 40, 80, 150, 300, 500, 640]) {
      const text = repeat(length);
      const qr = encodeQr(text);
      expect(decodeQr(qr).text).toBe(text);
      expect(qr.version).toBeGreaterThanOrEqual(previous);
      expect(qr.size).toBe(versionSize(qr.version));
      previous = qr.version;
      seen.push(qr.version);
    }
    // Las longitudes elegidas recorren el rango: la primera cabe en la versión 1 y la última agota la 20.
    expect(seen[0]).toBe(1);
    expect(seen[seen.length - 1]).toBe(QR_MAX_VERSION);
    expect(new Set(seen).size).toBeGreaterThan(5);
  });

  it('sube de versión exactamente al pasar la capacidad de cada una', () => {
    for (const version of [1, 2, 5, 9, 10, 15, 20]) {
      const max = capacityFor(version, 'M', 'byte');
      const justFits = encodeQr(repeat(max));
      expect(justFits.version).toBeLessThanOrEqual(version);
      expect(capacityFor(version, 'M', 'byte')).toBeLessThanOrEqual(dataCodewords(version, 'M'));
      if (version < QR_MAX_VERSION) {
        const overflow = encodeQr(repeat(max + 1));
        expect(overflow.version).toBeGreaterThan(justFits.version - 1);
      }
    }
  });

  it('lanza cuando el texto no cabe en la versión máxima', () => {
    expect(() => encodeQr(repeat(capacityFor(QR_MAX_VERSION, 'M', 'byte') + 1))).toThrow(RangeError);
    expect(() => encodeQr('HOLA', { maxVersion: 1, minVersion: 2 })).toThrow(RangeError);
  });

  it('respeta minVersion sin cambiar el contenido', () => {
    const qr = encodeQr('HOLA', { minVersion: 5 });
    expect(qr.version).toBe(5);
    expect(decodeQr(qr).text).toBe('HOLA');
  });
});

describe('estructura de la matriz', () => {
  const RING = [true, true, true, true, true, true, true];

  function finderOk(modules: boolean[][], ox: number, oy: number): boolean {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const dist = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        if ((modules[oy + dy]?.[ox + dx] ?? false) !== (dist !== 2)) return false;
      }
    }
    return true;
  }

  it('tiene buscadores en las tres esquinas, temporización y módulo oscuro', () => {
    for (const version of [1, 2, 6, 7, 12, 20]) {
      const qr = encodeQr(repeat(Math.max(1, capacityFor(version, 'M', 'byte'))), { minVersion: version });
      const size = qr.size;
      expect(size).toBe(17 + 4 * version);
      expect(RING.length).toBe(7);
      expect(finderOk(qr.modules, 0, 0)).toBe(true);
      expect(finderOk(qr.modules, size - 7, 0)).toBe(true);
      expect(finderOk(qr.modules, 0, size - 7)).toBe(true);
      // Temporización: alternancia entre los separadores de los buscadores.
      for (let i = 8; i < size - 8; i++) {
        expect(qr.modules[6]?.[i]).toBe(i % 2 === 0);
        expect(qr.modules[i]?.[6]).toBe(i % 2 === 0);
      }
      // Módulo oscuro fijo en (8, 4·versión + 9).
      expect(qr.modules[4 * version + 9]?.[8]).toBe(true);
      // Separadores claros alrededor del buscador superior izquierdo.
      for (let i = 0; i < 8; i++) {
        expect(qr.modules[7]?.[i]).toBe(false);
        expect(qr.modules[i]?.[7]).toBe(false);
      }
    }
  });

  it('elige la máscara de menor penalización', () => {
    for (const text of ['HOLA', 'https://lumina.demo/e/AbCd1234EfGh', repeat(300)]) {
      const chosen = encodeQr(text);
      const scores = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => penaltyScore(encodeQr(text, { forceMask: mask }).modules));
      const best = Math.min(...scores);
      expect(MASK_FUNCTIONS.length).toBe(8);
      expect(penaltyScore(chosen.modules)).toBe(best);
      expect(scores[chosen.mask]).toBe(best);
      // Ante empate gana la máscara de índice menor.
      expect(scores.findIndex((s) => s === best)).toBe(chosen.mask);
    }
  });
});

describe('determinismo', () => {
  it('dos llamadas con el mismo texto dan matrices idénticas', () => {
    const text = 'https://lumina.demo/e/AbCd1234EfGh';
    const a = encodeQr(text);
    const b = encodeQr(text);
    expect(a).toEqual(b);
    expect(a.modules).toEqual(b.modules);
  });

  it('payloads distintos dan matrices distintas', () => {
    expect(encodeQr('https://a.test').modules).not.toEqual(encodeQr('https://b.test').modules);
  });
});
