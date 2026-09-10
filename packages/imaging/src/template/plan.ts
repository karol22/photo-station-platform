/**
 * Planificador: convierte los elementos en mm de una plantilla en primitivas absolutas en píxeles.
 * Es puro y determinista; los tokens (fecha, código de sesión…) llegan ya formateados en `ctx.tokens`.
 */
import type { BoxMm, LocaleCode, PrintTemplate } from '@psp/contracts';
import { mmToPx, mmToPxExact, ptToPx, resolveLocalizedText } from '../primitives';
import type { Primitive, RenderPlan, TemplateElement, TextStylePx, PlanContext } from '../primitives';
import { normalizeRect } from '../raster';
import type { Rect } from '../raster';
import { selectVariant } from './select';

export { mmToPx, mmToPxExact, ptToPx };

export type PlanElementsOptions = {
  dpi: number;
  locale: LocaleCode;
  tokens: Record<string, string>;
  photoCount: number;
};

/** Caja en mm → rect en px con bordes enteros (cajas vecinas siguen siendo adyacentes). */
export function boxToRect(box: BoxMm, dpi: number): Rect {
  return normalizeRect({ x: mmToPxExact(box.x, dpi), y: mmToPxExact(box.y, dpi), w: mmToPxExact(box.w, dpi), h: mmToPxExact(box.h, dpi) });
}

/** Orden de dibujo: zIndex ascendente y, a igual zIndex, orden de aparición. */
export function sortElements(elements: TemplateElement[]): TemplateElement[] {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => (a.element.zIndex ?? 0) - (b.element.zIndex ?? 0) || a.index - b.index)
    .map((e) => e.element);
}

type ElementTextStyle = { fontFamily?: string; sizePt?: number; color?: string; align?: 'left' | 'center' | 'right'; weight?: 'normal' | 'bold' };

function textStyle(style: ElementTextStyle | undefined, dpi: number): TextStylePx {
  return {
    fontFamily: style?.fontFamily ?? 'sans-serif',
    sizePx: Math.max(1, Math.round(ptToPx(style?.sizePt ?? 10, dpi))),
    color: style?.color ?? '#000000',
    align: style?.align ?? 'center',
    weight: style?.weight === 'bold' ? 'bold' : 'normal',
  };
}

function withMeta<T extends Primitive>(primitive: T, element: TemplateElement): T {
  primitive.elementId = element.id;
  const rotation = element.box.rotationDeg ?? 0;
  if (rotation !== 0) primitive.rotationDeg = rotation;
  return primitive;
}

/** Planifica una lista de elementos (ya en el lienzo efectivo) a primitivas en px. */
export function planElements(elements: TemplateElement[], opts: PlanElementsOptions): Primitive[] {
  const { dpi, locale, tokens, photoCount } = opts;
  const ordered = sortElements(elements);
  const photoRects = ordered.filter((e) => e.type === 'photo' && e.slotIndex < photoCount).map((e) => boxToRect(e.box, dpi));
  const out: Primitive[] = [];
  for (const element of ordered) {
    const rect = boxToRect(element.box, dpi);
    switch (element.type) {
      case 'background':
        if (element.color) out.push(withMeta({ kind: 'fill', rect, color: element.color }, element));
        if (element.assetId) out.push(withMeta({ kind: 'asset', rect, assetId: element.assetId, fit: 'cover', opacity: 1 }, element));
        break;
      case 'photo':
        if (element.slotIndex >= photoCount) break;
        out.push(
          withMeta(
            {
              kind: 'photo',
              rect,
              slotIndex: element.slotIndex,
              fit: element.fit ?? 'cover',
              radiusPx: mmToPx(element.cornerRadiusMm ?? 0, dpi),
              borderPx: mmToPx(element.borderMm ?? 0, dpi),
              borderColor: element.borderColor ?? '#FFFFFF',
            },
            element,
          ),
        );
        break;
      case 'text':
      case 'disclaimer':
        out.push(withMeta({ kind: 'text', rect, text: resolveLocalizedText(element.content, locale), style: textStyle(element.style, dpi) }, element));
        break;
      case 'token':
        out.push(withMeta({ kind: 'text', rect, text: tokens[element.token] ?? '', style: textStyle(element.style, dpi) }, element));
        break;
      case 'image':
        out.push(withMeta({ kind: 'asset', rect, assetId: element.assetId, fit: element.fit ?? 'contain', opacity: element.opacity ?? 1 }, element));
        break;
      case 'frame':
        out.push(withMeta({ kind: 'asset', rect, assetId: element.assetId, fit: 'contain', opacity: 1 }, element));
        break;
      case 'logo':
        out.push(withMeta({ kind: 'logo', rect, role: element.role, fit: element.fit ?? 'contain' }, element));
        break;
      case 'qr': {
        const payload = tokens[element.payloadToken];
        out.push(withMeta({ kind: 'qr', rect, payload: payload && payload.length > 0 ? payload : 'placeholder' }, element));
        break;
      }
      case 'cutMarks':
        out.push(withMeta({ kind: 'cutMarks', rects: photoRects, lengthPx: mmToPx(element.lengthMm ?? 3, dpi) }, element));
        break;
      default:
        break;
    }
  }
  return out;
}

/** Plan completo de una plantilla: elige variante, fija el lienzo en px y planifica los elementos. */
export function planTemplate(template: PrintTemplate, ctx: PlanContext): RenderPlan {
  const dpi = ctx.dpi ?? template.canvas.dpi ?? 300;
  const selected = selectVariant(template, ctx.selector ?? {});
  return {
    widthPx: Math.max(1, mmToPx(selected.canvas.widthMm, dpi)),
    heightPx: Math.max(1, mmToPx(selected.canvas.heightMm, dpi)),
    dpi,
    primitives: planElements(selected.elements, { dpi, locale: ctx.locale, tokens: ctx.tokens, photoCount: ctx.photoCount }),
  };
}
