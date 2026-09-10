/**
 * Codec PNG sin dependencias. `encodePNG` produce RGBA de 8 bits con filtro 0 por fila y zlib en bloques
 * stored (válido, sin compresión). `decodePNG` lee PNG de 8 bits sin entrelazado en gris, gris+alpha,
 * RGB y RGBA. Ambos aceptan `deflate`/`inflate` inyectables para usar `node:zlib` desde apps Node.
 */
import { createRaster } from './raster';
import type { Raster } from './raster';
import { crc32 } from './zlib/checksums';
import { zlibStored } from './zlib/deflate-stored';
import { zlibInflate } from './zlib/inflate';

export type PngEncodeOptions = {
  /** Compresor zlib inyectable (p. ej. `deflateSync` de `node:zlib`). Sin él, bloques stored. */
  deflate?: (data: Uint8Array) => Uint8Array;
};
export type PngDecodeOptions = {
  /** Descompresor zlib inyectable (p. ej. `inflateSync` de `node:zlib`). Sin él, inflate propio en TS. */
  inflate?: (data: Uint8Array) => Uint8Array;
};

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

function be32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function readBe32(bytes: Uint8Array, pos: number): number {
  return ((bytes[pos]! << 24) | (bytes[pos + 1]! << 16) | (bytes[pos + 2]! << 8) | bytes[pos + 3]!) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
  const body = new Uint8Array(4 + data.length);
  body.set(typeBytes, 0);
  body.set(data, 4);
  const crc = crc32(body);
  const out = new Uint8Array(4 + body.length + 4);
  out.set(be32(data.length), 0);
  out.set(body, 4);
  out.set(be32(crc), 4 + body.length);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** Codifica un Raster como PNG RGBA de 8 bits. Determinista: mismo Raster, mismos bytes. */
export function encodePNG(r: Raster, opts: PngEncodeOptions = {}): Uint8Array {
  const rowBytes = r.width * 4;
  const raw = new Uint8Array((rowBytes + 1) * r.height);
  for (let y = 0; y < r.height; y++) {
    const off = y * (rowBytes + 1);
    raw[off] = 0;
    raw.set(r.data.subarray(y * rowBytes, (y + 1) * rowBytes), off + 1);
  }
  const compressed = opts.deflate ? opts.deflate(raw) : zlibStored(raw);
  const ihdr = new Uint8Array([...be32(r.width), ...be32(r.height), 8, 6, 0, 0, 0]);
  return concat([new Uint8Array(SIGNATURE), chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', new Uint8Array(0))]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decodifica un PNG. Lanza con un mensaje claro ante formatos fuera del alcance (paleta, 16 bits, entrelazado). */
export function decodePNG(bytes: Uint8Array, opts: PngDecodeOptions = {}): Raster {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('decodePNG: not a PNG (bad signature)');
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let seenIhdr = false;
  const idats: Uint8Array[] = [];
  while (pos + 8 <= bytes.length) {
    const len = readBe32(bytes, pos);
    const type = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!);
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > bytes.length) throw new Error(`decodePNG: truncated chunk ${type}`);
    const expectedCrc = readBe32(bytes, dataEnd);
    if (crc32(bytes.subarray(pos + 4, dataEnd)) !== expectedCrc) throw new Error(`decodePNG: CRC mismatch in chunk ${type}`);
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      if (len !== 13) throw new Error('decodePNG: malformed IHDR');
      width = readBe32(data, 0);
      height = readBe32(data, 4);
      const bitDepth = data[8]!;
      colorType = data[9]!;
      const compression = data[10]!;
      const filter = data[11]!;
      const interlace = data[12]!;
      if (bitDepth !== 8) throw new Error(`decodePNG: unsupported bit depth ${bitDepth} (only 8)`);
      if (!(colorType in CHANNELS)) throw new Error(`decodePNG: unsupported color type ${colorType} (only 0, 2, 4, 6; no palette)`);
      if (compression !== 0 || filter !== 0) throw new Error('decodePNG: unsupported compression/filter method');
      if (interlace !== 0) throw new Error('decodePNG: interlaced PNG not supported');
      if (width < 1 || height < 1) throw new Error('decodePNG: invalid dimensions');
      seenIhdr = true;
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos = dataEnd + 4;
  }
  if (!seenIhdr) throw new Error('decodePNG: missing IHDR');
  if (idats.length === 0) throw new Error('decodePNG: missing IDAT');
  const channels = CHANNELS[colorType]!;
  const stride = width * channels;
  const expected = (stride + 1) * height;
  const compressed = concat(idats);
  const inflated = opts.inflate ? opts.inflate(compressed) : zlibInflate(compressed, expected);
  if (inflated.length < expected) throw new Error(`decodePNG: image data too short (${inflated.length} < ${expected})`);

  const out = createRaster(width, height);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const off = y * (stride + 1);
    const filterType = inflated[off]!;
    for (let i = 0; i < stride; i++) {
      const x = inflated[off + 1 + i]!;
      const a = i >= channels ? cur[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let v: number;
      switch (filterType) {
        case 0:
          v = x;
          break;
        case 1:
          v = x + a;
          break;
        case 2:
          v = x + b;
          break;
        case 3:
          v = x + ((a + b) >> 1);
          break;
        case 4:
          v = x + paeth(a, b, c);
          break;
        default:
          throw new Error(`decodePNG: invalid filter type ${filterType} at row ${y}`);
      }
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const s = x * channels;
      if (channels === 4) {
        out.data[o] = cur[s]!;
        out.data[o + 1] = cur[s + 1]!;
        out.data[o + 2] = cur[s + 2]!;
        out.data[o + 3] = cur[s + 3]!;
      } else if (channels === 3) {
        out.data[o] = cur[s]!;
        out.data[o + 1] = cur[s + 1]!;
        out.data[o + 2] = cur[s + 2]!;
        out.data[o + 3] = 255;
      } else if (channels === 2) {
        out.data[o] = cur[s]!;
        out.data[o + 1] = cur[s]!;
        out.data[o + 2] = cur[s]!;
        out.data[o + 3] = cur[s + 1]!;
      } else {
        out.data[o] = cur[s]!;
        out.data[o + 1] = cur[s]!;
        out.data[o + 2] = cur[s]!;
        out.data[o + 3] = 255;
      }
    }
    prev.set(cur);
  }
  return out;
}
