import { z } from 'zod';
import { AuditFields, Id, LocalizedText, Timestamp } from './common';
import { EditingPolicy } from './catalog';

export const DocumentCategory = z.enum([
  'university',
  'degree',
  'certificate',
  'graduation',
  'military_id',
  'credential',
  'job_application',
  'foreign_visa',
  'local_license',
  'child',
  'diploma_size',
  'professional_profile',
  'passport',
  'other',
]);
export type DocumentCategory = z.infer<typeof DocumentCategory>;

export const RuleTriState = z.enum(['required', 'forbidden', 'allowed']);
export type RuleTriState = z.infer<typeof RuleTriState>;

export const BackgroundKind = z.enum(['white', 'light_gray', 'blue', 'neutral', 'any']);
export const ColorMode = z.enum(['color', 'bw']);
export const ExpressionRule = z.enum(['neutral', 'natural', 'no_smile', 'smile_allowed']);

/** Rango como proporción del alto/ancho de la imagen (0..1). */
const Ratio = z.number().min(0).max(1);
const RatioRange = z.object({ min: Ratio, max: Ratio });

/** Especificación inmutable de una versión de preset documental (requisito 5.2). */
export const DocumentPresetSpec = z.object({
  physical: z.object({
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    orientation: z.enum(['portrait', 'landscape']),
    dpi: z.number().int().default(300),
  }),
  color: ColorMode,
  background: BackgroundKind,
  face: z.object({
    /** Alto del rostro (coronilla-barbilla) respecto al alto de la imagen. */
    heightRatio: RatioRange,
    /** Línea de ojos medida desde arriba respecto al alto de la imagen. */
    eyeLineFromTop: RatioRange,
    /** Desviación horizontal máxima del centro del rostro respecto al ancho (0.05 = 5%). */
    centerXTolerance: Ratio,
    crownToChin: RatioRange.optional(),
    topMarginMin: Ratio,
    sideMarginMin: Ratio,
    shouldersVisible: z.boolean(),
  }),
  expression: ExpressionRule,
  smile: RuleTriState,
  glasses: RuleTriState,
  hairCoveringFace: z.enum(['forbidden', 'allowed']),
  accessories: RuleTriState,
  headCover: RuleTriState,
  attire: LocalizedText.optional(),
  retouch: z.enum(['none', 'minimal']),
  paper: z.object({ type: z.string(), finish: z.enum(['glossy', 'matte', 'satin']) }),
  defaultCopies: z.number().int().min(1),
  sheetTemplateId: Id,
  customerInstructions: LocalizedText,
  editing: EditingPolicy,
  autoCapture: z.object({ enabled: z.boolean(), stabilityMs: z.number().int().default(1200) }),
  thresholds: z.object({
    maxRollDeg: z.number().default(5),
    maxYawDeg: z.number().default(8),
    maxPitchDeg: z.number().default(8),
    minBrightness: z.number().default(0.3),
    maxBrightness: z.number().default(0.85),
    minContrast: z.number().default(0.2),
    minSharpness: z.number().default(40),
    minBackgroundUniformity: z.number().default(0.7),
    minEyeOpen: z.number().default(0.35),
    maxGlassesGlare: z.number().default(0.4),
  }),
});
export type DocumentPresetSpec = z.infer<typeof DocumentPresetSpec>;

export const DocumentPreset = z
  .object({
    id: Id,
    /** null = preset oficial de plataforma distribuido a todas las organizaciones. */
    organizationId: Id.optional(),
    name: LocalizedText,
    institution: z.string().optional(),
    country: z.string().length(2),
    region: z.string().optional(),
    category: DocumentCategory,
    validity: z.object({ start: Timestamp, end: Timestamp.optional() }).optional(),
    currentVersion: z.number().int().min(1),
    status: z.enum(['active', 'deprecated', 'draft']).default('active'),
    tags: z.array(z.string()).default([]),
    searchTerms: z.array(z.string()).default([]),
    sourceRef: z.string().optional(),
    lastReviewedAt: Timestamp.optional(),
    internalNotes: z.string().optional(),
    /** Sin garantía de aceptación universal (requisito 5.1). */
    acceptanceDisclaimer: LocalizedText.optional(),
  })
  .extend(AuditFields.shape);
export type DocumentPreset = z.infer<typeof DocumentPreset>;

export const DocumentPresetVersion = z.object({
  presetId: Id,
  version: z.number().int().min(1),
  spec: DocumentPresetSpec,
  changeNote: z.string().optional(),
  createdAt: Timestamp,
  createdBy: Id.optional(),
});
export type DocumentPresetVersion = z.infer<typeof DocumentPresetVersion>;
