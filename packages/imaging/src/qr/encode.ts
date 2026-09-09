/**
 * Codificador de códigos QR conforme a ISO/IEC 18004, escrito a mano en TypeScript puro.
 * No usa DOM ni APIs de Node: el mismo texto siempre produce la misma matriz.
 */

import { rsDivisor, rsRemainder } from './gf';
import {
  ALPHANUMERIC_CHARSET,
  MODE_INDICATOR,
  QR_MAX_VERSION,
  QR_MIN_VERSION,
  alignmentPositions,
  blockLayout,
  charCountBits,
  dataCodewords,
  eccFormatBits,
  versionSize,
} from './tables';
import type { QrEcc, QrMode } from './tables';

/** Símbolo QR resuelto: matriz de módulos en `modules[y][x]` (`true` = oscuro). */
export interface QrCode {
  modules: boolean[][];
  size: number;
  version: number;
  ecc: QrEcc;
  mask: number;
}

export interface EncodeQrOptions {
  /** Nivel de corrección; por omisión `M`. */
  ecc?: QrEcc;
  /** Versión mínima a considerar (por omisión 1). */
  minVersion?: number;
  /** Versión máxima a considerar (por omisión 20). */
  maxVersion?: number;
  /**
   * Fuerza una máscara concreta (0..7) en vez de elegir la de menor penalización.
   * Existe sólo para pruebas y diagnóstico: en producción se omite.
   */
  forceMask?: number;
}

/** Cantidad de máscaras del estándar. */
export const QR_MASK_COUNT = 8;

/** Bytes UTF-8 de un texto, sin depender de `TextEncoder`. Itera por punto de código. */
export function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}

function isNumeric(text: string): boolean {
  if (text.length === 0) return true;
  for (const ch of text) if (ch < '0' || ch > '9') return false;
  return true;
}

function isAlphanumeric(text: string): boolean {
  for (const ch of text) if (!ALPHANUMERIC_CHARSET.includes(ch)) return false;
  return true;
}

/** Modo más compacto que sirve para el texto completo. Un solo segmento basta para los payloads del kiosco. */
export function chooseMode(text: string): QrMode {
  if (isNumeric(text)) return 'numeric';
  if (isAlphanumeric(text)) return 'alphanumeric';
  return 'byte';
}

/** Bits que ocupa el contenido del segmento (sin indicador de modo ni contador). */
function payloadBits(mode: QrMode, text: string, bytes: readonly number[]): number {
  if (mode === 'numeric') {
    const n = text.length;
    return 10 * Math.floor(n / 3) + [0, 4, 7][n % 3]!;
  }
  if (mode === 'alphanumeric') {
    const n = text.length;
    return 11 * Math.floor(n / 2) + (n % 2) * 6;
  }
  return bytes.length * 8;
}

/** Cantidad de caracteres que declara el contador del segmento. */
function charCount(mode: QrMode, text: string, bytes: readonly number[]): number {
  return mode === 'byte' ? bytes.length : [...text].length;
}

class BitBuffer {
  private readonly bits: number[] = [];

  get length(): number {
    return this.bits.length;
  }

  append(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }

  /** Empaqueta en codewords de 8 bits; la longitud ya debe ser múltiplo de 8. */
  toCodewords(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | (this.bits[i + j] ?? 0);
      out.push(byte);
    }
    return out;
  }
}

function appendSegment(buf: BitBuffer, mode: QrMode, version: number, text: string, bytes: readonly number[]): void {
  buf.append(MODE_INDICATOR[mode], 4);
  buf.append(charCount(mode, text, bytes), charCountBits(mode, version));
  if (mode === 'numeric') {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      buf.append(Number.parseInt(chunk, 10), chunk.length * 3 + 1);
    }
    return;
  }
  if (mode === 'alphanumeric') {
    const chars = [...text];
    for (let i = 0; i + 1 < chars.length; i += 2) {
      buf.append(ALPHANUMERIC_CHARSET.indexOf(chars[i]!) * 45 + ALPHANUMERIC_CHARSET.indexOf(chars[i + 1]!), 11);
    }
    if (chars.length % 2 === 1) buf.append(ALPHANUMERIC_CHARSET.indexOf(chars[chars.length - 1]!), 6);
    return;
  }
  for (const b of bytes) buf.append(b, 8);
}

