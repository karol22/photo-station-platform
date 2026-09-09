/**
 * Métricas de calidad de frame sobre píxeles RGBA. Puro, sin DOM. Submuestrea la imagen en una
 * rejilla (paso 2..8 px según tamaño; 3 px en 640×480) y calcula todo sobre la luminancia de la rejilla.
 *
 * Normalizaciones (documentadas para calibrar umbrales por cámara):
 * - brightness: luminancia media / 255.
 * - contrast: desviación estándar de la luminancia / 128 (una imagen bitonal 0/255 da ≈ 1).
 * - sharpness: varianza del laplaciano de 4 vecinos sobre la rejilla, en la zona del rostro (o el
 *   centro del frame). Depende del paso de muestreo; los umbrales se calibran con la cámara real.
 * - backgroundUniformity: 1 − std/64 en las franjas laterales fuera de la caja del rostro (hasta la
 *   barbilla). Sin franjas visibles (rostro que llena el frame) vale 1.
 * - glare: proporción de muestras casi saturadas (Y ≥ 245) en la zona de ojos de la caja.
 * - faceBrightness (con caja): luminancia media del interior del rostro / 255.
 * - shadowAsymmetry (con caja): |mediaIzq − mediaDer| / max(medias) en el interior del rostro.
 */
import type { Box, FrameMetrics, ImageDataLike } from './types';
import { clamp, clamp01 } from './util';

export interface FrameMetricsOptions {
  /** Paso de muestreo en px. Por defecto se deriva del tamaño del frame. */
  step?: number;
}

/** Métricas de un frame ideal: las devuelve el mock cuando no hay píxeles. */
export const IDEAL_FRAME_METRICS: FrameMetrics = {
  brightness: 0.6,
  contrast: 0.45,
  sharpness: 200,
  backgroundUniformity: 0.95,
  glare: 0,
  faceBrightness: 0.55,
  shadowAsymmetry: 0.03,
};

const GLARE_LEVEL = 245;
const CONTRAST_NORM = 128;
const BACKGROUND_NORM = 64;

export function autoSampleStep(width: number, height: number): number {
  return clamp(Math.round(Math.max(width, height) / 240), 2, 8);
}

interface Grid {
  lum: Float32Array;
  gw: number;
  gh: number;
  step: number;
}

/** Rectángulo en coordenadas de rejilla [x0, x1) × [y0, y1), recortado a la rejilla. */
interface GridRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function toGridRect(g: Grid, x0: number, y0: number, x1: number, y1: number): GridRect {
  return {
    x0: clamp(Math.floor(x0 / g.step), 0, g.gw),
    y0: clamp(Math.floor(y0 / g.step), 0, g.gh),
    x1: clamp(Math.ceil(x1 / g.step), 0, g.gw),
    y1: clamp(Math.ceil(y1 / g.step), 0, g.gh),
  };
}

interface Stats {
  n: number;
  mean: number;
  std: number;
}

function stats(g: Grid, rects: GridRect[]): Stats {
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (const r of rects) {
    for (let y = r.y0; y < r.y1; y++) {
      const row = y * g.gw;
      for (let x = r.x0; x < r.x1; x++) {
        const v = g.lum[row + x] ?? 0;
        n++;
        sum += v;
        sumSq += v * v;
      }
    }
  }
  if (n === 0) return { n: 0, mean: 0, std: 0 };
  const mean = sum / n;
  return { n, mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

function laplacianVariance(g: Grid, r: GridRect): number {
  const x0 = Math.max(1, r.x0);
  const y0 = Math.max(1, r.y0);
  const x1 = Math.min(g.gw - 1, r.x1);
  const y1 = Math.min(g.gh - 1, r.y1);
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * g.gw;
    for (let x = x0; x < x1; x++) {
      const c = g.lum[row + x] ?? 0;
      const up = g.lum[row - g.gw + x] ?? 0;
      const down = g.lum[row + g.gw + x] ?? 0;
      const left = g.lum[row + x - 1] ?? 0;
      const right = g.lum[row + x + 1] ?? 0;
      const lap = 4 * c - up - down - left - right;
      n++;
      sum += lap;
      sumSq += lap * lap;
    }
  }
  if (n < 2) return 0;
  const mean = sum / n;
  return Math.max(0, sumSq / n - mean * mean);
}

function saturatedRatio(g: Grid, r: GridRect): number {
  let n = 0;
  let hot = 0;
  for (let y = r.y0; y < r.y1; y++) {
    const row = y * g.gw;
    for (let x = r.x0; x < r.x1; x++) {
      n++;
      if ((g.lum[row + x] ?? 0) >= GLARE_LEVEL) hot++;
    }
  }
  return n === 0 ? 0 : hot / n;
}

function buildGrid(img: ImageDataLike, step: number): Grid {
  const { width, height, data } = img;
  const gw = Math.ceil(width / step);
  const gh = Math.ceil(height / step);
  const lum = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const py = gy * step;
    for (let gx = 0; gx < gw; gx++) {
      const i = (py * width + gx * step) * 4;
      lum[gy * gw + gx] = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
    }
  }
  return { lum, gw, gh, step };
}

