/**
 * Máscaras de recorte de persona y calidad del borde.
 *
 * `Mask` es un tipo **estructural**: coincide campo a campo con el `SegmentationMask` que produce
 * `@psp/vision`, pero este paquete no importa aquel para no acoplarse al motor de visión. 255 = persona,
 * 0 = fondo, y los valores intermedios son cobertura parcial.
 *
 * La máscara llega casi siempre **a menor resolución que la foto** (el análisis corre en miniatura, ver
 * `docs/producto/03-en-que-trabajar-ahora.md`), así que todo lo de aquí escala primero y afina después.
 */
import { clamp, clampByte } from './raster';

/** Cobertura por píxel, 0..255. Estructuralmente igual al `SegmentationMask` de `@psp/vision`. */
export type Mask = { width: number; height: number; data: Uint8ClampedArray };

export type EdgeOptions = {
  /**
   * Radio del suavizado del contorno, en píxeles de la máscara ya escalada. 0 desactiva el suavizado.
   * Por encima de 4 el recorte empieza a comerse el pelo.
   */
  feather?: number;
  /**
   * Ancho de la banda de transición, en cobertura 0..1. Es la fracción del rango que queda en valores
   * intermedios: fuera de la banda la máscara vuelve a ser sólida (0 o 255), así el interior de la
   * persona no se translucida.
   */
  band?: number;
  /**
   * Encoge (positivo) o expande (negativo) la máscara antes de la banda, en cobertura 0..1. Un encogimiento
   * pequeño mete el borde hacia dentro de la persona y evita el halo del fondo viejo al componer sobre uno
   * nuevo, que es el defecto que más delata un recorte malo.
   */
  shrink?: number;
};

export const DEFAULT_EDGE: Required<EdgeOptions> = { feather: 2, band: 0.55, shrink: 0.08 };

function assertMask(m: Mask, where: string): void {
  if (m.width < 1 || m.height < 1 || m.data.length < m.width * m.height) {
    throw new Error(`${where}: invalid mask ${m.width}x${m.height} (${m.data.length} bytes)`);
  }
}

export function createMask(width: number, height: number, fill = 0): Mask {
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (w < 1 || h < 1) throw new Error(`createMask: invalid size ${width}x${height}`);
  const data = new Uint8ClampedArray(w * h);
  if (fill !== 0) data.fill(clampByte(fill));
  return { width: w, height: h, data };
}

/** Cobertura 0..1 de un píxel de la máscara. Fuera de rango devuelve 0 (fondo). */
export function maskAt(m: Mask, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return 0;
  return m.data[y * m.width + x]! / 255;
}

/**
 * Escala una máscara a otro tamaño con interpolación bilineal, separable y de una sola pasada por eje
 * (coste `O(w·h)`). Los centros de píxel se alinean igual que en `resize`, así que la máscara escalada
 * queda registrada con la foto y no aparece un desplazamiento de medio píxel en el contorno.
 */
export function resampleMask(m: Mask, width: number, height: number): Mask {
  assertMask(m, 'resampleMask');
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (w === m.width && h === m.height) return { width: w, height: h, data: new Uint8ClampedArray(m.data) };
  const out = createMask(w, h);
  const xRatio = m.width / w;
  const yRatio = m.height / h;
  const xi0 = new Int32Array(w);
  const xi1 = new Int32Array(w);
  const xf = new Float64Array(w);
  for (let d = 0; d < w; d++) {
    const s = (d + 0.5) * xRatio - 0.5;
    const a = Math.max(0, Math.floor(s));
    xi0[d] = a;
    xi1[d] = Math.min(a + 1, m.width - 1);
    xf[d] = s < 0 ? 0 : s - a;
  }
  for (let d = 0; d < h; d++) {
    const s = (d + 0.5) * yRatio - 0.5;
    const a = Math.max(0, Math.floor(s));
    const b = Math.min(a + 1, m.height - 1);
    const fy = s < 0 ? 0 : s - a;
    const rowA = a * m.width;
    const rowB = b * m.width;
    const o = d * w;
    for (let x = 0; x < w; x++) {
      const i0 = xi0[x]!;
      const i1 = xi1[x]!;
      const fx = xf[x]!;
      const top = m.data[rowA + i0]! + (m.data[rowA + i1]! - m.data[rowA + i0]!) * fx;
      const bottom = m.data[rowB + i0]! + (m.data[rowB + i1]! - m.data[rowB + i0]!) * fx;
      out.data[o + x] = clampByte(top + (bottom - top) * fy);
    }
  }
  return out;
}

