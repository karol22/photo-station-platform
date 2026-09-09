import { clampByte, cloneRaster, createRaster } from '../raster';
import type { Raster } from '../raster';

/**
 * Desenfoque de caja separable con radio entero. En los bordes promedia sólo los píxeles existentes
 * (no oscurece ni replica). Radio 0 devuelve una copia. Afecta también al canal alpha.
 */
export function blurBox(r: Raster, radius: number): Raster {
  const rad = Math.max(0, Math.floor(radius));
  if (rad === 0) return cloneRaster(r);
  const w = r.width;
  const h = r.height;
  const tmp = createRaster(w, h);
  const out = createRaster(w, h);
  // Pasada horizontal.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rad);
      const x1 = Math.min(w - 1, x + rad);
      const count = x1 - x0 + 1;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let sx = x0; sx <= x1; sx++) sum += r.data[(y * w + sx) * 4 + c]!;
        tmp.data[o + c] = clampByte(sum / count);
      }
    }
  }
  // Pasada vertical.
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rad);
    const y1 = Math.min(h - 1, y + rad);
    const count = y1 - y0 + 1;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let sy = y0; sy <= y1; sy++) sum += tmp.data[(sy * w + x) * 4 + c]!;
        out.data[o + c] = clampByte(sum / count);
      }
    }
  }
  return out;
}

/** Máscara de desenfoque con kernel 3×3: `out = in + amount·(in − blur3x3(in))`. Alpha intacto. */
export function sharpen(r: Raster, amount: number): Raster {
  if (amount === 0) return cloneRaster(r);
  const blurred = blurBox(r, 1);
  const out = createRaster(r.width, r.height);
  const src = r.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = src[i + c]!;
      dst[i + c] = clampByte(v + amount * (v - blurred.data[i + c]!));
    }
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Viñeta radial: atenúa según la distancia normalizada al centro al cuadrado (esquinas = 1). `strength` 0..1. */
export function vignette(r: Raster, strength: number): Raster {
  if (strength === 0) return cloneRaster(r);
  const out = createRaster(r.width, r.height);
  const cx = r.width / 2;
  const cy = r.height / 2;
  const src = r.data;
  const dst = out.data;
  for (let y = 0; y < r.height; y++) {
    const ny = (y + 0.5 - cy) / cy;
    for (let x = 0; x < r.width; x++) {
      const nx = (x + 0.5 - cx) / cx;
      const d2 = (nx * nx + ny * ny) / 2;
      const factor = 1 - strength * d2;
      const i = (y * r.width + x) * 4;
      dst[i] = clampByte(src[i]! * factor);
      dst[i + 1] = clampByte(src[i + 1]! * factor);
      dst[i + 2] = clampByte(src[i + 2]! * factor);
      dst[i + 3] = src[i + 3]!;
    }
  }
  return out;
}

export type EllipseSpec = { cx: number; cy: number; rx: number; ry: number };

/** Elipse por defecto: cubre cabeza y hombros de una foto documental centrada. Valores normalizados 0..1. */
export const DEFAULT_SUBJECT_ELLIPSE: EllipseSpec = { cx: 0.5, cy: 0.5, rx: 0.42, ry: 0.47 };

/**
 * Aclara el fondo: mueve hacia blanco sólo los píxeles fuera de una elipse central, con un borde suave
 * (transición entre 1.0 y 1.2 radios). Es una aproximación local sin segmentación; la segmentación real
 * es trabajo del puerto de IA.
 */
export function backgroundLighten(r: Raster, amount: number, ellipse: EllipseSpec = DEFAULT_SUBJECT_ELLIPSE): Raster {
  if (amount === 0) return cloneRaster(r);
  const out = createRaster(r.width, r.height);
  const cx = ellipse.cx * r.width;
  const cy = ellipse.cy * r.height;
  const rx = Math.max(1e-6, ellipse.rx * r.width);
  const ry = Math.max(1e-6, ellipse.ry * r.height);
  const src = r.data;
  const dst = out.data;
  for (let y = 0; y < r.height; y++) {
    const dy = (y + 0.5 - cy) / ry;
    for (let x = 0; x < r.width; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const d = Math.sqrt(dx * dx + dy * dy);
      const t = d <= 1 ? 0 : d >= 1.2 ? 1 : (d - 1) / 0.2;
      const mask = t * t * (3 - 2 * t);
      const k = amount * mask;
      const i = (y * r.width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = src[i + c]!;
        dst[i + c] = clampByte(v + (255 - v) * k);
      }
      dst[i + 3] = src[i + 3]!;
    }
  }
  return out;
}
