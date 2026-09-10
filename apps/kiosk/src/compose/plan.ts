/**
 * Adaptador de composición: única puerta del kiosco hacia `planTemplate`/`planDocumentSheet` de
 * `@psp/imaging` y `renderPlanToCanvas` de `@psp/imaging/browser`. Si el paquete no expone alguna
 * función en tiempo de ejecución, se usa un plan mínimo (fotos en rejilla) para no bloquear la
 * sesión; el resultado se marca con `fallback: true` y la pantalla lo muestra como advertencia.
 */
import type { LocaleCode, PrintTemplate } from '@psp/contracts';
import * as imaging from '@psp/imaging';
import type { RenderPlan } from '@psp/imaging';
import { renderPlanToCanvas as renderToCanvas, type CanvasSources } from '@psp/imaging/browser';

export interface ComposePlan {
  plan: RenderPlan;
  /** Copias que caben por hoja (documento) o 1 (plantilla creativa). */
  fitted: number;
  /** Hojas necesarias para las copias pedidas. */
  sheets: number;
  fallback: boolean;
}

export function mmToPx(mm: number, dpi: number): number {
  return typeof imaging.mmToPx === 'function' ? imaging.mmToPx(mm, dpi) : Math.round((mm / 25.4) * dpi);
}

export function planForTemplate(
  template: PrintTemplate,
  ctx: { locale: LocaleCode; tokens: Record<string, string>; photoCount: number; dpi?: number },
): ComposePlan {
  if (typeof imaging.planTemplate === 'function') {
    const plan = imaging.planTemplate(template, { locale: ctx.locale, tokens: ctx.tokens, photoCount: ctx.photoCount, ...(ctx.dpi ? { dpi: ctx.dpi } : {}), selector: { locale: ctx.locale, paperSize: template.paperSize, orientation: template.orientation } });
    return { plan, fitted: 1, sheets: 1, fallback: false };
  }
  return { plan: gridPlan(template, ctx.photoCount, ctx.dpi ?? template.canvas.dpi), fitted: 1, sheets: 1, fallback: true };
}

export function planForDocument(
  template: PrintTemplate,
  photo: { widthMm: number; heightMm: number },
  copies: number,
  opts: { cutMarks?: boolean; dpi?: number },
): ComposePlan {
  if (typeof imaging.planDocumentSheet === 'function') {
    const result = imaging.planDocumentSheet(template, photo, copies, { ...(opts.cutMarks !== undefined ? { cutMarks: opts.cutMarks } : {}), ...(opts.dpi ? { dpi: opts.dpi } : {}) });
    return { plan: result.plan, fitted: result.fitted, sheets: result.sheets, fallback: false };
  }
  const dpi = opts.dpi ?? template.canvas.dpi;
  const cols = Math.max(1, Math.floor(template.canvas.widthMm / (photo.widthMm + 2)));
  const rows = Math.max(1, Math.floor(template.canvas.heightMm / (photo.heightMm + 2)));
  const fitted = cols * rows;
  const primitives: RenderPlan['primitives'] = [];
  for (let i = 0; i < Math.min(copies, fitted); i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    primitives.push({ kind: 'photo', rect: { x: mmToPx(2 + c * (photo.widthMm + 2), dpi), y: mmToPx(2 + r * (photo.heightMm + 2), dpi), w: mmToPx(photo.widthMm, dpi), h: mmToPx(photo.heightMm, dpi) }, slotIndex: 0, fit: 'cover', radiusPx: 0, borderPx: 0, borderColor: '#FFFFFF' } as RenderPlan['primitives'][number]);
  }
  return { plan: { widthPx: mmToPx(template.canvas.widthMm, dpi), heightPx: mmToPx(template.canvas.heightMm, dpi), dpi, primitives }, fitted, sheets: Math.max(1, Math.ceil(copies / fitted)), fallback: true };
}

export function renderPlanToCanvas(plan: RenderPlan, sources: CanvasSources, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  return renderToCanvas(plan, sources, canvas);
}

function gridPlan(template: PrintTemplate, photoCount: number, dpi: number): RenderPlan {
  const widthPx = mmToPx(template.canvas.widthMm, dpi);
  const heightPx = mmToPx(template.canvas.heightMm, dpi);
  const n = Math.max(1, Math.min(photoCount, template.photoSlots || photoCount));
  const gap = mmToPx(3, dpi);
  const cellH = Math.floor((heightPx - gap * (n + 1)) / n);
  const primitives: RenderPlan['primitives'] = [];
  for (let i = 0; i < n; i++) {
    primitives.push({ kind: 'photo', rect: { x: gap, y: gap + i * (cellH + gap), w: widthPx - gap * 2, h: cellH }, slotIndex: i, fit: 'cover', radiusPx: 0, borderPx: 0, borderColor: '#FFFFFF' } as RenderPlan['primitives'][number]);
  }
  return { widthPx, heightPx, dpi, primitives };
}
