/**
 * @psp/imaging · superficie pública.
 *
 * Fase de stubs: cada firma existe con su tipo definitivo y lanza `not implemented`.
 * La implementación reemplaza cada stub por su módulo (`raster.ts`, `ops/*`, `edit-ops.ts`,
 * `font.ts`, `png.ts`, `template/*`, `render.ts`, `catalog.ts`).
 */
import type { CatalogEntry, EditOp, EditingPreset, EditingTool, Id, LocaleCode, PrintTemplate } from '@psp/contracts';

/* ---------- Raster ---------- */

/** Búfer RGBA de 8 bits, compatible con `ImageData` (mismo layout, sin `colorSpace`). */
export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export type RGBA = [r: number, g: number, b: number, a: number];
export type Rect = { x: number; y: number; w: number; h: number };
export type Fit = 'cover' | 'contain';

const notImplemented = (name: string): never => {
  throw new Error(`@psp/imaging: ${name} not implemented`);
};

export function createRaster(width: number, height: number, fill?: RGBA): Raster {
  return notImplemented(`createRaster(${width},${height},${String(fill)})`);
}
export function cloneRaster(r: Raster): Raster {
  return notImplemented(`cloneRaster(${r.width})`);
}
export function getPixel(r: Raster, x: number, y: number): RGBA {
  return notImplemented(`getPixel(${r.width},${x},${y})`);
}
export function setPixel(r: Raster, x: number, y: number, color: RGBA): void {
  notImplemented(`setPixel(${r.width},${x},${y},${String(color)})`);
}
/** Interpreta `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb()`, `rgba()` y algunos nombres. */
export function parseColor(input: string | RGBA, fallback?: RGBA): RGBA {
  return notImplemented(`parseColor(${String(input)},${String(fallback)})`);
}

/* ---------- Operaciones puras (devuelven un Raster nuevo) ---------- */

export function crop(r: Raster, rect: Rect): Raster {
  return notImplemented(`crop(${r.width},${rect.x})`);
}
export function resize(r: Raster, width: number, height: number): Raster {
  return notImplemented(`resize(${r.width},${width},${height})`);
}
export function rotate90(r: Raster, times: number): Raster {
  return notImplemented(`rotate90(${r.width},${times})`);
}
export function rotateSmall(r: Raster, degrees: number, background?: RGBA): Raster {
  return notImplemented(`rotateSmall(${r.width},${degrees},${String(background)})`);
}
export function mirrorH(r: Raster): Raster {
  return notImplemented(`mirrorH(${r.width})`);
}
export function brightness(r: Raster, amount: number): Raster {
  return notImplemented(`brightness(${r.width},${amount})`);
}
export function contrast(r: Raster, amount: number): Raster {
  return notImplemented(`contrast(${r.width},${amount})`);
}
export function exposure(r: Raster, stops: number): Raster {
  return notImplemented(`exposure(${r.width},${stops})`);
}
export function saturation(r: Raster, amount: number): Raster {
  return notImplemented(`saturation(${r.width},${amount})`);
}
export function temperature(r: Raster, amount: number): Raster {
  return notImplemented(`temperature(${r.width},${amount})`);
}
export function grayscale(r: Raster): Raster {
  return notImplemented(`grayscale(${r.width})`);
}
export function sharpen(r: Raster, amount: number): Raster {
  return notImplemented(`sharpen(${r.width},${amount})`);
}
export function vignette(r: Raster, strength: number): Raster {
  return notImplemented(`vignette(${r.width},${strength})`);
}
export function blurBox(r: Raster, radius: number): Raster {
  return notImplemented(`blurBox(${r.width},${radius})`);
}
export function blend(base: Raster, overlay: Raster, x: number, y: number, opacity?: number): Raster {
  return notImplemented(`blend(${base.width},${overlay.width},${x},${y},${String(opacity)})`);
}
export function fillRect(r: Raster, rect: Rect, color: string | RGBA): Raster {
  return notImplemented(`fillRect(${r.width},${rect.x},${String(color)})`);
}

/* ---------- Fuente bitmap 5×7 ---------- */

export const FONT_GLYPH_WIDTH = 5;
export const FONT_GLYPH_HEIGHT = 7;
export const FONT_ADVANCE = 6;
export const FONT_LINE_HEIGHT = 9;

export function measureText(text: string, scale: number): { width: number; height: number } {
  return notImplemented(`measureText(${text},${scale})`);
}
export function drawText(r: Raster, text: string, x: number, y: number, scale: number, color: string | RGBA): Raster {
  return notImplemented(`drawText(${r.width},${text},${x},${y},${scale},${String(color)})`);
}

/* ---------- Pipeline de edición ---------- */

export type EditOpKey =
  | 'crop'
  | 'rotate'
  | 'levelRotation'
  | 'mirror'
  | 'brightness'
  | 'contrast'
  | 'exposure'
  | 'saturation'
  | 'temperature'
  | 'grayscale'
  | 'sharpen'
  | 'vignette'
  | 'preset'
  | 'backgroundAdjust'
  | 'frame'
  | 'sticker'
  | 'text'
  | 'overlay';

/** Especificación de un parámetro. Sin `default` el parámetro es obligatorio. */
export type ParamSpec = {
  kind: 'number' | 'integer' | 'string';
  min?: number;
  max?: number;
  default?: unknown;
  allowed?: readonly (number | string)[];
};

export type EditOpSpec = {
  tool: EditingTool;
  documentSafe: boolean;
  params: Record<string, ParamSpec>;
};

export const EDIT_OPS: Record<EditOpKey, EditOpSpec> = {} as Record<EditOpKey, EditOpSpec>;

