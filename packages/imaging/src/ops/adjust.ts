import { clampByte, createRaster, luma709 } from '../raster';
import type { Raster } from '../raster';

/** Aplica una tabla de 256 entradas a RGB y conserva alpha. */
function applyLut(r: Raster, lut: Uint8ClampedArray): Raster {
  const out = createRaster(r.width, r.height);
  const src = r.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    dst[i] = lut[src[i]!]!;
    dst[i + 1] = lut[src[i + 1]!]!;
    dst[i + 2] = lut[src[i + 2]!]!;
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

function buildLut(fn: (v: number) => number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = clampByte(fn(v));
  return lut;
}

/** Brillo: suma `amount·255` a cada canal. −1..1; +1 satura a blanco. */
export function brightness(r: Raster, amount: number): Raster {
  const delta = amount * 255;
  return applyLut(r, buildLut((v) => v + delta));
}

/** Contraste alrededor del gris medio con factor `2^(2·amount)`: −1 → ×0.25, 0 → sin cambio, +1 → ×4. */
export function contrast(r: Raster, amount: number): Raster {
  const factor = Math.pow(2, 2 * amount);
  return applyLut(r, buildLut((v) => (v - 128) * factor + 128));
}

/** Exposición en pasos fotográficos: multiplica por `2^stops`. */
export function exposure(r: Raster, stops: number): Raster {
  const factor = Math.pow(2, stops);
  return applyLut(r, buildLut((v) => v * factor));
}

/** Saturación como mezcla con la luma Rec.709: −1 deja escala de grises, 0 no cambia, +1 duplica la distancia a la luma. */
export function saturation(r: Raster, amount: number): Raster {
  const f = 1 + amount;
  const out = createRaster(r.width, r.height);
  const src = r.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const red = src[i]!;
    const green = src[i + 1]!;
    const blue = src[i + 2]!;
    const l = luma709(red, green, blue);
    dst[i] = clampByte(l + (red - l) * f);
    dst[i + 1] = clampByte(l + (green - l) * f);
    dst[i + 2] = clampByte(l + (blue - l) * f);
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Temperatura: desplaza rojo y azul en direcciones opuestas (`±40·amount`). Positivo = más cálido. */
export function temperature(r: Raster, amount: number): Raster {
  const shift = amount * 40;
  const out = createRaster(r.width, r.height);
  const src = r.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    dst[i] = clampByte(src[i]! + shift);
    dst[i + 1] = src[i + 1]!;
    dst[i + 2] = clampByte(src[i + 2]! - shift);
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Escala de grises con luma Rec.709 (0.2126 R + 0.7152 G + 0.0722 B), redondeada half-up. */
export function grayscale(r: Raster): Raster {
  const out = createRaster(r.width, r.height);
  const src = r.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const l = clampByte(luma709(src[i]!, src[i + 1]!, src[i + 2]!));
    dst[i] = l;
    dst[i + 1] = l;
    dst[i + 2] = l;
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}
