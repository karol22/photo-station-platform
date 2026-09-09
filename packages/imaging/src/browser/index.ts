/**
 * `@psp/imaging/browser`: el único módulo que toca DOM/canvas. Convierte entre fuentes de imagen del navegador
 * y `Raster`, y renderiza un `RenderPlan` con `CanvasRenderingContext2D` usando fuentes reales. Usa la misma
 * geometría (cover/contain, marcas de corte, QR de sustitución) que el renderizador puro.
 */
import type { Id } from '@psp/contracts';
import { cutMarkBoxes, cutMarkThickness, fitRect, qrLayout, qrPlaceholderModules } from '../primitives';
import type { LogoRole, Primitive, RenderPlan } from '../primitives';
import type { Raster, Rect } from '../raster';

export type CanvasSources = {
  photos: CanvasImageSource[];
  assets?: Record<Id, CanvasImageSource>;
  logos?: Partial<Record<LogoRole, CanvasImageSource>>;
  /** Familia genérica que se añade tras la fuente de cada texto (por defecto `sans-serif`). Las fuentes de la plantilla deben estar cargadas (FontFace) antes de renderizar. */
  fontFallback?: string;
};

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function scratchContext(width: number, height: number): Context2D {
  if (typeof OffscreenCanvas !== 'undefined') {
    const ctx = new OffscreenCanvas(width, height).getContext('2d');
    if (ctx) return ctx;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('@psp/imaging/browser: 2D context unavailable');
  return ctx;
}

/** Tamaño natural de una fuente de imagen del navegador. */
export function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const s = source as unknown as Record<string, unknown>;
  if (typeof s['videoWidth'] === 'number' && typeof s['videoHeight'] === 'number') return { width: s['videoWidth'], height: s['videoHeight'] };
  if (typeof s['naturalWidth'] === 'number' && typeof s['naturalHeight'] === 'number' && (s['naturalWidth'] as number) > 0) {
    return { width: s['naturalWidth'] as number, height: s['naturalHeight'] as number };
  }
  if (typeof s['displayWidth'] === 'number' && typeof s['displayHeight'] === 'number') return { width: s['displayWidth'], height: s['displayHeight'] };
  const w = s['width'];
  const h = s['height'];
  if (typeof w === 'number' && typeof h === 'number') return { width: w, height: h };
  const bw = (w as { baseVal?: { value?: number } } | undefined)?.baseVal?.value;
  const bh = (h as { baseVal?: { value?: number } } | undefined)?.baseVal?.value;
  if (typeof bw === 'number' && typeof bh === 'number') return { width: bw, height: bh };
  throw new Error('@psp/imaging/browser: cannot determine source size');
}

/** Dibuja la fuente en un canvas temporal (Offscreen si existe) y devuelve sus píxeles como Raster. */
export function canvasToRaster(source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap | HTMLImageElement, opts: { width?: number; height?: number } = {}): Raster {
  const natural = sourceSize(source);
  const width = Math.max(1, Math.round(opts.width ?? natural.width));
  const height = Math.max(1, Math.round(opts.height ?? natural.height));
  const ctx = scratchContext(width, height);
  ctx.drawImage(source, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  return { width, height, data: new Uint8ClampedArray(img.data) };
}

/** Escribe el Raster en un canvas (nuevo o el dado) con `putImageData`. */
export function rasterToCanvas(r: Raster, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const target = canvas ?? document.createElement('canvas');
  target.width = r.width;
  target.height = r.height;
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('@psp/imaging/browser: 2D context unavailable');
  const img = ctx.createImageData(r.width, r.height);
  img.data.set(r.data);
  ctx.putImageData(img, 0, 0);
  return target;
}

export function rasterToDataUrl(r: Raster, type: 'image/png' | 'image/jpeg' = 'image/png', quality?: number): string {
  return rasterToCanvas(r).toDataURL(type, quality);
}

/** Carga una imagen por URL (misma origen o con CORS) y la devuelve como Raster. */
export function loadRaster(url: string): Promise<Raster> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        resolve(canvasToRaster(img));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    img.onerror = () => reject(new Error(`loadRaster: cannot load ${url}`));
    img.src = url;
  });
}

function roundedRectPath(ctx: CanvasRenderingContext2D, rect: Rect, radius: number): void {
  const r = Math.max(0, Math.min(radius, rect.w / 2, rect.h / 2));
  ctx.beginPath();
  if (r === 0) {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    return;
  }
  const native = (ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, radii: number) => void }).roundRect;
  if (typeof native === 'function') {
    native.call(ctx, rect.x, rect.y, rect.w, rect.h, r);
    ctx.closePath();
    return;
  }
  ctx.moveTo(rect.x + r, rect.y);
  ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, r);
  ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, r);
  ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, r);
  ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r);
  ctx.closePath();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, rect: Rect): void {
  ctx.save();
  ctx.fillStyle = '#E0E0E0';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = '#9E9E9E';
  ctx.lineWidth = Math.max(1, Math.round(Math.min(rect.w, rect.h) / 60));
  ctx.strokeRect(rect.x + ctx.lineWidth / 2, rect.y + ctx.lineWidth / 2, rect.w - ctx.lineWidth, rect.h - ctx.lineWidth);
  ctx.restore();
}

