/**
 * Codificador y decodificador de códigos QR reales (ISO/IEC 18004), sin dependencias.
 * `encodeQr` produce símbolos escaneables; `decodeQr` sólo sirve para pruebas y diagnóstico.
 */

export {
  encodeQr,
  capacityFor,
  chooseMode,
  fitVersion,
  buildDataCodewords,
  addEccAndInterleave,
  formatBits,
  versionInfoBits,
  functionModules,
  drawFormatInfo,
  walkDataModules,
  penaltyScore,
  utf8Bytes,
  MASK_FUNCTIONS,
  QR_MASK_COUNT,
} from './encode';
export type { QrCode, EncodeQrOptions } from './encode';

export { decodeQr, readFormatInfo, readCodewords, deinterleave, utf8Decode } from './decode';
export type { QrDecoded } from './decode';

export {
  QR_MIN_VERSION,
  QR_MAX_VERSION,
  QR_ECC_LEVELS,
  ALPHANUMERIC_CHARSET,
  alignmentPositions,
  blockLayout,
  charCountBits,
  dataCodewords,
  eccBlockCount,
  eccCodewordsPerBlock,
  totalCodewords,
  rawDataModules,
  remainderBits,
  versionSize,
  versionFromSize,
} from './tables';
export type { QrEcc, QrMode, BlockLayout } from './tables';

export { gfExp, gfLog, gfMul, rsDivisor, rsRemainder } from './gf';
