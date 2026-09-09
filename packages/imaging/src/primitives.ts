/**
 * Primitivas de composición: el `RenderPlan` es la salida del planificador de plantillas y la entrada de los
 * dos renderizadores (el puro sobre Raster y el de canvas en el navegador). Todo está en píxeles absolutos
 * del lienzo para que ambos dibujen exactamente la misma geometría. Aquí viven también las utilidades
 * compartidas por ambos: ajuste cover/contain, marcas de corte, QR de sustitución y conversión mm ↔ px.
 */
import type { LocaleCode, LocalizedText, PrintTemplate, TemplateElement, TemplateVariant, LogoRole as LogoRoleSchema, TemplateVariantSelector as TemplateVariantSelectorSchema } from '@psp/contracts';
import type { Fit, Rect } from './raster';

export type { TemplateElement, TemplateVariant };

/** `LogoRole` y `TemplateVariantSelector` sólo existen como esquemas zod en contracts; los tipos se derivan aquí. */
export type LogoRole = ReturnType<typeof LogoRoleSchema.parse>;
export type TemplateVariantSelector = ReturnType<typeof TemplateVariantSelectorSchema.parse>;

export type TextAlign = 'left' | 'center' | 'right';

/** Estilo de texto ya convertido a píxeles (`sizePt` → `sizePx` con el dpi del plan). */
export type TextStylePx = {
  fontFamily: string;
  sizePx: number;
  color: string;
  align: TextAlign;
  weight: 'normal' | 'bold';
};

/** Campos comunes opcionales: id del elemento de origen (para previsualizaciones) y rotación en grados. */
type PrimitiveMeta = {
  elementId?: string;
  /** Rotación en grados alrededor del centro del rect. El renderizador puro honra múltiplos de 90. */
  rotationDeg?: number;
};

export type Primitive =
  | ({ kind: 'fill'; rect: Rect; color: string } & PrimitiveMeta)
  | ({ kind: 'photo'; rect: Rect; slotIndex: number; fit: Fit; radiusPx: number; borderPx: number; borderColor: string } & PrimitiveMeta)
  | ({ kind: 'asset'; rect: Rect; assetId: string; fit: Fit; opacity: number } & PrimitiveMeta)
  | ({ kind: 'logo'; rect: Rect; role: LogoRole; fit: Fit } & PrimitiveMeta)
  | ({ kind: 'text'; rect: Rect; text: string; style: TextStylePx } & PrimitiveMeta)
  | ({ kind: 'cutMarks'; rects: Rect[]; lengthPx: number } & PrimitiveMeta)
  | ({ kind: 'qr'; rect: Rect; payload: string } & PrimitiveMeta);

export type RenderPlan = {
  widthPx: number;
  heightPx: number;
  dpi: number;
  primitives: Primitive[];
};

/** Resultado de `selectVariant`: elementos y lienzo efectivos. */
export type VariantSelection = {
  elements: TemplateElement[];
  canvas: { widthMm: number; heightMm: number };
  /** Clave de la variante elegida; ausente cuando aplica la base. */
  variantKey?: string;
};

export type PlanContext = {
  selector?: TemplateVariantSelector;
  locale: LocaleCode;
  /** Valores para elementos `token` y `qr` (p. ej. `date`, `sessionCode`, `deliveryUrl`). */
  tokens: Record<string, string>;
  /** Fotos disponibles: los slots `>= photoCount` se omiten. */
  photoCount: number;
  /** Sobrescribe el dpi del lienzo de la plantilla (previsualizaciones a menor resolución). */
  dpi?: number;
};

export type DocumentSheetOptions = {
  cutMarks?: boolean;
  gutterMm?: number;
  /** Margen mínimo al borde de la hoja; por defecto 3 mm. */
  marginMm?: number;
  dpi?: number;
};

export type DocumentSheetPlan = {
  plan: RenderPlan;
  /** Copias que caben en una hoja. */
  fitted: number;
  /** Hojas necesarias para `copies`. */
  sheets: number;
  rows: number;
  cols: number;
  /** true cuando la foto se gira 90° para aprovechar la hoja. */
  rotated: boolean;
};

const MM_PER_INCH = 25.4;

export function mmToPxExact(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

/** Milímetros a píxeles enteros (redondeo half-up). */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round(mmToPxExact(mm, dpi));
}

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH;
}

/** Puntos tipográficos (1/72 in) a píxeles, sin redondear. */
export function ptToPx(pt: number, dpi: number): number {
  return (pt / 72) * dpi;
}

/** Texto localizado con caída a español; vacío si no hay texto. */
export function resolveLocalizedText(text: LocalizedText | undefined, locale: LocaleCode): string {
  if (!text) return '';
  const value = text[locale];
  return typeof value === 'string' && value.length > 0 ? value : text.es;
}

/** Lienzo efectivo de una plantilla o variante. */
export function templateCanvas(template: PrintTemplate, variant?: TemplateVariant): { widthMm: number; heightMm: number } {
  return variant?.canvas ?? { widthMm: template.canvas.widthMm, heightMm: template.canvas.heightMm };
}

/**
 * Rect destino (en px, sin recortar) para dibujar una fuente de `srcW×srcH` dentro de `rect` con cover o contain.
 * Con `cover` el resultado desborda `rect` y el llamador recorta; con `contain` queda centrado dentro.
 */
export function fitRect(srcW: number, srcH: number, rect: Rect, fit: Fit): Rect {
  if (srcW <= 0 || srcH <= 0 || rect.w <= 0 || rect.h <= 0) return { x: rect.x, y: rect.y, w: 0, h: 0 };
  const sx = rect.w / srcW;
  const sy = rect.h / srcH;
  const scale = fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  return { x: Math.round(rect.x + (rect.w - w) / 2), y: Math.round(rect.y + (rect.h - h) / 2), w, h };
}