/** Rotación en grados de una primitiva (cualquier ángulo; los múltiplos impares de 90 intercambian ancho y alto al ajustar). */
function drawFitted(ctx: CanvasRenderingContext2D, source: CanvasImageSource, rect: Rect, fit: 'cover' | 'contain', opacity: number, radius: number, rotationDeg: number): void {
  const natural = sourceSize(source);
  const quarter = Math.round(rotationDeg / 90);
  const turned = Math.abs(rotationDeg / 90 - quarter) < 1e-6 && quarter % 2 !== 0;
  const sw = turned ? natural.height : natural.width;
  const sh = turned ? natural.width : natural.height;
  const dest = fitRect(sw, sh, rect, fit);
  ctx.save();
  ctx.globalAlpha = opacity;
  roundedRectPath(ctx, rect, radius);
  ctx.clip();
  if (rotationDeg === 0) {
    ctx.drawImage(source, dest.x, dest.y, dest.w, dest.h);
  } else {
    ctx.translate(dest.x + dest.w / 2, dest.y + dest.h / 2);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    const dw = turned ? dest.h : dest.w;
    const dh = turned ? dest.w : dest.h;
    ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
  }
  ctx.restore();
}

function cssFontFamily(family: string, fallback: string): string {
  const trimmed = family.trim();
  const quoted = /^[a-z-]+$/i.test(trimmed) || trimmed.startsWith('"') || trimmed.startsWith("'") ? trimmed : `"${trimmed.replace(/"/g, '\\"')}"`;
  return quoted === fallback ? quoted : `${quoted}, ${fallback}`;
}

function drawText(ctx: CanvasRenderingContext2D, p: Extract<Primitive, { kind: 'text' }>, fontFallback: string): void {
  if (p.text.length === 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
  ctx.clip();
  if (p.rotationDeg) {
    ctx.translate(p.rect.x + p.rect.w / 2, p.rect.y + p.rect.h / 2);
    ctx.rotate((p.rotationDeg * Math.PI) / 180);
    ctx.translate(-(p.rect.x + p.rect.w / 2), -(p.rect.y + p.rect.h / 2));
  }
  ctx.font = `${p.style.weight} ${p.style.sizePx}px ${cssFontFamily(p.style.fontFamily, fontFallback)}`;
  ctx.fillStyle = p.style.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = p.style.align;
  const x = p.style.align === 'center' ? p.rect.x + p.rect.w / 2 : p.style.align === 'right' ? p.rect.x + p.rect.w : p.rect.x;
  ctx.fillText(p.text, x, p.rect.y + p.rect.h / 2, p.rect.w);
  ctx.restore();
}

function drawQr(ctx: CanvasRenderingContext2D, p: Extract<Primitive, { kind: 'qr' }>): void {
  const modules = qrPlaceholderModules(p.payload);
  const { modulePx, originX, originY } = qrLayout(p.rect, modules.length);
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(p.rect.x + 0.5, p.rect.y + 0.5, p.rect.w - 1, p.rect.h - 1);
  ctx.fillStyle = '#000000';
  modules.forEach((row: boolean[], y: number) => {
    row.forEach((on: boolean, x: number) => {
      if (on) ctx.fillRect(originX + x * modulePx, originY + y * modulePx, modulePx, modulePx);
    });
  });
  ctx.restore();
}

/** Renderiza el plan en un canvas con fuentes reales. Fotos, activos y logos ausentes se dibujan como marcador gris. */
export function renderPlanToCanvas(plan: RenderPlan, sources: CanvasSources, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const target = canvas ?? document.createElement('canvas');
  target.width = plan.widthPx;
  target.height = plan.heightPx;
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('@psp/imaging/browser: 2D context unavailable');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, plan.widthPx, plan.heightPx);
  const bounds = { w: plan.widthPx, h: plan.heightPx };
  const fontFallback = sources.fontFallback ?? 'sans-serif';
  for (const p of plan.primitives) {
    switch (p.kind) {
      case 'fill':
        ctx.fillStyle = p.color;
        ctx.fillRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
        break;
      case 'photo': {
        const src = sources.photos[p.slotIndex];
        if (!src) {
          drawPlaceholder(ctx, p.rect);
          break;
        }
        drawFitted(ctx, src, p.rect, p.fit, 1, p.radiusPx, p.rotationDeg ?? 0);
        if (p.borderPx > 0) {
          ctx.save();
          ctx.strokeStyle = p.borderColor;
          ctx.lineWidth = p.borderPx;
          roundedRectPath(ctx, { x: p.rect.x + p.borderPx / 2, y: p.rect.y + p.borderPx / 2, w: p.rect.w - p.borderPx, h: p.rect.h - p.borderPx }, Math.max(0, p.radiusPx - p.borderPx / 2));
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'asset': {
        const src = sources.assets?.[p.assetId];
        if (!src) drawPlaceholder(ctx, p.rect);
        else drawFitted(ctx, src, p.rect, p.fit, p.opacity, 0, p.rotationDeg ?? 0);
        break;
      }
      case 'logo': {
        const src = sources.logos?.[p.role];
        if (!src) drawPlaceholder(ctx, p.rect);
        else drawFitted(ctx, src, p.rect, p.fit, 1, 0, p.rotationDeg ?? 0);
        break;
      }
      case 'text':
        drawText(ctx, p, fontFallback);
        break;
      case 'cutMarks':
        ctx.fillStyle = '#000000';
        for (const box of cutMarkBoxes(p.rects, p.lengthPx, cutMarkThickness(plan.dpi), bounds)) ctx.fillRect(box.x, box.y, box.w, box.h);
        break;
      case 'qr':
        drawQr(ctx, p);
        break;
      default:
        break;
    }
  }
  return target;
}
