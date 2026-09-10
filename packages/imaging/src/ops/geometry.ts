import { cloneRaster, createRaster, clampByte, intersectRect, normalizeRect, rasterBounds, WHITE } from '../raster';
import type { Raster, Rect, RGBA } from '../raster';

/** Recorte exacto. El rect se redondea a enteros y se intersecta con la imagen; si queda vacío, lanza. */
export function crop(r: Raster, rect: Rect): Raster {
  const target = intersectRect(normalizeRect(rect), rasterBounds(r));
  if (!target) throw new Error(`crop: rect ${JSON.stringify(rect)} outside ${r.width}x${r.height}`);
  const out = createRaster(target.w, target.h);
  const rowBytes = target.w * 4;
  for (let y = 0; y < target.h; y++) {
    const src = ((target.y + y) * r.width + target.x) * 4;
    out.data.set(r.data.subarray(src, src + rowBytes), y * rowBytes);
  }
  return out;
}

/** Reduce a la mitad en X promediando pares de píxeles (la última columna impar se copia). */
function halveX(r: Raster): Raster {
  const w = Math.ceil(r.width / 2);
  const out = createRaster(w, r.height);
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < w; x++) {
      const sx0 = x * 2;
      const sx1 = Math.min(sx0 + 1, r.width - 1);
      const i0 = (y * r.width + sx0) * 4;
      const i1 = (y * r.width + sx1) * 4;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out.data[o + c] = clampByte((r.data[i0 + c]! + r.data[i1 + c]!) / 2);
    }
  }
  return out;
}

function halveY(r: Raster): Raster {
  const h = Math.ceil(r.height / 2);
  const out = createRaster(r.width, h);
  for (let y = 0; y < h; y++) {
    const sy0 = y * 2;
    const sy1 = Math.min(sy0 + 1, r.height - 1);
    for (let x = 0; x < r.width; x++) {
      const i0 = (sy0 * r.width + x) * 4;
      const i1 = (sy1 * r.width + x) * 4;
      const o = (y * r.width + x) * 4;
      for (let c = 0; c < 4; c++) out.data[o + c] = clampByte((r.data[i0 + c]! + r.data[i1 + c]!) / 2);
    }
  }
  return out;
}

type AxisMap = { i0: Int32Array; i1: Int32Array; f: Float64Array };

/** Mapa origen↔destino con centros de píxel alineados: el destino (d+0.5) cae en el origen (d+0.5)·ratio. */
function axisMap(srcSize: number, dstSize: number): AxisMap {
  const i0 = new Int32Array(dstSize);
  const i1 = new Int32Array(dstSize);
  const f = new Float64Array(dstSize);
  const ratio = srcSize / dstSize;
  for (let d = 0; d < dstSize; d++) {
    const s = (d + 0.5) * ratio - 0.5;
    let a = Math.floor(s);
    let frac = s - a;
    if (a < 0) {
      a = 0;
      frac = 0;
    }
    const b = Math.min(a + 1, srcSize - 1);
    i0[d] = a;
    i1[d] = b;
    f[d] = frac;
  }
  return { i0, i1, f };
}

