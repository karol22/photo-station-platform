import { clampByte, createRaster, luma709, parseColor } from '../raster';
import type { Raster, RGBA } from '../raster';

/**
 * Vira la imagen a dos tonos: la luma Rec.709 elige un punto entre `shadow` (luma 0) y `highlight`
 * (luma 255). `amount` mezcla con el original, así que 1 es duotono puro y 0.5 un virado suave.
 * El alfa no se toca.
 *
 * Coste: **bajo**. Tres tablas de 256 entradas y una pasada por píxel; no lee vecinos.
 */
export function duotone(r: Raster, shadow: string | RGBA, highlight: string | RGBA, amount = 1): Raster {
  const lo = parseColor(shadow, [0, 0, 0, 255]);
  const hi = parseColor(highlight, [255, 255, 255, 255]);
  const mix = amount < 0 ? 0 : amount > 1 ? 1 : amount;
  const lutR = new Uint8ClampedArray(256);
  const lutG = new Uint8ClampedArray(256);
  const lutB = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    lutR[v] = clampByte(lo[0] + (hi[0] - lo[0]) * t);
    lutG[v] = clampByte(lo[1] + (hi[1] - lo[1]) * t);
    lutB[v] = clampByte(lo[2] + (hi[2] - lo[2]) * t);
  }
  const out = createRaster(r.width, r.height);
  const src = r.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const l = clampByte(luma709(src[i]!, src[i + 1]!, src[i + 2]!));
    dst[i] = clampByte(src[i]! + (lutR[l]! - src[i]!) * mix);
    dst[i + 1] = clampByte(src[i + 1]! + (lutG[l]! - src[i + 1]!) * mix);
    dst[i + 2] = clampByte(src[i + 2]! + (lutB[l]! - src[i + 2]!) * mix);
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}
