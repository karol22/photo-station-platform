/**
 * Aritmética en el campo de Galois GF(256) con polinomio primitivo 0x11D, tal como pide ISO/IEC 18004.
 * Sirve para calcular los codewords de corrección Reed-Solomon. Todo es puro y sin estado observable.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

{
  // La tabla exp recorre las potencias de α = 2 reduciendo con 0x11D; la log es su inversa.
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if ((x & 0x100) !== 0) x ^= 0x11d;
  }
  // Se duplica la tabla para poder sumar exponentes sin tomar módulo.
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255] ?? 0;
}

/** Potencia α^i con i en 0..511. */
export function gfExp(i: number): number {
  return GF_EXP[i] ?? 0;
}

/** Logaritmo en base α de un valor distinto de cero. */
export function gfLog(v: number): number {
  return GF_LOG[v] ?? 0;
}

/** Producto en GF(256). El cero absorbe. */
export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return gfExp(gfLog(a) + gfLog(b));
}

/**
 * Divisor generador de Reed-Solomon de grado `degree`: g(x) = ∏ (x − α^i) para i en 0..degree−1.
 * Devuelve sólo los `degree` coeficientes de menor grado; el coeficiente principal es 1 implícito.
 */
export function rsDivisor(degree: number): Uint8Array {
  if (degree < 1 || degree > 255) throw new RangeError(`grado de divisor Reed-Solomon fuera de rango: ${degree}`);
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j] ?? 0, root);
      if (j + 1 < degree) result[j] = (result[j] ?? 0) ^ (result[j + 1] ?? 0);
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

/** Resto de dividir el polinomio `data` por `divisor`: son los codewords de corrección del bloque. */
export function rsRemainder(data: readonly number[], divisor: Uint8Array): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() ?? 0);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) {
      result[i] = (result[i] ?? 0) ^ gfMul(divisor[i] ?? 0, factor);
    }
  }
  return result;
}