/** Desenfoque de caja separable con sumas deslizantes: dos pasadas de `O(w·h)`, independientes del radio. */
function boxBlurMask(m: Mask, radius: number): Mask {
  const rad = Math.max(0, Math.floor(radius));
  if (rad === 0) return { width: m.width, height: m.height, data: new Uint8ClampedArray(m.data) };
  const w = m.width;
  const h = m.height;
  const tmp = new Float64Array(w * h);
  const out = createMask(w, h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    let x0 = 0;
    let x1 = -1;
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - rad);
      const hi = Math.min(w - 1, x + rad);
      while (x1 < hi) sum += m.data[row + ++x1]!;
      while (x0 < lo) sum -= m.data[row + x0++]!;
      tmp[row + x] = sum / (hi - lo + 1);
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let y0 = 0;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - rad);
      const hi = Math.min(h - 1, y + rad);
      while (y1 < hi) sum += tmp[(++y1) * w + x]!;
      while (y0 < lo) sum -= tmp[(y0++) * w + x]!;
      out.data[y * w + x] = clampByte(sum / (hi - lo + 1));
    }
  }
  return out;
}

/** Smoothstep: derivada 0 en los dos extremos, para que la banda no deje una arista visible. */
function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Afina el borde de la máscara. La técnica, en dos pasos baratos:
 *
 * 1. **Suavizado separable** (`feather`): un desenfoque de caja con sumas deslizantes convierte el escalón
 *    del contorno en una rampa. Cuesta dos pasadas lineales y no depende del radio.
 * 2. **Banda de transición** (`band`, `shrink`): la rampa se vuelve a mapear con un smoothstep centrado en
 *    `0.5 + shrink`. Fuera de la banda el resultado es sólido (0 o 255), así que el interior de la persona
 *    no se translucida y sólo queda gradiente donde de verdad hay contorno. `shrink` mete ese contorno
 *    hacia dentro de la persona, que es lo que evita el halo del fondo original al componer sobre otro.
 *
 * El resultado se compone con **alfa gradual** (`compositeWithMask`), nunca con umbral: un recorte con
 * borde de tijera se ve barato, y ese borde es la diferencia entre un efecto creíble y uno malo.
 */
export function refineMaskEdge(m: Mask, opts: EdgeOptions = {}): Mask {
  assertMask(m, 'refineMaskEdge');
  const feather = Math.max(0, Math.floor(opts.feather ?? DEFAULT_EDGE.feather));
  const band = clamp(opts.band ?? DEFAULT_EDGE.band, 0.01, 1);
  const shrink = clamp(opts.shrink ?? DEFAULT_EDGE.shrink, -0.45, 0.45);
  const blurred = boxBlurMask(m, feather);
  const center = 0.5 + shrink;
  const lo = center - band / 2;
  const span = band;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = clampByte(smoothstep((v / 255 - lo) / span) * 255);
  const out = createMask(m.width, m.height);
  for (let i = 0; i < out.data.length; i++) out.data[i] = lut[blurred.data[i]!]!;
  return out;
}

/**
 * Deja la máscara lista para componer sobre una foto: la escala al tamaño del raster y luego afina el borde.
 * El orden importa: afinar **después** de escalar hace que el ancho de la banda se mida en píxeles de la
 * foto y no dependa de a qué resolución analizó el modelo de visión.
 */
export function prepareMask(m: Mask, width: number, height: number, opts: EdgeOptions = {}): Mask {
  const scaled = resampleMask(m, width, height);
  return refineMaskEdge(scaled, opts);
}

/** Fracción de píxeles con cobertura estrictamente intermedia. Sirve para comprobar que el borde no es duro. */
export function edgeSoftness(m: Mask): number {
  let soft = 0;
  for (let i = 0; i < m.width * m.height; i++) {
    const v = m.data[i]!;
    if (v > 0 && v < 255) soft++;
  }
  return soft / (m.width * m.height);
}
