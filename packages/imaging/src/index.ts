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
  duotone,
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
export { resolveLocalizedText, fitRect, cutMarkBoxes, cutMarkThickness, qrPlaceholderModules, qrModules, qrLayout, QR_QUIET_ZONE, fnv1a } from './primitives';
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

// QR real (ISO/IEC 18004)
export {
  encodeQr,
  decodeQr,
  capacityFor,
  chooseMode,
  fitVersion,
  penaltyScore,
  versionSize,
  versionFromSize,
  dataCodewords,
  alignmentPositions,
  QR_MIN_VERSION,
  QR_MAX_VERSION,
  QR_ECC_LEVELS,
  QR_MASK_COUNT,
} from './qr';
export type { QrCode, EncodeQrOptions, QrDecoded, QrEcc, QrMode } from './qr';

// Máscara de recorte de persona y calidad del borde
export { createMask, maskAt, resampleMask, refineMaskEdge, prepareMask, edgeSoftness, DEFAULT_EDGE } from './mask';
export type { Mask, EdgeOptions } from './mask';

// Efectos de fondo
export { replaceBackground, blurBackground, colorBackground, cutoutPerson, compositeWithMask } from './background';
export type { BackgroundOptions, ReplaceBackgroundOptions, BlurBackgroundOptions } from './background';

// Elementos pegados a la cara
export { anchorProp, drawProp, drawPropInto } from './props';
export type { Point2, FaceLandmarks, PropAnchor, PropSpec, PropPlacement, DrawPropOptions, RasterSize } from './props';

// Retoque
export { smoothSkin } from './retouch';
export type { SmoothSkinOptions } from './retouch';

// Filtros con nombre
export { COLOR_FILTERS, COLOR_FILTER_KEYS, isColorFilterKey, colorFilterOps } from './color-filters';
export type { ColorFilterKey } from './color-filters';

// Registro de efectos
export { EFFECT_IMPLEMENTATIONS, EFFECT_KEYS, applyEffect, effectInfo, liveEffects, documentSafeEffects } from './effects';
export type { EffectImplementation, EffectInput, EffectCost, EffectStage } from './effects';

// Catálogo
export { CATALOG } from './catalog';
