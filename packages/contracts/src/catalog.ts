import { z } from 'zod';
import { AuditFields, DailySchedule, Id, LocalizedText, Money, Scope, Timestamp } from './common';
import { CapabilityKey, PaperSize } from './capabilities';
import { FeatureKey } from './features';

/** Categorías de la pantalla de inicio (requisito 4.2). */
export const ProductCategory = z.enum([
  'documents',
  'graduation',
  'professional_portrait',
  'fun',
  'photo_strip',
  'receipt_photo',
  'themed_portrait',
  'creative_local',
  'ai_future',
]);
export type ProductCategory = z.infer<typeof ProductCategory>;

export const ProductKind = z.enum(['document', 'entertainment', 'portrait', 'ai']);
export type ProductKind = z.infer<typeof ProductKind>;

/** Herramientas de edición (requisitos 5.8, 7.1, 7.2). */
export const EditingTool = z.enum([
  'crop',
  'aspect',
  'rotate',
  'levelRotation',
  'mirror',
  'brightness',
  'contrast',
  'exposure',
  'saturation',
  'temperature',
  'grayscale',
  'filterIntensity',
  'sharpen',
  'vignette',
  'presets',
  'backgroundAdjust',
  'frames',
  'stickers',
  'illustrations',
  'text',
  'date',
  'locationName',
  'campaignLogo',
  'patterns',
  'backgrounds',
  'masks',
  'overlays',
  'stamps',
  'campaignCode',
  'signature',
]);
export type EditingTool = z.infer<typeof EditingTool>;

/** Herramientas compatibles con fidelidad documental. Nada fuera de esta lista se aplica a documentos. */
export const DOCUMENT_SAFE_TOOLS: EditingTool[] = [
  'crop',
  'levelRotation',
  'exposure',
  'brightness',
  'contrast',
  'temperature',
  'grayscale',
  'backgroundAdjust',
];

export const EditingPolicy = z.object({
  enabled: z.boolean(),
  allowedTools: z.array(EditingTool),
  allowedPresetIds: z.array(Id).default([]),
});
export type EditingPolicy = z.infer<typeof EditingPolicy>;

export const RetakePolicy = z.object({
  max: z.number().int().min(0),
  perPhoto: z.boolean().default(true),
  wholeSession: z.boolean().default(false),
  keepPreviousForCompare: z.boolean().default(true),
});
export type RetakePolicy = z.infer<typeof RetakePolicy>;

export const OutputFormat = z.object({
  templateId: Id,
  paperSize: PaperSize,
  copies: z.number().int().min(0),
  printerType: z.enum(['photo', 'thermal']).optional(),
});
export type OutputFormat = z.infer<typeof OutputFormat>;

export const ProductStatus = z.enum(['draft', 'active', 'inactive']);

export const TimingOverrides = z.object({
  idleTimeoutSec: z.number().int().optional(),
  captureCountdownSec: z.number().int().optional(),
  reviewTimeoutSec: z.number().int().optional(),
  autoCaptureStabilityMs: z.number().int().optional(),
});

export const Product = z
  .object({
    id: Id,
    organizationId: Id,
    internalName: z.string(),
    displayName: LocalizedText,
    category: ProductCategory,
    kind: ProductKind,
    description: LocalizedText,
    whatYouGet: LocalizedText,
    coverAssetId: Id.optional(),
    promoVideoAssetId: Id.optional(),
    estimatedDurationSec: z.number().int(),
    captureCount: z.number().int().min(1),
    printCount: z.number().int().min(0),
    output: OutputFormat,
    presetId: Id.optional(),
    experienceId: Id.optional(),
    aiExperienceKey: z.string().optional(),
    editing: EditingPolicy,
    retakes: RetakePolicy,
    autoCapture: z.boolean().default(false),
    manualCapture: z.boolean().default(true),
    basePrice: Money,
    taxInfo: z
      .object({ ratePct: z.number(), included: z.boolean(), label: z.string() })
      .optional(),
    instructions: LocalizedText.optional(),
    terms: LocalizedText.optional(),
    restrictions: LocalizedText.optional(),
    privacyNote: LocalizedText.optional(),
    hardwareRequirements: z.array(CapabilityKey).default([]),
    requiredFeatures: z.array(FeatureKey).default([]),
    schedule: z.array(DailySchedule).default([]),
    startsAt: Timestamp.optional(),
    endsAt: Timestamp.optional(),
    timing: TimingOverrides.default({}),
    retentionPolicyId: Id.optional(),
    status: ProductStatus.default('draft'),
    priority: z.number().int().default(100),
    tags: z.array(z.string()).default([]),
  })
  .extend(AuditFields.shape);
export type Product = z.infer<typeof Product>;

/** Disponibilidad de un producto por alcance (requisito 9.2). */
export const ProductAvailability = z.object({
  id: Id,
  productId: Id,
  scope: Scope,
  enabled: z.boolean(),
  priorityOverride: z.number().int().optional(),
  temporaryUntil: Timestamp.optional(),
  updatedAt: Timestamp,
  updatedBy: Id.optional(),
});
export type ProductAvailability = z.infer<typeof ProductAvailability>;

/** Regla de precio con alcance, horario y temporada (requisito 10.1). */
export const PriceRule = z.object({
  id: Id,
  productId: Id,
  scope: Scope,
  price: Money,
  schedule: z.array(DailySchedule).default([]),
  season: z.object({ start: Timestamp, end: Timestamp }).optional(),
  priority: z.number().int().default(0),
  /** Bloqueo para niveles inferiores: null = libre; range = dentro de [min,max]; mandatory = no editable. */
  lock: z
    .object({
      policy: z.enum(['editable', 'range', 'mandatory']),
      min: Money.optional(),
      max: Money.optional(),
    })
    .optional(),
  updatedAt: Timestamp,
  updatedBy: Id.optional(),
});
export type PriceRule = z.infer<typeof PriceRule>;

export const PromotionType = z.enum([
  'fixed_discount',
  'percent_discount',
  'promo_price',
  'second_print',
  'free',
  'bundle',
  'schedule',
  'date',
  'local',
  'code',
]);
export type PromotionType = z.infer<typeof PromotionType>;

export const Promotion = z
  .object({
    id: Id,
    organizationId: Id,
    franchiseId: Id.optional(),
    name: LocalizedText,
    type: PromotionType,
    value: z.number().optional(),
    promoPrice: Money.optional(),
    productIds: z.array(Id).default([]),
    bundleProductIds: z.array(Id).default([]),
    scope: Scope,
    window: z.object({ start: Timestamp, end: Timestamp }).optional(),
    schedule: z.array(DailySchedule).default([]),
    code: z.string().optional(),
    campaignId: Id.optional(),
    priority: z.number().int().default(0),
    status: z.enum(['draft', 'active', 'inactive']).default('draft'),
  })
  .extend(AuditFields.shape);
export type Promotion = z.infer<typeof Promotion>;

export const ResolvedPrice = z.object({
  productId: Id,
  list: Money,
  final: Money,
  appliedRuleId: Id.optional(),
  appliedPromotionIds: z.array(Id).default([]),
  provenance: Scope,
  lockedBy: Scope.optional(),
});
export type ResolvedPrice = z.infer<typeof ResolvedPrice>;
