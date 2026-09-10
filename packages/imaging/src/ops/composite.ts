import { clampByte, cloneRaster, intersectRect, normalizeRect, parseColor, rasterBounds } from '../raster';
import type { Raster, Rect, RGBA } from '../raster';

/** Compone `overlay` sobre `base` en el lugar (alpha over, con `opacity` global). Recorta a los límites de `base`. */
export function blendInto(base: Raster, overlay: Raster, x: number, y: number, opacity = 1): void {
  const ox = Math.round(x);
  const oy = Math.round(y);
  const op = opacity < 0 ? 0 : opacity > 1 ? 1 : opacity;
  if (op === 0) return;
  const region = intersectRect({ x: ox, y: oy, w: overlay.width, h: overlay.height }, rasterBounds(base));
  if (!region) return;
  for (let yy = region.y; yy < region.y + region.h; yy++) {
    for (let xx = region.x; xx < region.x + region.w; xx++) {
      const si = ((yy - oy) * overlay.width + (xx - ox)) * 4;
      const a = (overlay.data[si + 3]! / 255) * op;
      if (a === 0) continue;
      const bi = (yy * base.width + xx) * 4;
      const ba = base.data[bi + 3]! / 255;
      const outA = a + ba * (1 - a);
      if (outA === 0) continue;
      for (let c = 0; c < 3; c++) {
        const oc = overlay.data[si + c]!;
        const bc = base.data[bi + c]!;
        base.data[bi + c] = clampByte((oc * a + bc * ba * (1 - a)) / outA);
      }
      base.data[bi + 3] = clampByte(outA * 255);
    }
  }
}

/** Alpha over de `overlay` sobre `base` en (x, y) con opacidad 0..1. Devuelve un Raster nuevo del tamaño de `base`. */
export function blend(base: Raster, overlay: Raster, x: number, y: number, opacity = 1): Raster {
  const out = cloneRaster(base);
  blendInto(out, overlay, x, y, opacity);
  return out;
}

/** Rellena un rect en el lugar. Color opaco: escribe; con alpha: compone. */
export function fillRectInto(r: Raster, rect: Rect, color: RGBA): void {
  const region = intersectRect(normalizeRect(rect), rasterBounds(r));
  if (!region) return;
  const [cr, cg, cb, ca] = color;
  if (ca === 0) return;
  if (ca >= 255) {
    for (let y = region.y; y < region.y + region.h; y++) {
      let i = (y * r.width + region.x) * 4;
      for (let x = 0; x < region.w; x++) {
        r.data[i] = cr;
        r.data[i + 1] = cg;
        r.data[i + 2] = cb;
        r.data[i + 3] = 255;
        i += 4;
      }
    }
    return;
  }
  const a = ca / 255;
  for (let y = region.y; y < region.y + region.h; y++) {
    let i = (y * r.width + region.x) * 4;
    for (let x = 0; x < region.w; x++) {
      const ba = r.data[i + 3]! / 255;
      const outA = a + ba * (1 - a);
      r.data[i] = clampByte((cr * a + r.data[i]! * ba * (1 - a)) / outA);
      r.data[i + 1] = clampByte((cg * a + r.data[i + 1]! * ba * (1 - a)) / outA);
      r.data[i + 2] = clampByte((cb * a + r.data[i + 2]! * ba * (1 - a)) / outA);
      r.data[i + 3] = clampByte(outA * 255);
      i += 4;
    }
  }
}

/** Rellena un rect con un color (cadena CSS o RGBA). Devuelve un Raster nuevo. */
export function fillRect(r: Raster, rect: Rect, color: string | RGBA): Raster {
  const out = cloneRaster(r);
  fillRectInto(out, rect, parseColor(color));
  return out;
}