/** Métricas de un frame. Con `faceBox` (normalizada 0..1) las zonas se derivan del rostro. */
export function computeFrameMetrics(
  img: ImageDataLike,
  faceBox?: Box,
  opts: FrameMetricsOptions = {},
): FrameMetrics {
  const { width: w, height: h, data } = img;
  if (w <= 0 || h <= 0 || data.length === 0) {
    return { brightness: 0, contrast: 0, sharpness: 0, backgroundUniformity: 1, glare: 0 };
  }
  if (data.length < w * h * 4) {
    throw new Error(`computeFrameMetrics: data tiene ${data.length} bytes; se esperaban ${w * h * 4}`);
  }
  const step = Math.max(1, Math.floor(opts.step ?? autoSampleStep(w, h)));
  const g = buildGrid(img, step);

  const all = stats(g, [{ x0: 0, y0: 0, x1: g.gw, y1: g.gh }]);
  const brightness = clamp01(all.mean / 255);
  const contrast = clamp01(all.std / CONTRAST_NORM);

  // Zona del rostro en px: la caja, o el tercio central del frame.
  const fx0 = faceBox ? faceBox.x * w : w / 3;
  const fy0 = faceBox ? faceBox.y * h : h / 4;
  const fx1 = faceBox ? (faceBox.x + faceBox.w) * w : (2 * w) / 3;
  const fy1 = faceBox ? (faceBox.y + faceBox.h) * h : (3 * h) / 4;
  const fw = fx1 - fx0;
  const fh = fy1 - fy0;

  const sharpness = laplacianVariance(g, toGridRect(g, fx0, fy0, fx1, fy1));

  // Zona de ojos: franja al 30–58 % del alto de la caja (la caja empieza en la frente, no en la coronilla).
  const eyeZone = faceBox
    ? toGridRect(g, fx0 + 0.15 * fw, fy0 + 0.3 * fh, fx0 + 0.85 * fw, fy0 + 0.58 * fh)
    : toGridRect(g, fx0, fy0, fx1, fy1);
  const glare = saturatedRatio(g, eyeZone);

  // Fondo: franjas laterales fuera de la caja (con 15 % de margen para el cabello), hasta la barbilla.
  const bgLeft = faceBox
    ? toGridRect(g, 0, 0, fx0 - 0.15 * fw, fy1)
    : toGridRect(g, 0, 0, 0.2 * w, 0.6 * h);
  const bgRight = faceBox
    ? toGridRect(g, fx1 + 0.15 * fw, 0, w, fy1)
    : toGridRect(g, 0.8 * w, 0, w, 0.6 * h);
  const bg = stats(g, [bgLeft, bgRight]);
  const backgroundUniformity = bg.n === 0 ? 1 : 1 - clamp01(bg.std / BACKGROUND_NORM);

  const metrics: FrameMetrics = { brightness, contrast, sharpness, backgroundUniformity, glare };

  if (faceBox) {
    const ix0 = fx0 + 0.15 * fw;
    const ix1 = fx1 - 0.15 * fw;
    const iy0 = fy0 + 0.15 * fh;
    const iy1 = fy1 - 0.15 * fh;
    const inner = stats(g, [toGridRect(g, ix0, iy0, ix1, iy1)]);
    if (inner.n > 0) {
      metrics.faceBrightness = clamp01(inner.mean / 255);
      const mid = (ix0 + ix1) / 2;
      const left = stats(g, [toGridRect(g, ix0, iy0, mid, iy1)]);
      const right = stats(g, [toGridRect(g, mid, iy0, ix1, iy1)]);
      if (left.n > 0 && right.n > 0) {
        metrics.shadowAsymmetry = clamp01(Math.abs(left.mean - right.mean) / Math.max(left.mean, right.mean, 1));
      }
    }
  }
  return metrics;
}
