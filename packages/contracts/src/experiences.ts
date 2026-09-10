import { z } from 'zod';
import { AuditFields, Id, LocalizedText, Timestamp } from './common';

export const ExperienceTheme = z.enum([
  'couple',
  'best_friends',
  'family',
  'birthday',
  'graduation',
  'party',
  'cinema',
  'horror',
  'christmas',
  'day_of_the_dead',
  'valentines',
  'retro',
  'kawaii',
  'minimal',
  'travel',
  'sponsor',
  'location_campaign',
  'custom',
]);
export type ExperienceTheme = z.infer<typeof ExperienceTheme>;

export const PoseGuidance = z.object({
  expectedPeople: z.number().int().min(1).optional(),
  zone: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
  maxTiltDeg: z.number().optional(),
  minFaceRatio: z.number().optional(),
  headroomRatio: z.number().optional(),
});

export const PoseStep = z.object({
  key: z.string(),
  name: LocalizedText,
  instruction: LocalizedText,
  exampleAssetId: Id.optional(),
  silhouetteAssetId: Id.optional(),
  countdownSec: z.number().int().min(1).default(3),
  guidance: PoseGuidance.optional(),
});
export type PoseStep = z.infer<typeof PoseStep>;

export const Experience = z
  .object({
    id: Id,
    organizationId: Id.optional(),
    key: z.string(),
    name: LocalizedText,
    theme: ExperienceTheme,
    description: LocalizedText,
    poses: z.array(PoseStep).min(1),
    guidanceEnabled: z.boolean().default(true),
    selection: z.object({
      min: z.number().int().min(1),
      max: z.number().int().min(1),
      allowReorder: z.boolean().default(true),
      allowCompare: z.boolean().default(true),
    }),
    frameAssetIds: z.array(Id).default([]),
    stickerAssetIds: z.array(Id).default([]),
    overlayAssetIds: z.array(Id).default([]),
    editingPresetIds: z.array(Id).default([]),
    templateId: Id,
    campaignId: Id.optional(),
    season: z.object({ start: Timestamp, end: Timestamp }).optional(),
    status: z.enum(['draft', 'active', 'inactive']).default('active'),
  })
  .extend(AuditFields.shape);
export type Experience = z.infer<typeof Experience>;

/** Preset visual de edición (requisito 7.5). */
export const EditingPreset = z
  .object({
    id: Id,
    organizationId: Id.optional(),
    key: z.string(),
    name: LocalizedText,
    /** Parámetros del pipeline de imaging: la lista cerrada de operaciones vive en @psp/imaging. */
    ops: z.array(z.object({ op: z.string(), params: z.record(z.string(), z.number().or(z.string()).or(z.boolean())) })),
    documentSafe: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  })
  .extend(AuditFields.shape);
export type EditingPreset = z.infer<typeof EditingPreset>;

/** Experiencia futura de IA: sólo representable (requisito 11). */
export const AiExperienceKey = z.enum([
  'stylize',
  'themed_portrait',
  'artistic',
  'poster',
  'caricature',
  'anime',
  'cinematic',
  'variations',
  'short_video',
  'animated_image',
]);
export type AiExperienceKey = z.infer<typeof AiExperienceKey>;

export const AiJobState = z.enum([
  'unavailable',
  'coming_soon',
  'consent_required',
  'processing',
  'ready',
  'error',
  'retry',
  'rejected',
  'disabled',
]);
export type AiJobState = z.infer<typeof AiJobState>;
