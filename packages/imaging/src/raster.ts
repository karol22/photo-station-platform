/**
 * Raster RGBA de 8 bits. Es el único tipo de imagen del paquete: compatible con `ImageData`
 * (mismo layout `[r,g,b,a,...]` por filas), pero sin depender del DOM.
 */

export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export type RGBA = [r: number, g: number, b: number, a: number];
export type Rect = { x: number; y: number; w: number; h: number };
export type Fit = 'cover' | 'contain';

export const WHITE: RGBA = [255, 255, 255, 255];
export const BLACK: RGBA = [0, 0, 0, 255];
export const TRANSPARENT: RGBA = [0, 0, 0, 0];

/** Redondeo half-up y recorte a 0..255. Se aplica explícitamente para que el resultado no dependa del redondeo interno del búfer. */
export function clampByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return Math.round(v);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function assertSize(width: number, height: number, where: string): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error(`${where}: invalid size ${width}x${height}`);
  }
}

export function createRaster(width: number, height: number, fill?: RGBA): Raster {
  const w = Math.floor(width);
  const h = Math.floor(height);
  assertSize(w, h, 'createRaster');
  const data = new Uint8ClampedArray(w * h * 4);
  if (fill) {
    const [r, g, b, a] = fill;
    if (r !== 0 || g !== 0 || b !== 0 || a !== 0) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
  }
  return { width: w, height: h, data };
}

export function cloneRaster(r: Raster): Raster {
  return { width: r.width, height: r.height, data: new Uint8ClampedArray(r.data) };
}

/** Lee un píxel. Fuera de rango lanza `RangeError` (es un error de programación, no un dato). */
export function getPixel(r: Raster, x: number, y: number): RGBA {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height || !Number.isInteger(x) || !Number.isInteger(y)) {
    throw new RangeError(`getPixel: (${x},${y}) outside ${r.width}x${r.height}`);
  }
  const i = (y * r.width + x) * 4;
  return [r.data[i]!, r.data[i + 1]!, r.data[i + 2]!, r.data[i + 3]!];
}

/** Escribe un píxel en el lugar. Fuera de rango no hace nada (permite dibujar sin recortar a mano). */
export function setPixel(r: Raster, x: number, y: number, color: RGBA): void {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return;
  const i = (y * r.width + x) * 4;
  r.data[i] = clampByte(color[0]);
  r.data[i + 1] = clampByte(color[1]);
  r.data[i + 2] = clampByte(color[2]);
  r.data[i + 3] = clampByte(color[3]);
}

const NAMED_COLORS: Record<string, RGBA> = {
  black: [0, 0, 0, 255],
  white: [255, 255, 255, 255],
  transparent: [0, 0, 0, 0],
  red: [255, 0, 0, 255],
  green: [0, 128, 0, 255],
  blue: [0, 0, 255, 255],
  gray: [128, 128, 128, 255],
  grey: [128, 128, 128, 255],
};

/**
 * Interpreta un color. Acepta `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb(r,g,b)`, `rgba(r,g,b,a)`
 * (alpha 0..1) y los nombres `black`, `white`, `transparent`, `red`, `green`, `blue`, `gray`.
 * Con `fallback` devuelve ese color ante una entrada inválida; sin él, lanza.
 */
export function parseColor(input: string | RGBA, fallback?: RGBA): RGBA {
  if (Array.isArray(input)) {
    return [clampByte(input[0]), clampByte(input[1]), clampByte(input[2]), clampByte(input[3])];
  }
  const parsed = parseColorString(input);
  if (parsed) return parsed;
  if (fallback) return [...fallback];
  throw new Error(`parseColor: invalid color "${input}"`);
}

function parseColorString(raw: string): RGBA | undefined {
  const s = raw.trim().toLowerCase();
  const named = NAMED_COLORS[s];
  if (named) return [...named];
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (!/^[0-9a-f]+$/.test(hex)) return undefined;
    if (hex.length === 3 || hex.length === 4) {
      const n = (i: number) => parseInt(hex[i]! + hex[i]!, 16);
      return [n(0), n(1), n(2), hex.length === 4 ? n(3) : 255];
    }
    if (hex.length === 6 || hex.length === 8) {
      const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
      return [n(0), n(2), n(4), hex.length === 8 ? n(6) : 255];
    }
    return undefined;
  }
  const m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (m) {
    const parts = m[1]!.split(/[\s,/]+/).filter((p) => p.length > 0);
    if (parts.length !== 3 && parts.length !== 4) return undefined;
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n))) return undefined;
    const a = parts.length === 4 ? clampByte(nums[3]! * 255) : 255;
    return [clampByte(nums[0]!), clampByte(nums[1]!), clampByte(nums[2]!), a];
  }
  return undefined;
}

/** Rect con bordes enteros: redondea x0/y0 y x1/y1 (no x y w por separado) para que rects vecinos sigan siendo adyacentes. */
export function normalizeRect(rect: Rect): Rect {
  const x0 = Math.round(rect.x);
  const y0 = Math.round(rect.y);
  const x1 = Math.round(rect.x + rect.w);
  const y1 = Math.round(rect.y + rect.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function intersectRect(a: Rect, b: Rect): Rect | undefined {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) return undefined;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function rasterBounds(r: Raster): Rect {
  return { x: 0, y: 0, w: r.width, h: r.height };
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

/** Luma Rec.709 en coma flotante (sin redondear). */
export function luma709(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
