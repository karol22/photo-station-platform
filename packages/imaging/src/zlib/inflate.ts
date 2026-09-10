/**
 * Inflate (RFC 1951) implementado en TypeScript al estilo de `puff.c`: bloques stored, Huffman fijo y dinámico.
 * Prioriza claridad y corrección sobre velocidad; para imágenes grandes en Node se inyecta `node:zlib`.
 */
import { adler32 } from './checksums';

const MAXBITS = 15;
const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

type Huffman = { count: Uint16Array; symbol: Uint16Array };

class BitReader {
  private bitBuf = 0;
  private bitCnt = 0;
  pos: number;
  constructor(
    private readonly buf: Uint8Array,
    start: number,
  ) {
    this.pos = start;
  }
  bits(n: number): number {
    while (this.bitCnt < n) {
      if (this.pos >= this.buf.length) throw new Error('inflate: unexpected end of input');
      this.bitBuf |= this.buf[this.pos++]! << this.bitCnt;
      this.bitCnt += 8;
    }
    const value = this.bitBuf & ((1 << n) - 1);
    this.bitBuf >>>= n;
    this.bitCnt -= n;
    return value;
  }
  /** Descarta los bits restantes del byte en curso (siempre < 8 después de una lectura). */
  alignByte(): void {
    this.bitBuf = 0;
    this.bitCnt = 0;
  }
  byte(): number {
    if (this.pos >= this.buf.length) throw new Error('inflate: unexpected end of input');
    return this.buf[this.pos++]!;
  }
}

class Output {
  buf: Uint8Array;
  len = 0;
  constructor(capacity: number) {
    this.buf = new Uint8Array(Math.max(64, capacity));
  }
  ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  push(b: number): void {
    this.ensure(1);
    this.buf[this.len++] = b;
  }
  result(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

function buildHuffman(lengths: ArrayLike<number>, n: number): Huffman {
  const count = new Uint16Array(MAXBITS + 1);
  for (let sym = 0; sym < n; sym++) count[lengths[sym]!]!++;
  if (count[0] === n) return { count, symbol: new Uint16Array(n) };
  let left = 1;
  for (let len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len]!;
    if (left < 0) throw new Error('inflate: over-subscribed code lengths');
  }
  const offs = new Uint16Array(MAXBITS + 1);
  for (let len = 1; len < MAXBITS; len++) offs[len + 1] = offs[len]! + count[len]!;
  const symbol = new Uint16Array(n);
  for (let sym = 0; sym < n; sym++) {
    const len = lengths[sym]!;
    if (len !== 0) symbol[offs[len]!++] = sym;
  }
  return { count, symbol };
}

function decodeSymbol(reader: BitReader, h: Huffman): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len <= MAXBITS; len++) {
    code |= reader.bits(1);
    const count = h.count[len]!;
    if (code - count < first) return h.symbol[index + (code - first)]!;
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  throw new Error('inflate: invalid Huffman code');
}

let fixedTables: { lencode: Huffman; distcode: Huffman } | undefined;

function fixed(): { lencode: Huffman; distcode: Huffman } {
  if (fixedTables) return fixedTables;
  const lengths = new Uint8Array(288);
  let sym = 0;
  for (; sym < 144; sym++) lengths[sym] = 8;
  for (; sym < 256; sym++) lengths[sym] = 9;
  for (; sym < 280; sym++) lengths[sym] = 7;
  for (; sym < 288; sym++) lengths[sym] = 8;
  const lencode = buildHuffman(lengths, 288);
  const dlengths = new Uint8Array(30).fill(5);
  const distcode = buildHuffman(dlengths, 30);
  fixedTables = { lencode, distcode };
  return fixedTables;
}

function codes(reader: BitReader, out: Output, lencode: Huffman, distcode: Huffman): void {
  for (;;) {
    let sym = decodeSymbol(reader, lencode);
    if (sym < 256) {
      out.push(sym);
      continue;
    }
    if (sym === 256) return;
    sym -= 257;
    if (sym >= 29) throw new Error('inflate: invalid length symbol');
    const len = LENGTH_BASE[sym]! + reader.bits(LENGTH_EXTRA[sym]!);
    const dsym = decodeSymbol(reader, distcode);
    if (dsym >= 30) throw new Error('inflate: invalid distance symbol');
    const dist = DIST_BASE[dsym]! + reader.bits(DIST_EXTRA[dsym]!);
    if (dist > out.len) throw new Error('inflate: distance too far back');
    out.ensure(len);
    for (let i = 0; i < len; i++) {
      out.buf[out.len] = out.buf[out.len - dist]!;
      out.len++;
    }
  }
}