/** Codewords de datos ya con terminador, relleno a byte y bytes de relleno 0xEC/0x11. */
export function buildDataCodewords(text: string, version: number, ecc: QrEcc, mode: QrMode): number[] {
  const bytes = mode === 'byte' ? utf8Bytes(text) : [];
  const capacityBits = dataCodewords(version, ecc) * 8;
  const buf = new BitBuffer();
  appendSegment(buf, mode, version, text, bytes);
  if (buf.length > capacityBits) throw new RangeError(`el texto no cabe en la versión ${version}-${ecc}`);
  buf.append(0, Math.min(4, capacityBits - buf.length));
  buf.append(0, (8 - (buf.length % 8)) % 8);
  const codewords = buf.toCodewords();
  for (let pad = 0xec; codewords.length < capacityBits / 8; pad ^= 0xec ^ 0x11) codewords.push(pad);
  return codewords;
}

/** Agrega corrección por bloque e intercala datos y ECC en la secuencia final de codewords. */
export function addEccAndInterleave(data: readonly number[], version: number, ecc: QrEcc): number[] {
  const layout = blockLayout(version, ecc);
  if (data.length !== dataCodewords(version, ecc)) throw new RangeError('cantidad de codewords de datos inesperada');
  const divisor = rsDivisor(layout.eccPerBlock);
  const blocks: number[][] = [];
  let k = 0;
  for (let i = 0; i < layout.blocks; i++) {
    const len = layout.shortDataLen + (i < layout.shortBlocks ? 0 : 1);
    const chunk = data.slice(k, k + len);
    k += len;
    const parity = rsRemainder(chunk, divisor);
    // Los bloques cortos llevan un byte de relleno para alinear el intercalado; se omite al escribir.
    const padded = i < layout.shortBlocks ? [...chunk, 0] : [...chunk];
    blocks.push([...padded, ...parity]);
  }
  const result: number[] = [];
  for (let i = 0; i < layout.interleavedBlockLen; i++) {
    for (let j = 0; j < layout.blocks; j++) {
      if (i === layout.shortDataLen && j < layout.shortBlocks) continue;
      result.push(blocks[j]?.[i] ?? 0);
    }
  }
  return result;
}

/** Las ocho máscaras del estándar: `true` invierte el módulo (x = columna, y = fila). */
export const MASK_FUNCTIONS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Matriz booleana del tamaño de la versión, toda clara. */
function emptyMatrix(size: number): boolean[][] {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function setModule(grid: boolean[][], x: number, y: number, dark: boolean): void {
  const row = grid[y];
  if (row !== undefined && x >= 0 && x < row.length) row[x] = dark;
}

function getModule(grid: boolean[][], x: number, y: number): boolean {
  return grid[y]?.[x] ?? false;
}

/** Información de formato de 15 bits: BCH(15,5) con máscara 0x5412. */
export function formatBits(ecc: QrEcc, mask: number): number {
  const data = (eccFormatBits(ecc) << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

/** Información de versión de 18 bits: BCH(18,6). Sólo se escribe desde la versión 7. */
export function versionInfoBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return ((version << 12) | rem) & 0x3ffff;
}

function bitAt(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

/**
 * Marca de módulos funcionales: patrones de búsqueda con separadores, temporización,
 * alineación, módulo oscuro, zonas de formato y de versión. `true` = no lleva datos.
 */
export function functionModules(version: number): boolean[][] {
  const size = versionSize(version);
  const grid = emptyMatrix(size);
  const mark = (x: number, y: number): void => setModule(grid, x, y, true);

  // Temporización: fila y columna 6 completas.
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }
  // Buscadores de 7×7 más el separador de un módulo: se reserva el bloque 9×9 de cada esquina.
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
  }
  // Alineación: todas las intersecciones salvo las que chocan con los buscadores.
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark((positions[j] ?? 0) + dx, (positions[i] ?? 0) + dy);
    }
  }
  // Zonas de información de formato y módulo oscuro.
  for (let i = 0; i < 9; i++) {
    mark(8, i);
    mark(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    mark(size - 1 - i, 8);
    mark(8, size - 1 - i);
  }
  // Información de versión: dos bloques de 6×3 junto a los buscadores superior derecho e inferior izquierdo.
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      mark(a, b);
      mark(b, a);
    }
  }
  return grid;
}

