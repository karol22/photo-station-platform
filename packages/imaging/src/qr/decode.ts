/**
 * Decodificador mínimo de matrices QR, para pruebas y diagnóstico.
 * Asume una matriz íntegra: lee la información de formato, deshace la máscara, des-intercala los
 * bloques y descarta los codewords de corrección sin verificarlos ni corregir errores.
 * No sustituye a un lector real: no localiza el símbolo en una imagen ni tolera daños.
 */

import {
  ALPHANUMERIC_CHARSET,
  blockLayout,
  charCountBits,
  eccFromFormatBits,
  modeFromIndicator,
  versionFromSize,
} from './tables';
import type { QrEcc, QrMode } from './tables';
import { MASK_FUNCTIONS, formatBits, functionModules, walkDataModules } from './encode';
import type { QrCode } from './encode';

/** Resultado de leer una matriz: texto y parámetros recuperados del propio símbolo. */
export interface QrDecoded {
  text: string;
  version: number;
  ecc: QrEcc;
  mask: number;
  mode: QrMode;
}

function moduleAt(modules: readonly (readonly boolean[])[], x: number, y: number): boolean {
  return modules[y]?.[x] ?? false;
}

/** Lee los 15 bits de formato de la primera ubicación y devuelve nivel y máscara. */
export function readFormatInfo(modules: readonly (readonly boolean[])[]): { ecc: QrEcc; mask: number } {
  const bits: boolean[] = [];
  for (let i = 0; i <= 5; i++) bits[i] = moduleAt(modules, 8, i);
  bits[6] = moduleAt(modules, 8, 7);
  bits[7] = moduleAt(modules, 8, 8);
  bits[8] = moduleAt(modules, 7, 8);
  for (let i = 9; i < 15; i++) bits[i] = moduleAt(modules, 14 - i, 8);
  let value = 0;
  for (let i = 0; i < 15; i++) if (bits[i] === true) value |= 1 << i;
  const unmasked = (value ^ 0x5412) >>> 10;
  const ecc = eccFromFormatBits((unmasked >>> 3) & 3);
  const mask = unmasked & 7;
  // La matriz se asume íntegra: si el BCH no cuadra, la entrada no es un símbolo válido.
  if (formatBits(ecc, mask) !== value) throw new Error('información de formato inconsistente');
  return { ecc, mask };
}

/** Lee los codewords en el orden de la espiral en zigzag, deshaciendo la máscara. */
export function readCodewords(modules: readonly (readonly boolean[])[], version: number, mask: number): number[] {
  const size = modules.length;
  const functions = functionModules(version);
  const fn = MASK_FUNCTIONS[mask];
  if (fn === undefined) throw new RangeError(`máscara inválida: ${mask}`);
  const bits: boolean[] = [];
  walkDataModules(size, functions, (x, y) => {
    bits.push(moduleAt(modules, x, y) !== fn(x, y));
  });
  const out: number[] = [];
  const bytes = Math.floor(bits.length / 8);
  for (let i = 0; i < bytes; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i * 8 + j] === true ? 1 : 0);
    out.push(byte);
  }
  return out;
}

/** Deshace el intercalado y devuelve sólo los codewords de datos, en orden de bloques. */
export function deinterleave(codewords: readonly number[], version: number, ecc: QrEcc): number[] {
  const layout = blockLayout(version, ecc);
  const blocks: number[][] = Array.from({ length: layout.blocks }, () => []);
  let k = 0;
  for (let i = 0; i < layout.interleavedBlockLen; i++) {
    for (let j = 0; j < layout.blocks; j++) {
      if (i === layout.shortDataLen && j < layout.shortBlocks) continue;
      const block = blocks[j];
      if (block !== undefined) block[i] = codewords[k] ?? 0;
      k++;
    }
  }
  const data: number[] = [];
  for (let j = 0; j < layout.blocks; j++) {
    const len = layout.shortDataLen + (j < layout.shortBlocks ? 0 : 1);
    const block = blocks[j] ?? [];
    for (let i = 0; i < len; i++) data.push(block[i] ?? 0);
  }
  return data;
}

class BitReader {
  private pos = 0;

  constructor(private readonly bytes: readonly number[]) {}

  get remaining(): number {
    return this.bytes.length * 8 - this.pos;
  }

  read(width: number): number {
    if (width > this.remaining) throw new Error('flujo de bits agotado');
    let value = 0;
    for (let i = 0; i < width; i++) {
      const byte = this.bytes[(this.pos + i) >>> 3] ?? 0;
      value = (value << 1) | ((byte >>> (7 - ((this.pos + i) & 7))) & 1);
    }
    this.pos += width;
    return value;
  }
}

/** Texto de una secuencia de bytes UTF-8, sin depender de `TextDecoder`. */
export function utf8Decode(bytes: readonly number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i] ?? 0;
    let cp = b0;
    let extra = 0;
    if (b0 >= 0xf0) {
      cp = b0 & 0x07;
      extra = 3;
    } else if (b0 >= 0xe0) {
      cp = b0 & 0x0f;
      extra = 2;
    } else if (b0 >= 0xc0) {
      cp = b0 & 0x1f;
      extra = 1;
    }
    for (let j = 1; j <= extra; j++) cp = (cp << 6) | ((bytes[i + j] ?? 0) & 0x3f);
    out += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return out;
}

function readSegments(data: readonly number[], version: number): { text: string; mode: QrMode } {
  const reader = new BitReader(data);
  let text = '';
  let firstMode: QrMode | undefined;
  while (reader.remaining >= 4) {
    const indicator = reader.read(4);
    if (indicator === 0) break;
    const mode = modeFromIndicator(indicator);
    if (mode === undefined) throw new Error(`modo no soportado: ${indicator}`);
    firstMode ??= mode;
    const count = reader.read(charCountBits(mode, version));
    if (mode === 'numeric') {
      let left = count;
      while (left >= 3) {
        text += String(reader.read(10)).padStart(3, '0');
        left -= 3;
      }
      if (left === 2) text += String(reader.read(7)).padStart(2, '0');
      else if (left === 1) text += String(reader.read(4));
    } else if (mode === 'alphanumeric') {
      let left = count;
      while (left >= 2) {
        const pair = reader.read(11);
        text += (ALPHANUMERIC_CHARSET[Math.floor(pair / 45)] ?? '') + (ALPHANUMERIC_CHARSET[pair % 45] ?? '');
        left -= 2;
      }
      if (left === 1) text += ALPHANUMERIC_CHARSET[reader.read(6)] ?? '';
    } else {
      const bytes: number[] = [];
      for (let i = 0; i < count; i++) bytes.push(reader.read(8));
      text += utf8Decode(bytes);
    }
  }
  return { text, mode: firstMode ?? 'byte' };
}

/**
 * Lee una matriz QR íntegra y reconstruye el texto.
 * Acepta el `QrCode` que devuelve `encodeQr` o una matriz `boolean[][]` cuadrada.
 */
export function decodeQr(input: QrCode | boolean[][]): QrDecoded {
  const modules = Array.isArray(input) ? input : input.modules;
  const size = modules.length;
  if (size === 0 || (modules[0]?.length ?? 0) !== size) throw new Error('la matriz no es cuadrada');
  const version = versionFromSize(size);
  const { ecc, mask } = readFormatInfo(modules);
  const codewords = readCodewords(modules, version, mask);
  const data = deinterleave(codewords, version, ecc);
  const { text, mode } = readSegments(data, version);
  return { text, version, ecc, mask, mode };
}
