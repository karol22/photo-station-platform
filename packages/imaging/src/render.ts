/**
 * Renderizador puro: dibuja un `RenderPlan` sobre un Raster blanco. Es la referencia determinista para
 * pruebas, impresión mock y previsualizaciones en Node; el kiosco usa `renderPlanToCanvas` con fuentes reales.
 * Nunca lanza por recursos ausentes: foto, activo o logo que falte se dibuja como marcador gris.
 */
import type { Id } from '@psp/contracts';
import { FONT_GLYPH_HEIGHT, drawTextInto, measureText } from './font';
import { blendInto, fillRectInto } from './ops/composite';
import { crop, resize, rotate90 } from './ops/geometry';
import { cutMarkBoxes, cutMarkThickness, fitRect, qrLayout, qrModules } from './primitives';
import type { LogoRole, Primitive, RenderPlan } from './primitives';
import { BLACK, TRANSPARENT, WHITE, createRaster, intersectRect, parseColor } from './raster';
import type { Fit, RGBA, Raster, Rect } from './raster';

export type RenderSources = {
  photos: Raster[];
  assets?: Record<Id, Raster>;
  logos?: Partial<Record<LogoRole, Raster>>;
};

const PLACEHOLDER_FILL: RGBA = [224, 224, 224, 255];
const PLACEHOLDER_BORDER: RGBA = [158, 158, 158, 255];

/** Escala entera de la fuente bitmap para un tamaño en px (7 px de glifo por unidad). */
export function bitmapTextScale(sizePx: number): number {
  return Math.max(1, Math.floor(sizePx / FONT_GLYPH_HEIGHT));
}

function drawPlaceholder(out: Raster, rect: Rect): void {
  if (rect.w <= 0 || rect.h <= 0) return;
  fillRectInto(out, rect, PLACEHOLDER_FILL);
  const t = Math.max(1, Math.round(Math.min(rect.w, rect.h) / 60));
  strokeRect(out, rect, t, PLACEHOLDER_BORDER);
}

function strokeRect(out: Raster, rect: Rect, thickness: number, color: RGBA): void {
  fillRectInto(out, { x: rect.x, y: rect.y, w: rect.w, h: thickness }, color);
  fillRectInto(out, { x: rect.x, y: rect.y + rect.h - thickness, w: rect.w, h: thickness }, color);
  fillRectInto(out, { x: rect.x, y: rect.y, w: thickness, h: rect.h }, color);
  fillRectInto(out, { x: rect.x + rect.w - thickness, y: rect.y, w: thickness, h: rect.h }, color);
}

/** Múltiplo de 90 más cercano cuando el ángulo lo es (con tolerancia); otros ángulos se ignoran en Node. */
function quarterTurns(rotationDeg: number | undefined): number {
  if (!rotationDeg) return 0;
  const turns = rotationDeg / 90;
  const rounded = Math.round(turns);
  return Math.abs(turns - rounded) < 1e-6 ? ((rounded % 4) + 4) % 4 : 0;
}