function dynamic(reader: BitReader, out: Output): void {
  const nlen = reader.bits(5) + 257;
  const ndist = reader.bits(5) + 1;
  const ncode = reader.bits(4) + 4;
  if (nlen > 286 || ndist > 30) throw new Error('inflate: bad dynamic block counts');
  const lengths = new Uint8Array(320);
  for (let i = 0; i < ncode; i++) lengths[CODE_LENGTH_ORDER[i]!] = reader.bits(3);
  const clcode = buildHuffman(lengths, 19);
  let index = 0;
  while (index < nlen + ndist) {
    const sym = decodeSymbol(reader, clcode);
    if (sym < 16) {
      lengths[index++] = sym;
      continue;
    }
    let value = 0;
    let repeat: number;
    if (sym === 16) {
      if (index === 0) throw new Error('inflate: repeat with no previous length');
      value = lengths[index - 1]!;
      repeat = 3 + reader.bits(2);
    } else if (sym === 17) {
      repeat = 3 + reader.bits(3);
    } else {
      repeat = 11 + reader.bits(7);
    }
    if (index + repeat > nlen + ndist) throw new Error('inflate: too many code lengths');
    while (repeat-- > 0) lengths[index++] = value;
  }
  if (lengths[256] === 0) throw new Error('inflate: missing end-of-block code');
  const lencode = buildHuffman(lengths, nlen);
  const distcode = buildHuffman(lengths.subarray(nlen), ndist);
  codes(reader, out, lencode, distcode);
}

/** Descomprime un flujo deflate crudo que empieza en `offset`. Devuelve los bytes y la posición final. */
export function inflateRaw(data: Uint8Array, offset = 0, expectedSize?: number): { bytes: Uint8Array; end: number } {
  const reader = new BitReader(data, offset);
  const out = new Output(expectedSize ?? Math.max(1024, data.length * 4));
  let last = 0;
  do {
    last = reader.bits(1);
    const type = reader.bits(2);
    if (type === 0) {
      reader.alignByte();
      const len = reader.byte() | (reader.byte() << 8);
      const nlen = reader.byte() | (reader.byte() << 8);
      if (len !== (~nlen & 0xffff)) throw new Error('inflate: stored block length mismatch');
      out.ensure(len);
      for (let i = 0; i < len; i++) out.buf[out.len++] = reader.byte();
    } else if (type === 1) {
      const t = fixed();
      codes(reader, out, t.lencode, t.distcode);
    } else if (type === 2) {
      dynamic(reader, out);
    } else {
      throw new Error('inflate: invalid block type');
    }
  } while (!last);
  return { bytes: out.result(), end: reader.pos };
}

/** Descomprime un flujo zlib (RFC 1950): valida cabecera y Adler-32. Sin soporte de diccionario predefinido. */
export function zlibInflate(data: Uint8Array, expectedSize?: number): Uint8Array {
  if (data.length < 6) throw new Error('inflate: zlib stream too short');
  const cmf = data[0]!;
  const flg = data[1]!;
  if ((cmf & 0x0f) !== 8) throw new Error('inflate: unsupported compression method');
  if (((cmf << 8) | flg) % 31 !== 0) throw new Error('inflate: bad zlib header check');
  if (flg & 0x20) throw new Error('inflate: preset dictionary not supported');
  const { bytes, end } = inflateRaw(data, 2, expectedSize);
  if (end + 4 > data.length) throw new Error('inflate: missing Adler-32 trailer');
  const expected = ((data[end]! << 24) | (data[end + 1]! << 16) | (data[end + 2]! << 8) | data[end + 3]!) >>> 0;
  if (adler32(bytes) !== expected) throw new Error('inflate: Adler-32 mismatch');
  return bytes;
}
