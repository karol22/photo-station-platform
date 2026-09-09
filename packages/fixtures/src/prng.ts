/**
 * Generador pseudoaleatorio determinista (mulberry32) con semilla derivada de texto.
 * Toda "aleatoriedad" del paquete pasa por aquí: misma semilla, misma secuencia.
 */

/** Deriva un entero de 32 bits a partir de una cadena (xmur3). */
export function seedFromString(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32: devuelve una función que produce números en [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generador con utilidades de muestreo. Se deriva con `fork` para aislar sub-secuencias. */
export class Rng {
  private readonly seedText: string;
  private readonly nextFloat: () => number;

  constructor(seed: string) {
    this.seedText = seed;
    this.nextFloat = mulberry32(seedFromString(seed));
  }

  /** Número en [0, 1). */
  next(): number {
    return this.nextFloat();
  }

  /** Entero en [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: rango inválido ${min}..${max}`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Número real en [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** true con probabilidad `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Elemento uniforme de una lista no vacía. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: lista vacía');
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('Rng.pick: índice fuera de rango');
    return item;
  }

  /** Elemento según pesos relativos (los pesos cero nunca salen). */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Rng.weighted: sin pesos positivos');
    let r = this.next() * total;
    for (const [value, weight] of entries) {
      const w = Math.max(0, weight);
      if (w === 0) continue;
      if (r < w) return value;
      r -= w;
    }
    const last = entries[entries.length - 1];
    if (last === undefined) throw new Error('Rng.weighted: lista vacía');
    return last[0];
  }

  /** Copia barajada (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const a = copy[i];
      const b = copy[j];
      if (a !== undefined && b !== undefined) {
        copy[i] = b;
        copy[j] = a;
      }
    }
    return copy;
  }

  /** Cadena legible A-Z2-9 sin caracteres ambiguos (0, O, 1, I). */
  code(length: number): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < length; i += 1) out += alphabet.charAt(Math.floor(this.next() * alphabet.length));
    return out;
  }

  /** Generador derivado e independiente: `fork('a')` no altera la secuencia del padre. */
  fork(label: string): Rng {
    return new Rng(`${this.seedText}/${label}`);
  }
}