/** true si el centro del píxel (x+0.5, y+0.5) cae dentro del rect redondeado `w×h` de radio `r` (origen 0,0). */
function insideRounded(x: number, y: number, w: number, h: number, r: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  if (r <= 0) return true;
  const px = x + 0.5;
  const py = y + 0.5;
  const cx = px < r ? r : px > w - r ? w - r : px;
  const cy = py < r ? r : py > h - r ? h - r : py;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Dibuja `src` ajustado a `rect` (cover recorta centrado; contain deja fondo transparente), con esquinas
 * redondeadas y borde opcionales, y lo compone sobre `out` con la opacidad dada.
 */
function drawFitted(out: Raster, src: Raster, rect: Rect, fit: Fit, opacity: number, radiusPx: number, borderPx: number, borderColor: RGBA): void {
  if (rect.w <= 0 || rect.h <= 0) return;
  const dest = fitRect(src.width, src.height, rect, fit);
  const visible = intersectRect(dest, rect);
  if (!visible) return;
  const scaled = resize(src, dest.w, dest.h);
  const part = visible.w === scaled.width && visible.h === scaled.height ? scaled : crop(scaled, { x: visible.x - dest.x, y: visible.y - dest.y, w: visible.w, h: visible.h });
  const tile = createRaster(rect.w, rect.h, TRANSPARENT);
  blendInto(tile, part, visible.x - rect.x, visible.y - rect.y, 1);

  const radius = Math.max(0, Math.min(radiusPx, rect.w / 2, rect.h / 2));
  const border = Math.max(0, Math.min(Math.round(borderPx), Math.floor(rect.w / 2), Math.floor(rect.h / 2)));
  if (radius > 0 || border > 0) {
    const innerRadius = Math.max(0, radius - border);
    for (let y = 0; y < rect.h; y++) {
      for (let x = 0; x < rect.w; x++) {
        const i = (y * rect.w + x) * 4;
        if (!insideRounded(x, y, rect.w, rect.h, radius)) {
          tile.data[i + 3] = 0;
          continue;
        }
        if (border > 0 && !insideRounded(x - border, y - border, rect.w - 2 * border, rect.h - 2 * border, innerRadius)) {
          tile.data[i] = borderColor[0];
          tile.data[i + 1] = borderColor[1];
          tile.data[i + 2] = borderColor[2];
          tile.data[i + 3] = borderColor[3];
        }
      }
    }
  }
  blendInto(out, tile, rect.x, rect.y, opacity);
}

function drawText(out: Raster, p: Extract<Primitive, { kind: 'text' }>): void {
  if (p.text.length === 0 || p.rect.w <= 0 || p.rect.h <= 0) return;
  const unit = measureText(p.text, 1);
  let scale = bitmapTextScale(p.style.sizePx);
  scale = Math.min(scale, Math.floor(p.rect.h / unit.height), unit.width > 0 ? Math.floor(p.rect.w / unit.width) : scale);
  scale = Math.max(1, scale);
  const size = measureText(p.text, scale);
  const x = p.style.align === 'center' ? p.rect.x + (p.rect.w - size.width) / 2 : p.style.align === 'right' ? p.rect.x + p.rect.w - size.width : p.rect.x;
  const y = p.rect.y + (p.rect.h - size.height) / 2;
  drawTextInto(out, p.text, x, y, scale, parseColor(p.style.color, BLACK), { bold: p.style.weight === 'bold', clip: p.rect });
}

function drawQr(out: Raster, p: Extract<Primitive, { kind: 'qr' }>, dpi: number): void {
  if (p.rect.w <= 0 || p.rect.h <= 0) return;
  fillRectInto(out, p.rect, WHITE);
  strokeRect(out, p.rect, cutMarkThickness(dpi), BLACK);
  // Matriz real; `qrModules` cae al patrón de sustitución si el payload no cabe en la versión máxima.
  const modules = qrModules(p.payload);
  const { modulePx, originX, originY } = qrLayout(p.rect, modules.length);
  modules.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) fillRectInto(out, { x: originX + x * modulePx, y: originY + y * modulePx, w: modulePx, h: modulePx }, BLACK);
    });
  });
}

/** Renderiza el plan sobre un Raster blanco del tamaño del plan. Puro: mismo plan y fuentes, mismos píxeles. */
export function renderPlan(plan: RenderPlan, sources: RenderSources): Raster {
  const out = createRaster(Math.max(1, plan.widthPx), Math.max(1, plan.heightPx), WHITE);
  const bounds = { w: out.width, h: out.height };
  for (const p of plan.primitives) {
    switch (p.kind) {
      case 'fill':
        fillRectInto(out, p.rect, parseColor(p.color, WHITE));
        break;
      case 'photo': {
        const src = sources.photos[p.slotIndex];
        if (!src) {
          drawPlaceholder(out, p.rect);
          break;
        }
        const turns = quarterTurns(p.rotationDeg);
        drawFitted(out, turns === 0 ? src : rotate90(src, turns), p.rect, p.fit, 1, p.radiusPx, p.borderPx, parseColor(p.borderColor, WHITE));
        break;
      }
      case 'asset': {
        const src = sources.assets?.[p.assetId];
        if (!src) drawPlaceholder(out, p.rect);
        else {
          const turns = quarterTurns(p.rotationDeg);
          drawFitted(out, turns === 0 ? src : rotate90(src, turns), p.rect, p.fit, p.opacity, 0, 0, WHITE);
        }
        break;
      }
      case 'logo': {
        const src = sources.logos?.[p.role];
        if (!src) drawPlaceholder(out, p.rect);
        else {
          const turns = quarterTurns(p.rotationDeg);
          drawFitted(out, turns === 0 ? src : rotate90(src, turns), p.rect, p.fit, 1, 0, 0, WHITE);
        }
        break;
      }
      case 'text':
        drawText(out, p);
        break;
      case 'cutMarks':
        for (const box of cutMarkBoxes(p.rects, p.lengthPx, cutMarkThickness(plan.dpi), bounds)) fillRectInto(out, box, BLACK);
        break;
      case 'qr':
        drawQr(out, p, plan.dpi);
        break;
      default:
        break;
    }
  }
  return out;
}