/** Grosor de las marcas de corte: ~0.17 mm (2 px a 300 dpi), nunca menos de 1 px. */
export function cutMarkThickness(dpi: number): number {
  return Math.max(1, Math.round(dpi / 150));
}

type Direction = 'left' | 'right' | 'up' | 'down';

/** Recorta una marca que se extiende en `dir` desde una esquina para que no invada ningún otro rect. */
function clipOutward(box: Rect, dir: Direction, rects: Rect[]): Rect | undefined {
  let { x, y, w, h } = box;
  for (const r of rects) {
    const overlapsX = x < r.x + r.w && x + w > r.x;
    const overlapsY = y < r.y + r.h && y + h > r.y;
    if (!overlapsX || !overlapsY) continue;
    if (dir === 'left') {
      const nx = r.x + r.w;
      w = x + w - nx;
      x = nx;
    } else if (dir === 'right') {
      w = r.x - x;
    } else if (dir === 'up') {
      const ny = r.y + r.h;
      h = y + h - ny;
      y = ny;
    } else {
      h = r.y - y;
    }
    if (w <= 0 || h <= 0) return undefined;
  }
  return { x, y, w, h };
}

/**
 * Cajas a rellenar para las marcas de corte: ocho segmentos por rect (dos por esquina, hacia afuera, alineados
 * con las líneas de corte). Los segmentos se recortan para no pintar sobre otro rect ni salir del lienzo.
 */
export function cutMarkBoxes(rects: Rect[], lengthPx: number, thicknessPx: number, bounds: { w: number; h: number }): Rect[] {
  const L = Math.max(1, Math.round(lengthPx));
  const t = Math.max(1, Math.round(thicknessPx));
  const half = Math.floor(t / 2);
  const out: Rect[] = [];
  const push = (box: Rect, dir: Direction) => {
    const clipped = clipOutward(box, dir, rects);
    if (!clipped) return;
    const x0 = Math.max(0, clipped.x);
    const y0 = Math.max(0, clipped.y);
    const x1 = Math.min(bounds.w, clipped.x + clipped.w);
    const y1 = Math.min(bounds.h, clipped.y + clipped.h);
    if (x1 > x0 && y1 > y0) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  };
  for (const r of rects) {
    const x0 = r.x;
    const y0 = r.y;
    const x1 = r.x + r.w;
    const y1 = r.y + r.h;
    // Horizontales: a la altura de los bordes superior e inferior, hacia la izquierda y la derecha.
    push({ x: x0 - L, y: y0 - half, w: L, h: t }, 'left');
    push({ x: x1, y: y0 - half, w: L, h: t }, 'right');
    push({ x: x0 - L, y: y1 - t + half, w: L, h: t }, 'left');
    push({ x: x1, y: y1 - t + half, w: L, h: t }, 'right');
    // Verticales: en los bordes izquierdo y derecho, hacia arriba y hacia abajo.
    push({ x: x0 - half, y: y0 - L, w: t, h: L }, 'up');
    push({ x: x0 - half, y: y1, w: t, h: L }, 'down');
    push({ x: x1 - t + half, y: y0 - L, w: t, h: L }, 'up');
    push({ x: x1 - t + half, y: y1, w: t, h: L }, 'down');
  }
  return out;
}

/** FNV-1a de 32 bits sobre la cadena en UTF-16 (determinista, sin dependencias). */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export const QR_PLACEHOLDER_SIZE = 21;

function isFinder(x: number, y: number, size: number): boolean {
  const inBlock = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
  return inBlock(0, 0) || inBlock(size - 7, 0) || inBlock(0, size - 7);
}

function finderOn(x: number, y: number, size: number): boolean {
  const local = (ox: number, oy: number): boolean => {
    const lx = x - ox;
    const ly = y - oy;
    const ring = Math.max(Math.abs(lx - 3), Math.abs(ly - 3));
    return ring !== 1 && ring !== 5 ? ring <= 3 : false;
  };
  if (x < 7 && y < 7) return local(0, 0);
  if (x >= size - 7 && y < 7) return local(size - 7, 0);
  return local(0, size - 7);
}

/**
 * Patrón QR de sustitución (21×21, tres buscadores reales y datos pseudoaleatorios derivados del payload).
 * No es decodificable: indica visualmente dónde irá el QR real cuando exista el servicio de entrega.
 */
export function qrPlaceholderModules(payload: string): boolean[][] {
  const size = QR_PLACEHOLDER_SIZE;
  let state = fnv1a(payload) || 0x9e3779b9;
  const next = () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
  const rows: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      if (isFinder(x, y, size)) row.push(finderOn(x, y, size));
      else if ((x === 7 && y < 8) || (y === 7 && x < 8) || (x === size - 8 && y < 8) || (y === 7 && x >= size - 8) || (x === 7 && y >= size - 8) || (y === size - 8 && x < 8)) row.push(false);
      else if (x === 6 || y === 6) row.push((x + y) % 2 === 0);
      else row.push((next() & 1) === 1);
    }
    rows.push(row);
  }
  return rows;
}

/** Tamaño de módulo y origen para centrar `size` módulos dentro del rect dejando una zona de silencio de un módulo. */
export function qrLayout(rect: Rect, size: number): { modulePx: number; originX: number; originY: number } {
  const modulePx = Math.max(1, Math.floor(Math.min(rect.w, rect.h) / (size + 2)));
  const total = modulePx * size;
  return { modulePx, originX: Math.round(rect.x + (rect.w - total) / 2), originY: Math.round(rect.y + (rect.h - total) / 2) };
}