function drawFunctionPatterns(grid: boolean[][], version: number): void {
  const size = versionSize(version);
  for (let i = 0; i < size; i++) {
    setModule(grid, 6, i, i % 2 === 0);
    setModule(grid, i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setModule(grid, x, y, dist !== 2 && dist !== 4);
      }
    }
  }
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setModule(grid, (positions[j] ?? 0) + dx, (positions[i] ?? 0) + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }
  if (version >= 7) {
    const bits = versionInfoBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = bitAt(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setModule(grid, a, b, bit);
      setModule(grid, b, a, bit);
    }
  }
}

/** Escribe la información de formato en sus dos ubicaciones y el módulo oscuro fijo. */
export function drawFormatInfo(grid: boolean[][], ecc: QrEcc, mask: number): void {
  const size = grid.length;
  const bits = formatBits(ecc, mask);
  for (let i = 0; i <= 5; i++) setModule(grid, 8, i, bitAt(bits, i));
  setModule(grid, 8, 7, bitAt(bits, 6));
  setModule(grid, 8, 8, bitAt(bits, 7));
  setModule(grid, 7, 8, bitAt(bits, 8));
  for (let i = 9; i < 15; i++) setModule(grid, 14 - i, 8, bitAt(bits, i));
  for (let i = 0; i < 8; i++) setModule(grid, size - 1 - i, 8, bitAt(bits, i));
  for (let i = 8; i < 15; i++) setModule(grid, 8, size - 15 + i, bitAt(bits, i));
  setModule(grid, 8, size - 8, true);
}

/**
 * Recorre los módulos de datos en zigzag de derecha a izquierda saltando la columna 6.
 * `visit(x, y, index)` recibe cada posición libre en orden de escritura.
 */
export function walkDataModules(size: number, functions: boolean[][], visit: (x: number, y: number, index: number) => void): void {
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    // Al llegar a la columna 6 (temporización vertical) el par salta a la 5: ese desplazamiento
    // cambia la paridad del resto del recorrido y es lo que hace alcanzable la columna 0.
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!(functions[y]?.[x] ?? true)) {
          visit(x, y, index);
          index++;
        }
      }
    }
  }
}

function drawCodewords(grid: boolean[][], functions: boolean[][], codewords: readonly number[]): void {
  const size = grid.length;
  const totalBits = codewords.length * 8;
  walkDataModules(size, functions, (x, y, i) => {
    // Los bits sobrantes del final quedan en claro, como pide el estándar.
    if (i < totalBits) setModule(grid, x, y, bitAt(codewords[i >>> 3] ?? 0, 7 - (i & 7)));
  });
}

function applyMask(grid: boolean[][], functions: boolean[][], mask: number): void {
  const fn = MASK_FUNCTIONS[mask];
  if (fn === undefined) throw new RangeError(`máscara inválida: ${mask}`);
  const size = grid.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!(functions[y]?.[x] ?? true) && fn(x, y)) setModule(grid, x, y, !getModule(grid, x, y));
    }
  }
}

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

// Patrón 1:1:3:1:1 con zona clara de cuatro módulos a un lado (regla 3).
const FINDER_LIKE = [true, false, true, true, true, false, true, false, false, false, false];

function matchesAt(line: readonly boolean[], start: number, pattern: readonly boolean[], reversed: boolean): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const want = pattern[reversed ? pattern.length - 1 - i : i];
    if ((line[start + i] ?? false) !== want) return false;
  }
  return true;
}

function penaltyLine(line: readonly boolean[]): number {
  let score = 0;
  // Regla 1: rachas de cinco o más módulos del mismo color.
  let run = 1;
  for (let i = 1; i < line.length; i++) {
    if (line[i] === line[i - 1]) {
      run++;
      if (run === 5) score += PENALTY_N1;
      else if (run > 5) score += 1;
    } else run = 1;
  }
  // Regla 3: patrón tipo buscador dentro de la línea, en cualquiera de sus dos orientaciones.
  for (let i = 0; i + FINDER_LIKE.length <= line.length; i++) {
    if (matchesAt(line, i, FINDER_LIKE, false) || matchesAt(line, i, FINDER_LIKE, true)) score += PENALTY_N3;
  }
  return score;
}

