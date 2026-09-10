import { adler32 } from './checksums';

const MAX_STORED = 65535;

/**
 * Envuelve `data` en un flujo zlib válido usando sólo bloques `stored` (sin compresión).
 * Salida ≈ entrada + 5 bytes por cada 64 KiB + 6 de cabecera/trailer. Es determinista y suficiente
 * para pruebas e impresión mock; las apps Node inyectan `node:zlib` cuando importa el tamaño.
 */
export function zlibStored(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / MAX_STORED));
  const out = new Uint8Array(2 + data.length + blocks * 5 + 4);
  let pos = 0;
  out[pos++] = 0x78; // CM=8 (deflate), CINFO=7 (ventana 32K)
  out[pos++] = 0x01; // FLEVEL=0, sin FDICT; (0x7801 % 31 === 0)
  for (let b = 0; b < blocks; b++) {
    const start = b * MAX_STORED;
    const end = Math.min(start + MAX_STORED, data.length);
    const len = end - start;
    const final = b === blocks - 1;
    out[pos++] = final ? 1 : 0; // BFINAL en bit 0, BTYPE=00
    out[pos++] = len & 0xff;
    out[pos++] = (len >>> 8) & 0xff;
    out[pos++] = ~len & 0xff;
    out[pos++] = (~len >>> 8) & 0xff;
    out.set(data.subarray(start, end), pos);
    pos += len;
  }
  const sum = adler32(data);
  out[pos++] = (sum >>> 24) & 0xff;
  out[pos++] = (sum >>> 16) & 0xff;
  out[pos++] = (sum >>> 8) & 0xff;
  out[pos++] = sum & 0xff;
  return out;
}
