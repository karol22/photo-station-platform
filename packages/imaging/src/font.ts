import { CHAR_ALIASES, FALLBACK_GLYPH, GLYPHS } from './font-data';
import { cloneRaster, parseColor, rectContains } from './raster';
import type { Raster, Rect, RGBA } from './raster';

export const FONT_GLYPH_WIDTH = 5;
export const FONT_GLYPH_HEIGHT = 7;
/** Avance horizontal por carácter (5 de glifo + 1 de separación), en unidades de escala. */
export const FONT_ADVANCE = 6;
/** Avance vertical entre líneas (7 de glifo + 2 de separación), en unidades de escala. */
export const FONT_LINE_HEIGHT = 9;

const bitmapCache = new Map<string, Uint8Array>();

function toBitmap(rows: readonly string[]): Uint8Array {
  const bits = new Uint8Array(FONT_GLYPH_HEIGHT);
  for (let y = 0; y < FONT_GLYPH_HEIGHT; y++) {
    const row = rows[y] ?? '';
    let mask = 0;
    for (let x = 0; x < FONT_GLYPH_WIDTH; x++) if (row[x] === '#') mask |= 1 << x;
    bits[y] = mask;
  }
  return bits;
}

/** Devuelve el bitmap de un carácter: directo, por alias, por descomposición de acentos (à → a) o la caja de reserva. */
export function glyphFor(ch: string): Uint8Array {
  const cached = bitmapCache.get(ch);
  if (cached) return cached;
  let rows = GLYPHS[ch];
  if (!rows) {
    const alias = CHAR_ALIASES[ch];
    if (alias) rows = GLYPHS[alias];
  }
  if (!rows) {
    const stripped = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (stripped.length === 1 && stripped !== ch) rows = GLYPHS[stripped];
  }
  const bitmap = toBitmap(rows ?? FALLBACK_GLYPH);
  bitmapCache.set(ch, bitmap);
  return bitmap;
}

function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Tamaño en píxeles del texto a una escala entera (sin separación después del último carácter ni de la última línea). */
export function measureText(text: string, scale: number): { width: number; height: number } {
  const s = Math.max(1, Math.floor(scale));
  const ls = lines(text);
  let maxChars = 0;
  for (const l of ls) maxChars = Math.max(maxChars, Array.from(l).length);
  const width = maxChars === 0 ? 0 : (maxChars * FONT_ADVANCE - 1) * s;
  const height = ((ls.length - 1) * FONT_LINE_HEIGHT + FONT_GLYPH_HEIGHT) * s;
  return { width, height };
}

export type DrawTextOptions = {
  /** Engrosa cada glifo repitiéndolo desplazado. */
  bold?: boolean;
  /** Recorta el dibujo a este rect (además de a la imagen). */
  clip?: Rect;
};

/** Dibuja texto en el lugar con la fuente bitmap. (x, y) es la esquina superior izquierda de la primera línea. */
export function drawTextInto(r: Raster, text: string, x: number, y: number, scale: number, color: string | RGBA, opts: DrawTextOptions = {}): void {
  const s = Math.max(1, Math.floor(scale));
  const rgba = parseColor(color);
  const [cr, cg, cb, ca] = rgba;
  if (ca === 0) return;
  const boldOffset = opts.bold ? Math.max(1, Math.floor(s / 2)) : 0;
  const clip = opts.clip;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const ls = lines(text);
  for (let li = 0; li < ls.length; li++) {
    const chars = Array.from(ls[li]!);
    const lineY = y0 + li * FONT_LINE_HEIGHT * s;
    for (let ci = 0; ci < chars.length; ci++) {
      const bitmap = glyphFor(chars[ci]!);
      const glyphX = x0 + ci * FONT_ADVANCE * s;
      for (let gy = 0; gy < FONT_GLYPH_HEIGHT; gy++) {
        const mask = bitmap[gy]!;
        if (mask === 0) continue;
        for (let gx = 0; gx < FONT_GLYPH_WIDTH; gx++) {
          if ((mask & (1 << gx)) === 0) continue;
          const px = glyphX + gx * s;
          const py = lineY + gy * s;
          fillBlock(r, px, py, s + boldOffset, s, cr, cg, cb, ca, clip);
        }
      }
    }
  }
}

function fillBlock(r: Raster, px: number, py: number, w: number, h: number, cr: number, cg: number, cb: number, ca: number, clip: Rect | undefined): void {
  const a = ca / 255;
  for (let yy = py; yy < py + h; yy++) {
    if (yy < 0 || yy >= r.height) continue;
    for (let xx = px; xx < px + w; xx++) {
      if (xx < 0 || xx >= r.width) continue;
      if (clip && !rectContains(clip, xx, yy)) continue;
      const i = (yy * r.width + xx) * 4;
      if (ca >= 255) {
        r.data[i] = cr;
        r.data[i + 1] = cg;
        r.data[i + 2] = cb;
        r.data[i + 3] = 255;
      } else {
        const ba = r.data[i + 3]! / 255;
        const outA = a + ba * (1 - a);
        r.data[i] = Math.round((cr * a + r.data[i]! * ba * (1 - a)) / outA);
        r.data[i + 1] = Math.round((cg * a + r.data[i + 1]! * ba * (1 - a)) / outA);
        r.data[i + 2] = Math.round((cb * a + r.data[i + 2]! * ba * (1 - a)) / outA);
        r.data[i + 3] = Math.round(outA * 255);
      }
    }
  }
}

/** Versión pura de `drawTextInto`: devuelve un Raster nuevo. */
export function drawText(r: Raster, text: string, x: number, y: number, scale: number, color: string | RGBA, opts: DrawTextOptions = {}): Raster {
  const out = cloneRaster(r);
  drawTextInto(out, text, x, y, scale, color, opts);
  return out;
}