export type EditProblem = { index: number; op: EditOp; reason: string };
export type EditValidation = { ok: boolean; rejected: EditOp[]; problems: EditProblem[] };

export type EditResources = {
  assets?: Record<Id, Raster>;
  presets?: Record<Id, EditingPreset>;
};

export function validateEditOps(ops: EditOp[], allowedTools: EditingTool[]): EditValidation {
  return notImplemented(`validateEditOps(${ops.length},${allowedTools.length})`);
}
/** Sustituye cada op `preset` por sus ops concretas (un nivel; presets ausentes o anidados se omiten). */
export function expandEditOps(ops: EditOp[], presets?: Record<Id, EditingPreset>): EditOp[] {
  return notImplemented(`expandEditOps(${ops.length},${String(presets)})`);
}
export function applyEditOps(r: Raster, ops: EditOp[], resources?: EditResources): Raster {
  return notImplemented(`applyEditOps(${r.width},${ops.length},${String(resources)})`);
}
export function editingPresetToOps(preset: EditingPreset): EditOp[] {
  return notImplemented(`editingPresetToOps(${preset.id})`);
}

/* ---------- Composición ---------- */

export type LogoRole = Extract<PrintTemplate['elements'][number], { type: 'logo' }>['role'];
export type TemplateElement = PrintTemplate['elements'][number];
export type TemplateVariant = PrintTemplate['variants'][number];
export type TemplateVariantSelector = TemplateVariant['selector'];
export type TextAlign = 'left' | 'center' | 'right';

export type TextStylePx = {
  fontFamily: string;
  sizePx: number;
  color: string;
  align: TextAlign;
  weight: 'normal' | 'bold';
};

export type Primitive =
  | { kind: 'fill'; rect: Rect; color: string }
  | {
      kind: 'photo';
      rect: Rect;
      slotIndex: number;
      fit: Fit;
      radiusPx: number;
      borderPx: number;
      borderColor: string;
      /** Giro previo de la foto (múltiplo de 90). Lo usa la hoja documental con orientación automática. */
      rotationDeg?: 0 | 90 | 180 | 270;
    }
  | { kind: 'asset'; rect: Rect; assetId: Id; fit: Fit; opacity: number }
  | { kind: 'logo'; rect: Rect; role: LogoRole; fit: Fit }
  | { kind: 'text'; rect: Rect; text: string; style: TextStylePx }
  | { kind: 'cutMarks'; rects: Rect[]; lengthPx: number }
  | { kind: 'qr'; rect: Rect; payload: string };

export type RenderPlan = { widthPx: number; heightPx: number; dpi: number; primitives: Primitive[] };

export type VariantSelection = {
  elements: TemplateElement[];
  canvas: { widthMm: number; heightMm: number };
  variantKey?: string;
};

export type PlanContext = {
  selector?: TemplateVariantSelector;
  locale: LocaleCode;
  tokens: Record<string, string>;
  photoCount: number;
  /** Sobrescribe `template.canvas.dpi`. */
  dpi?: number;
};

export type DocumentSheetOptions = {
  cutMarks?: boolean;
  gutterMm?: number;
  /** Margen exterior mínimo; por defecto igual al gutter. */
  marginMm?: number;
  selector?: TemplateVariantSelector;
  locale?: LocaleCode;
  tokens?: Record<string, string>;
  dpi?: number;
};

export type DocumentSheetPlan = {
  plan: RenderPlan;
  fitted: number;
  sheets: number;
  /** Verdadero cuando las copias van giradas 90° porque así caben más. */
  rotated: boolean;
  columns: number;
  rows: number;
};

export type RenderSources = {
  photos: Raster[];
  assets?: Record<Id, Raster>;
  logos?: Partial<Record<LogoRole, Raster>>;
};

export function mmToPx(mm: number, dpi: number): number {
  return notImplemented(`mmToPx(${mm},${dpi})`);
}
export function selectVariant(template: PrintTemplate, selector?: TemplateVariantSelector): VariantSelection {
  return notImplemented(`selectVariant(${template.id},${String(selector)})`);
}
export function planTemplate(template: PrintTemplate, ctx: PlanContext): RenderPlan {
  return notImplemented(`planTemplate(${template.id},${ctx.locale})`);
}
export function planDocumentSheet(
  template: PrintTemplate,
  photo: { widthMm: number; heightMm: number },
  copies: number,
  opts?: DocumentSheetOptions,
): DocumentSheetPlan {
  return notImplemented(`planDocumentSheet(${template.id},${photo.widthMm},${copies},${String(opts)})`);
}
export function renderPlan(plan: RenderPlan, sources: RenderSources): Raster {
  return notImplemented(`renderPlan(${plan.widthPx},${sources.photos.length})`);
}

/* ---------- PNG ---------- */

export type PngEncodeOptions = {
  /** Compresor zlib inyectable (p. ej. `deflateSync` de `node:zlib`). Sin él, bloques stored. */
  deflate?: (data: Uint8Array) => Uint8Array;
};
export type PngDecodeOptions = {
  /** Descompresor zlib inyectable (p. ej. `inflateSync` de `node:zlib`). Sin él, inflate propio en TS. */
  inflate?: (data: Uint8Array) => Uint8Array;
};

export function encodePNG(r: Raster, opts?: PngEncodeOptions): Uint8Array {
  return notImplemented(`encodePNG(${r.width},${String(opts)})`);
}
export function decodePNG(bytes: Uint8Array, opts?: PngDecodeOptions): Raster {
  return notImplemented(`decodePNG(${bytes.length},${String(opts)})`);
}

/* ---------- Catálogo ---------- */

export const CATALOG: CatalogEntry[] = [];
