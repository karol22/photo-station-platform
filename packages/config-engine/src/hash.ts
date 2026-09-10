// Serialización estable y sha256 en TypeScript puro.
// No usa `node:crypto` ni `TextEncoder`: produce el mismo resultado en Node y en el navegador.

/**
 * Serializa cualquier valor a JSON canónico: claves de objeto ordenadas, arrays en su orden,
 * sin `undefined` (se omite en objetos y se vuelve `null` en arrays, igual que `JSON.stringify`).
 * Respeta `toJSON` (por ejemplo `Date`). `NaN`/`Infinity` se serializan como `null`.
 * Un valor de nivel superior no serializable (`undefined`, función, símbolo) produce `"null"`.
 */
export function stableStringify(value: unknown): string {
  return serialize(value, []) ?? 'null';
}

function serialize(value: unknown, stack: object[]): string | undefined {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    case 'boolean':
      return value ? 'true' : 'false';
    case 'bigint':
      throw new TypeError('stableStringify: bigint no es serializable');
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
    default:
      break;
  }
  const obj = value as object;
  const toJSON = (obj as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === 'function') {
    return serialize((toJSON as () => unknown).call(obj), stack);
  }
  if (stack.includes(obj)) throw new TypeError('stableStringify: estructura circular');
  stack.push(obj);
  let result: string;
  if (Array.isArray(obj)) {
    const items: string[] = [];
    for (const item of obj) items.push(serialize(item, stack) ?? 'null');
    result = `[${items.join(',')}]`;
  } else {
    const record = obj as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(record).sort()) {
      const serialized = serialize(record[key], stack);
      if (serialized !== undefined) parts.push(`${JSON.stringify(key)}:${serialized}`);
    }
    result = `{${parts.join(',')}}`;
  }
  stack.pop();
  return result;
}

/** Hash estable de un valor: sha256 hex de su serialización canónica. */
export function stableHash(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

/** Codifica una cadena JS como UTF-8. Los surrogates huérfanos se reemplazan por U+FFFD. */
export function utf8Encode(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 3);
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) {
      out[n++] = cp;
    } else if (cp < 0x800) {
      out[n++] = 0xc0 | (cp >> 6);
      out[n++] = 0x80 | (cp & 0x3f);
    } else if (cp < 0x10000) {
      out[n++] = 0xe0 | (cp >> 12);
      out[n++] = 0x80 | ((cp >> 6) & 0x3f);
      out[n++] = 0x80 | (cp & 0x3f);
    } else {
      out[n++] = 0xf0 | (cp >> 18);
      out[n++] = 0x80 | ((cp >> 12) & 0x3f);
      out[n++] = 0x80 | ((cp >> 6) & 0x3f);
      out[n++] = 0x80 | (cp & 0x3f);
    }
  }
  return out.subarray(0, n);
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const HEX: string[] = [];
for (let i = 0; i < 256; i++) HEX.push(i.toString(16).padStart(2, '0'));

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** sha256 en hexadecimal (64 caracteres) de una cadena (codificada como UTF-8) o de bytes. */
export function sha256Hex(input: string | Uint8Array): string {
  const message = typeof input === 'string' ? utf8Encode(input) : input;
  const length = message.length;
  // Relleno: 0x80, ceros hasta ≡ 56 (mod 64) y longitud en bits como entero de 64 bits big-endian.
  const paddedLength = Math.ceil((length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[length] = 0x80;
  const bitLengthHigh = Math.floor(length / 0x20000000);
  const bitLengthLow = (length * 8) >>> 0;
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  view.setUint32(paddedLength - 8, bitLengthHigh);
  view.setUint32(paddedLength - 4, bitLengthLow);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15]!;
      const w2 = W[i - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) >>> 0;
    }
    let a = H[0]!;
    let b = H[1]!;
    let c = H[2]!;
    let d = H[3]!;
    let e = H[4]!;
    let f = H[5]!;
    let g = H[6]!;
    let h = H[7]!;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i]! + W[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = H[0]! + a;
    H[1] = H[1]! + b;
    H[2] = H[2]! + c;
    H[3] = H[3]! + d;
    H[4] = H[4]! + e;
    H[5] = H[5]! + f;
    H[6] = H[6]! + g;
    H[7] = H[7]! + h;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) {
    const word = H[i]!;
    hex +=
      HEX[(word >>> 24) & 0xff]! +
      HEX[(word >>> 16) & 0xff]! +
      HEX[(word >>> 8) & 0xff]! +
      HEX[word & 0xff]!;
  }
  return hex;
}