/** Penalización total de una matriz según las cuatro reglas del estándar. Gana la máscara con menor puntaje. */
export function penaltyScore(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let score = 0;
  for (let y = 0; y < size; y++) {
    const row = modules[y] ?? [];
    score += penaltyLine(row);
  }
  for (let x = 0; x < size; x++) {
    const col: boolean[] = [];
    for (let y = 0; y < size; y++) col.push(modules[y]?.[x] ?? false);
    score += penaltyLine(col);
  }
  // Regla 2: bloques de 2×2 del mismo color.
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const v = modules[y]?.[x] ?? false;
      if (v === (modules[y]?.[x + 1] ?? false) && v === (modules[y + 1]?.[x] ?? false) && v === (modules[y + 1]?.[x + 1] ?? false)) score += PENALTY_N2;
    }
  }
  // Regla 4: desviación de la proporción de módulos oscuros respecto del 50 %.
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y]?.[x] === true) dark++;
  const total = size * size;
  score += Math.floor(Math.abs(dark * 100 - total * 50) / (total * 5)) * PENALTY_N4;
  return score;
}

/** Copia profunda de una matriz de módulos. */
function cloneMatrix(grid: readonly (readonly boolean[])[]): boolean[][] {
  return grid.map((row) => [...row]);
}

/** Versión más pequeña del rango que admite el texto con el nivel pedido, o `undefined` si no cabe. */
export function fitVersion(text: string, ecc: QrEcc, minVersion: number, maxVersion: number): { version: number; mode: QrMode } | undefined {
  const mode = chooseMode(text);
  const bytes = mode === 'byte' ? utf8Bytes(text) : [];
  const content = payloadBits(mode, text, bytes);
  for (let version = minVersion; version <= maxVersion; version++) {
    const needed = 4 + charCountBits(mode, version) + content;
    if (needed <= dataCodewords(version, ecc) * 8) return { version, mode };
  }
  return undefined;
}

/** Máxima cantidad de caracteres (o bytes UTF-8 en modo byte) que admite una (versión, nivel, modo). */
export function capacityFor(version: number, ecc: QrEcc, mode: QrMode): number {
  const available = dataCodewords(version, ecc) * 8 - 4 - charCountBits(mode, version);
  if (available <= 0) return 0;
  if (mode === 'byte') return Math.floor(available / 8);
  if (mode === 'alphanumeric') {
    const pairs = Math.floor(available / 11);
    return pairs * 2 + (available - pairs * 11 >= 6 ? 1 : 0);
  }
  const triples = Math.floor(available / 10);
  const rest = available - triples * 10;
  return triples * 3 + (rest >= 7 ? 2 : rest >= 4 ? 1 : 0);
}

/**
 * Codifica `text` como símbolo QR real y decodificable.
 * Elige el modo más compacto (numérico, alfanumérico o byte UTF-8), la versión más pequeña que cabe
 * y la máscara de menor penalización. Lanza `RangeError` si el texto no cabe en `maxVersion`.
 */
export function encodeQr(text: string, opts: EncodeQrOptions = {}): QrCode {
  const ecc = opts.ecc ?? 'M';
  const minVersion = Math.max(QR_MIN_VERSION, opts.minVersion ?? QR_MIN_VERSION);
  const maxVersion = Math.min(QR_MAX_VERSION, opts.maxVersion ?? QR_MAX_VERSION);
  if (minVersion > maxVersion) throw new RangeError(`rango de versiones vacío: ${minVersion}..${maxVersion}`);
  const fit = fitVersion(text, ecc, minVersion, maxVersion);
  if (fit === undefined) throw new RangeError(`el texto de ${text.length} caracteres no cabe en la versión ${maxVersion} con nivel ${ecc}`);
  const { version, mode } = fit;

  const data = buildDataCodewords(text, version, ecc, mode);
  const codewords = addEccAndInterleave(data, version, ecc);
  const size = versionSize(version);
  const functions = functionModules(version);
  const base = emptyMatrix(size);
  drawFunctionPatterns(base, version);
  drawCodewords(base, functions, codewords);

  const candidates: { mask: number; modules: boolean[][]; score: number }[] = [];
  const masks = opts.forceMask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [opts.forceMask];
  for (const mask of masks) {
    if (!Number.isInteger(mask) || mask < 0 || mask >= QR_MASK_COUNT) throw new RangeError(`máscara inválida: ${mask}`);
    const grid = cloneMatrix(base);
    applyMask(grid, functions, mask);
    drawFormatInfo(grid, ecc, mask);
    candidates.push({ mask, modules: grid, score: penaltyScore(grid) });
  }
  let best = candidates[0]!;
  for (const c of candidates) if (c.score < best.score) best = c;
  // Los bits sobrantes del final quedan en claro por construcción: la matriz nace vacía.
  return { modules: best.modules, size, version, ecc, mask: best.mask };
}
