/**
 * Tablas y fórmulas de ISO/IEC 18004: niveles de corrección, bloques por versión,
 * capacidad en codewords y posiciones de los patrones de alineación.
 */

/** Nivel de corrección de errores: L≈7 %, M≈15 %, Q≈25 %, H≈30 % de codewords recuperables. */
export type QrEcc = 'L' | 'M' | 'Q' | 'H';

/** Modo de codificación del segmento. Un símbolo de este paquete usa un solo segmento. */
export type QrMode = 'numeric' | 'alphanumeric' | 'byte';

/** Versión mínima y máxima que soporta el codificador. */
export const QR_MIN_VERSION = 1;
export const QR_MAX_VERSION = 20;

export const QR_ECC_LEVELS: readonly QrEcc[] = ['L', 'M', 'Q', 'H'];

/** Orden de los niveles en la información de formato (no es el orden alfabético). */
const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Bits de nivel tal como viajan en la información de formato. */
export function eccFormatBits(ecc: QrEcc): number {
  return ECC_FORMAT_BITS[ecc];
}

/** Nivel correspondiente a dos bits de información de formato. */
export function eccFromFormatBits(bits: number): QrEcc {
  const found = QR_ECC_LEVELS.find((level) => ECC_FORMAT_BITS[level] === (bits & 3));
  if (found === undefined) throw new Error(`bits de nivel de corrección inválidos: ${bits}`);
  return found;
}

/** Indicador de modo de 4 bits. */
export const MODE_INDICATOR: Record<QrMode, number> = { numeric: 1, alphanumeric: 2, byte: 4 };

/** Modo correspondiente a un indicador de 4 bits; `undefined` si no es un modo soportado. */
export function modeFromIndicator(indicator: number): QrMode | undefined {
  if (indicator === 1) return 'numeric';
  if (indicator === 2) return 'alphanumeric';
  if (indicator === 4) return 'byte';
  return undefined;
}

/** Alfabeto del modo alfanumérico: su índice es el valor codificado. */
export const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/** Bits del contador de caracteres según modo y versión. */
export function charCountBits(mode: QrMode, version: number): number {
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  if (mode === 'numeric') return [10, 12, 14][band] ?? 10;
  if (mode === 'alphanumeric') return [9, 11, 13][band] ?? 9;
  return [8, 16, 16][band] ?? 8;
}

// Índice 0 sin usar (las versiones empiezan en 1). Cubre las 40 versiones del estándar.
const ECC_CODEWORDS_PER_BLOCK: Record<QrEcc, readonly number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const ECC_BLOCKS: Record<QrEcc, readonly number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 5, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

/** Comprueba que la versión está dentro de 1..40 y la devuelve. */
function assertVersion(version: number): number {
  if (!Number.isInteger(version) || version < 1 || version > 40) throw new RangeError(`versión QR inválida: ${version}`);
  return version;
}

/** Lado del símbolo en módulos: 17 + 4·versión. */
export function versionSize(version: number): number {
  return assertVersion(version) * 4 + 17;
}

/** Versión implícita en un lado de `size` módulos. */
export function versionFromSize(size: number): number {
  if ((size - 17) % 4 !== 0) throw new RangeError(`lado de símbolo inválido: ${size}`);
  return assertVersion((size - 17) / 4);
}

/** Posiciones (fila y columna) de los centros de los patrones de alineación. Vacío en la versión 1. */
export function alignmentPositions(version: number): number[] {
  assertVersion(version);
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

/** Módulos disponibles para datos y corrección, descontando patrones fijos y zonas reservadas. */
export function rawDataModules(version: number): number {
  assertVersion(version);
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const count = Math.floor(version / 7) + 2;
    result -= (25 * count - 10) * count - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Codewords totales (datos + corrección) de la versión. */
export function totalCodewords(version: number): number {
  return Math.floor(rawDataModules(version) / 8);
}

/** Bits sobrantes que se rellenan con ceros al final de la matriz. */
export function remainderBits(version: number): number {
  return rawDataModules(version) % 8;
}

/** Codewords de corrección por bloque para (versión, nivel). */
export function eccCodewordsPerBlock(version: number, ecc: QrEcc): number {
  return ECC_CODEWORDS_PER_BLOCK[ecc][assertVersion(version)] ?? 0;
}

/** Cantidad de bloques de corrección para (versión, nivel). */
export function eccBlockCount(version: number, ecc: QrEcc): number {
  return ECC_BLOCKS[ecc][assertVersion(version)] ?? 0;
}

/** Codewords de datos disponibles para (versión, nivel). */
export function dataCodewords(version: number, ecc: QrEcc): number {
  return totalCodewords(version) - eccCodewordsPerBlock(version, ecc) * eccBlockCount(version, ecc);
}

/** Descripción de los bloques de una (versión, nivel): longitudes de datos y de corrección. */
export interface BlockLayout {
  readonly blocks: number;
  readonly eccPerBlock: number;
  /** Longitud de datos de los bloques cortos. Los largos llevan uno más. */
  readonly shortDataLen: number;
  readonly shortBlocks: number;
  /** Longitud total (datos + relleno + corrección) de cada bloque en la fase de intercalado. */
  readonly interleavedBlockLen: number;
}

/** Reparte los codewords en grupos/bloques según la tabla del estándar. */
export function blockLayout(version: number, ecc: QrEcc): BlockLayout {
  const blocks = eccBlockCount(version, ecc);
  const eccPerBlock = eccCodewordsPerBlock(version, ecc);
  const raw = totalCodewords(version);
  const shortBlockLen = Math.floor(raw / blocks);
  return {
    blocks,
    eccPerBlock,
    shortDataLen: shortBlockLen - eccPerBlock,
    shortBlocks: blocks - (raw % blocks),
    interleavedBlockLen: shortBlockLen + 1,
  };
}
