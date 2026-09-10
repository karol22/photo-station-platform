/**
 * Utilidades puras sobre máscaras de persona. Corren en Node, sin DOM y sin dependencias.
 *
 * La máscara suele llegar más chica que el cuadro (el modelo trabaja a 256×256), así que el orden
 * habitual en el kiosco es: `segment()` → `scaleMask` al tamaño de destino → `featherMask` para que
 * el borde no se vea de tijera → componer. `maskCoverage` y `maskBounds` sirven para decidir sin
 * mirar píxeles: si hay alguien delante y dónde está.
 */
import type { Box, SegmentationMask } from './types';
import { clamp } from './util';

/** Umbral por defecto para considerar que un píxel es persona. */
export const MASK_PERSON_THRESHOLD = 128;

export function createMask(width: number, height: number, fill = 0): SegmentationMask {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  const data = new Uint8ClampedArray(w * h);
  if (fill !== 0) data.fill(fill);
  return { width: w, height: h, data };
}

/**
 * Reescala por vecino más cercano: es barato y conserva el alfabeto 0/255 de la máscara cruda.
 * Para un borde suave se aplica `featherMask` **después** de escalar, ya en píxeles de destino.
 */
export function scaleMask(mask: SegmentationMask, width: number, height: number): SegmentationMask {
  const out = createMask(width, height);
  if (out.width === 0 || out.height === 0 || mask.width === 0 || mask.height === 0) return out;
  if (out.width === mask.width && out.height === mask.height) {
    out.data.set(mask.data);
    return out;
  }
  for (let y = 0; y < out.height; y++) {
    const sy = Math.min(mask.height - 1, Math.floor(((y + 0.5) * mask.height) / out.height));
    const srcRow = sy * mask.width;
    const dstRow = y * out.width;
    for (let x = 0; x < out.width; x++) {
      const sx = Math.min(mask.width - 1, Math.floor(((x + 0.5) * mask.width) / out.width));
      out.data[dstRow + x] = mask.data[srcRow + sx] ?? 0;
    }
  }
  return out;
}

/**
 * Suaviza el borde con una caja separable de radio `radiusPx` (dos pasadas, horizontal y vertical,
 * con ventana deslizante y bordes replicados). El resultado deja de ser binario a propósito: los
 * valores intermedios son la mezcla parcial que evita el recorte de tijera.
 *
 * `radiusPx <= 0` devuelve una copia. El radio se expresa en píxeles **de la máscara**, así que
 * conviene escalar primero y suavizar después.
 */
export function featherMask(mask: SegmentationMask, radiusPx: number): SegmentationMask {
  const out = createMask(mask.width, mask.height);
  const r = Math.floor(radiusPx);
  const { width: w, height: h } = mask;
  if (w === 0 || h === 0) return out;
  if (r <= 0) {
    out.data.set(mask.data);
    return out;
  }
  const denom = 2 * r + 1;
  const tmp = new Float32Array(w * h);
  const src = (i: number): number => mask.data[i] ?? 0;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src(row + clamp(i, 0, w - 1));
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / denom;
      sum += src(row + clamp(x + r + 1, 0, w - 1)) - src(row + clamp(x - r, 0, w - 1));
    }
  }

  const mid = (i: number): number => tmp[i] ?? 0;
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += mid(clamp(i, 0, h - 1) * w + x);
    for (let y = 0; y < h; y++) {
      out.data[y * w + x] = Math.round(sum / denom);
      sum += mid(clamp(y + r + 1, 0, h - 1) * w + x) - mid(clamp(y - r, 0, h - 1) * w + x);
    }
  }
  return out;
}

/**
 * Fracción de persona en la máscara, 0..1 (media de los bytes / 255). Con una máscara suavizada
 * los bordes cuentan en proporción. Sirve para saber si hay alguien delante sin mirar la imagen.
 */
export function maskCoverage(mask: SegmentationMask): number {
  const n = mask.width * mask.height;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += mask.data[i] ?? 0;
  return sum / (n * 255);
}

/**
 * Caja de la persona, **normalizada 0..1 respecto a la máscara** (que cubre todo el cuadro, así que
 * sirve tal cual para recortar el cuadro original). `undefined` cuando no hay ningún píxel por
 * encima del umbral: no hay nadie.
 */
export function maskBounds(
  mask: SegmentationMask,
  threshold: number = MASK_PERSON_THRESHOLD,
): Box | undefined {
  const { width: w, height: h } = mask;
  if (w === 0 || h === 0) return undefined;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if ((mask.data[row + x] ?? 0) < threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return undefined;
  return { x: minX / w, y: minY / h, w: (maxX + 1 - minX) / w, h: (maxY + 1 - minY) / h };
}