function bilinear(r: Raster, width: number, height: number): Raster {
  const out = createRaster(width, height);
  const xs = axisMap(r.width, width);
  const ys = axisMap(r.height, height);
  const src = r.data;
  const dst = out.data;
  for (let y = 0; y < height; y++) {
    const y0 = ys.i0[y]! * r.width;
    const y1 = ys.i1[y]! * r.width;
    const fy = ys.f[y]!;
    for (let x = 0; x < width; x++) {
      const x0 = xs.i0[x]!;
      const x1 = xs.i1[x]!;
      const fx = xs.f[x]!;
      const p00 = (y0 + x0) * 4;
      const p10 = (y0 + x1) * 4;
      const p01 = (y1 + x0) * 4;
      const p11 = (y1 + x1) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = src[p00 + c]! * (1 - fx) + src[p10 + c]! * fx;
        const bottom = src[p01 + c]! * (1 - fx) + src[p11 + c]! * fx;
        dst[o + c] = clampByte(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return out;
}

/**
 * Redimensiona con interpolación bilineal. Para reducciones mayores a 2× por eje reduce primero a la mitad
 * (promedio 2×2) tantas veces como haga falta: evita el aliasing del muestreo bilineal puro y sigue siendo determinista.
 * Una reducción exacta a la mitad equivale al promedio de cada bloque 2×2.
 */
export function resize(r: Raster, width: number, height: number): Raster {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (w === r.width && h === r.height) return cloneRaster(r);
  let src = r;
  while (src.width >= 2 * w && src.width > 1) src = halveX(src);
  while (src.height >= 2 * h && src.height > 1) src = halveY(src);
  if (src.width === w && src.height === h) return src === r ? cloneRaster(r) : src;
  return bilinear(src, w, h);
}

/** Giro en múltiplos de 90° en sentido horario (`times` negativo gira en sentido antihorario). */
export function rotate90(r: Raster, times: number): Raster {
  const t = ((Math.round(times) % 4) + 4) % 4;
  if (t === 0) return cloneRaster(r);
  const w = r.width;
  const h = r.height;
  const out = t === 2 ? createRaster(w, h) : createRaster(h, w);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      let sx: number;
      let sy: number;
      if (t === 1) {
        sx = y;
        sy = h - 1 - x;
      } else if (t === 2) {
        sx = w - 1 - x;
        sy = h - 1 - y;
      } else {
        sx = w - 1 - y;
        sy = x;
      }
      const si = (sy * w + sx) * 4;
      const oi = (y * out.width + x) * 4;
      out.data[oi] = r.data[si]!;
      out.data[oi + 1] = r.data[si + 1]!;
      out.data[oi + 2] = r.data[si + 2]!;
      out.data[oi + 3] = r.data[si + 3]!;
    }
  }
  return out;
}

function sampleAt(r: Raster, x: number, y: number, c: number, bg: RGBA): number {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return bg[c]!;
  return r.data[(y * r.width + x) * 4 + c]!;
}

/**
 * Giro de pocos grados (nivelación) alrededor del centro, con muestreo bilineal y relleno de fondo en las esquinas.
 * Grados positivos giran en sentido horario (convención CSS `rotate()`); el tamaño de salida es el de entrada.
 * Pensado para ±15°; matemáticamente acepta cualquier ángulo.
 */
export function rotateSmall(r: Raster, degrees: number, background: RGBA = WHITE): Raster {
  if (degrees === 0) return cloneRaster(r);
  const out = createRaster(r.width, r.height);
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = r.width / 2;
  const cy = r.height / 2;
  for (let y = 0; y < r.height; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < r.width; x++) {
      const dx = x + 0.5 - cx;
      const sx = cos * dx + sin * dy + cx - 0.5;
      const sy = -sin * dx + cos * dy + cy - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * r.width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = sampleAt(r, x0, y0, c, background) * (1 - fx) + sampleAt(r, x0 + 1, y0, c, background) * fx;
        const bottom = sampleAt(r, x0, y0 + 1, c, background) * (1 - fx) + sampleAt(r, x0 + 1, y0 + 1, c, background) * fx;
        out.data[o + c] = clampByte(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return out;
}

/** Espejo horizontal (izquierda↔derecha). */
export function mirrorH(r: Raster): Raster {
  const out = createRaster(r.width, r.height);
  const w = r.width;
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + (w - 1 - x)) * 4;
      const oi = (y * w + x) * 4;
      out.data[oi] = r.data[si]!;
      out.data[oi + 1] = r.data[si + 1]!;
      out.data[oi + 2] = r.data[si + 2]!;
      out.data[oi + 3] = r.data[si + 3]!;
    }
  }
  return out;
}
