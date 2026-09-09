/**
 * @psp/imaging · superficie pública (ver `docs/arquitectura/01-apis-de-paquetes.md`).
 * Todo es puro y opera sobre `Raster`; lo que toca DOM/canvas vive en `@psp/imaging/browser`.
 */

// Raster y utilidades
export { createRaster, cloneRaster, getPixel, setPixel, parseColor, clampByte, normalizeRect, intersectRect, rasterBounds, luma709, WHITE, BLACK, TRANSPARENT } from './raster';
export type { Raster, RGBA, Rect, Fit } from './raster';

// Operaciones puras
export {
  crop,
  resize,
  rotate90,
  rotateSmall,
  mirrorH,
  brightness,
  contrast,
  exposure,
  saturation,
  temperature,
  grayscale,
  sharpen,
  vignette,
  blurBox,
  backgroundLighten,
  DEFAULT_SUBJECT_ELLIPSE,
  blend,
  blendInto,
  fillRect,
  fillRectInto,
} from './ops';
export type { EllipseSpec } from './ops';

// Fuente bitmap
export { drawText, drawTextInto, measureText, glyphFor, FONT_GLYPH_WIDTH, FONT_GLYPH_HEIGHT, FONT_ADVANCE, FONT_LINE_HEIGHT } from './font';
export type { DrawTextOptions } from './font';

// Pipeline de edición
export { EDIT_OPS, EDIT_OP_KEYS, isEditOpKey, validateEditOps, expandEditOps, applyEditOps, editingPresetToOps } from './edit-ops';
export type { EditOpKey, EditOpSpec, ParamSpec, EditProblem, EditValidation, EditResources } from './edit-ops';

// Composición
export { resolveLocalizedText, fitRect, cutMarkBoxes, cutMarkThickness, qrPlaceholderModules, qrLayout, fnv1a } from './primitives';
export type {
  Primitive,
  RenderPlan,
  TextStylePx,
  TextAlign,
  LogoRole,
  TemplateElement,
  TemplateVariant,
  TemplateVariantSelector,
  VariantSelection,
  PlanContext,
  DocumentSheetOptions,
  DocumentSheetPlan,
} from './primitives';
export { selectVariant, variantByKey } from './template/select';
export { mmToPx, mmToPxExact, ptToPx, boxToRect, sortElements, planElements, planTemplate } from './template/plan';
export type { PlanElementsOptions } from './template/plan';
export { planDocumentSheet } from './template/document-sheet';
export { renderPlan, bitmapTextScale } from './render';
export type { RenderSources } from './render';

// PNG
export { encodePNG, decodePNG } from './png';
export type { PngEncodeOptions, PngDecodeOptions } from './png';
export { crc32, adler32 } from './zlib/checksums';
export { zlibStored } from './zlib/deflate-stored';
export { zlibInflate, inflateRaw } from './zlib/inflate';

// Catálogo
export { CATALOG } from './catalog';
