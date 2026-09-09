import { z } from 'zod';
import { AuditFields, Id, LocalizedText, Timestamp } from './common';
import { PaperSize, PrinterType } from './capabilities';

export const TemplateKind = z.enum([
  'strip_vertical',
  'strip_horizontal',
  'grid',
  'single',
  'collage',
  'card',
  'postcard',
  'thermal_receipt',
  'document_sheet',
  'custom',
]);
export type TemplateKind = z.infer<typeof TemplateKind>;

/** Caja en milímetros relativa al lienzo. */
export const BoxMm = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotationDeg: z.number().default(0),
});
export type BoxMm = z.infer<typeof BoxMm>;

export const TextStyle = z.object({
  fontFamily: z.string().default('sans-serif'),
  sizePt: z.number().positive().default(10),
  color: z.string().default('#000000'),
  align: z.enum(['left', 'center', 'right']).default('center'),
  weight: z.enum(['normal', 'bold']).default('normal'),
});

export const LogoRole = z.enum(['brand', 'franchise', 'host', 'sponsor', 'campaign']);

const base = { id: z.string(), box: BoxMm, zIndex: z.number().int().default(0) };

export const TemplateElement = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('photo'), slotIndex: z.number().int().min(0), fit: z.enum(['cover', 'contain']).default('cover'), borderMm: z.number().default(0), borderColor: z.string().default('#FFFFFF'), cornerRadiusMm: z.number().default(0) }),
  z.object({ ...base, type: z.literal('text'), content: LocalizedText, style: TextStyle.prefault({}) }),
  z.object({ ...base, type: z.literal('token'), token: z.enum(['date', 'time', 'locationName', 'sessionCode', 'campaignCode', 'machineCode', 'userMessage']), style: TextStyle.prefault({}), format: z.string().optional() }),
  z.object({ ...base, type: z.literal('image'), assetId: Id, fit: z.enum(['cover', 'contain']).default('contain'), opacity: z.number().min(0).max(1).default(1) }),
  z.object({ ...base, type: z.literal('logo'), role: LogoRole, fit: z.enum(['cover', 'contain']).default('contain') }),
  z.object({ ...base, type: z.literal('background'), color: z.string().optional(), assetId: Id.optional() }),
  z.object({ ...base, type: z.literal('frame'), assetId: Id }),
  z.object({ ...base, type: z.literal('qr'), payloadToken: z.enum(['sessionCode', 'campaignUrl', 'deliveryUrl']), placeholder: z.boolean().default(true) }),
  z.object({ ...base, type: z.literal('disclaimer'), content: LocalizedText, style: TextStyle.prefault({}) }),
  z.object({ ...base, type: z.literal('cutMarks'), lengthMm: z.number().default(3) }),
]);
export type TemplateElement = z.infer<typeof TemplateElement>;

export const TemplateVariantSelector = z.object({
  locale: z.string().optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  printerType: PrinterType.optional(),
  paperSize: PaperSize.optional(),
  organizationId: Id.optional(),
  locationId: Id.optional(),
  eventTag: z.string().optional(),
  season: z.string().optional(),
});

export const TemplateVariant = z.object({
  key: z.string(),
  selector: TemplateVariantSelector,
  elements: z.array(TemplateElement).optional(),
  canvas: z.object({ widthMm: z.number().positive(), heightMm: z.number().positive() }).optional(),
});
export type TemplateVariant = z.infer<typeof TemplateVariant>;

export const PrintTemplate = z
  .object({
    id: Id,
    organizationId: Id.optional(),
    name: LocalizedText,
    kind: TemplateKind,
    paperSize: PaperSize,
    canvas: z.object({ widthMm: z.number().positive(), heightMm: z.number().positive(), dpi: z.number().int().default(300) }),
    orientation: z.enum(['portrait', 'landscape']),
    photoSlots: z.number().int().min(0),
    elements: z.array(TemplateElement),
    variants: z.array(TemplateVariant).default([]),
    version: z.number().int().default(1),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
    previewAssetId: Id.optional(),
    tags: z.array(z.string()).default([]),
    /** Para document_sheet: dimensiones de cada foto y separación; el layout las repite. */
    documentSheet: z
      .object({ photoWidthMm: z.number().positive(), photoHeightMm: z.number().positive(), gutterMm: z.number().default(2), cutMarks: z.boolean().default(true) })
      .optional(),
  })
  .extend(AuditFields.shape);
export type PrintTemplate = z.infer<typeof PrintTemplate>;

export const TemplatePreviewRequest = z.object({
  templateId: Id,
  variantKey: z.string().optional(),
  sampleAssetIds: z.array(Id).optional(),
});

export const TemplateVersionRef = z.object({ templateId: Id, version: z.number().int(), at: Timestamp.optional() });
