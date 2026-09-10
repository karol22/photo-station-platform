import { z } from 'zod';
import { AuditFields, Id, JsonValue, LocaleCode, LocalizedText, Money, PixelSize, Scope, Timestamp } from './common';
import { ConfigLock } from './config';

export const CampaignStatus = z.enum(['draft', 'scheduled', 'active', 'finished', 'cancelled']);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const Campaign = z
  .object({
    id: Id,
    organizationId: Id,
    /** Presente cuando la campaña es local de una franquicia. */
    franchiseId: Id.optional(),
    name: LocalizedText,
    description: LocalizedText.optional(),
    startsAt: Timestamp,
    endsAt: Timestamp,
    targets: z.object({ scopes: z.array(Scope), tags: z.array(z.string()).default([]) }),
    productIds: z.array(Id).default([]),
    priceOverrides: z.array(z.object({ productId: Id, price: Money })).default([]),
    templateIds: z.array(Id).default([]),
    assetIds: z.array(Id).default([]),
    texts: z.record(z.string(), LocalizedText).default({}),
    sponsor: z.object({ name: z.string(), logoAssetId: Id.optional() }).optional(),
    experienceId: Id.optional(),
    priority: z.number().int().default(0),
    status: CampaignStatus.default('draft'),
    configOverlay: z.object({ values: z.record(z.string(), JsonValue).default({}), locks: z.array(ConfigLock).default([]) }).default({ values: {}, locks: [] }),
    /** Claves que un franquiciatario puede modificar en su copia local de la campaña. */
    franchiseEditableKeys: z.array(z.string()).default([]),
    mandatory: z.boolean().default(false),
  })
  .extend(AuditFields.shape);
export type Campaign = z.infer<typeof Campaign>;

export const AssetCategory = z.enum([
  'logo',
  'background',
  'frame',
  'sticker',
  'example_photo',
  'promo_screen',
  'video',
  'visual_instruction',
  'pose_silhouette',
  'icon',
  'template_preview',
  'legal',
  'reference_photo',
  'other',
]);
export type AssetCategory = z.infer<typeof AssetCategory>;

export const Asset = z
  .object({
    id: Id,
    organizationId: Id.optional(),
    name: z.string(),
    category: AssetCategory,
    ownerScope: Scope,
    tags: z.array(z.string()).default([]),
    status: z.enum(['active', 'archived', 'draft']).default('active'),
    version: z.number().int().default(1),
    locales: z.array(LocaleCode).default([]),
    dimensions: PixelSize.optional(),
    validity: z.object({ start: Timestamp, end: Timestamp.optional() }).optional(),
    campaignId: Id.optional(),
    usageRestrictions: z.string().optional(),
    mime: z.string(),
    bytes: z.number().int().min(0),
    /** sha256 del contenido; los activos se sirven por hash. */
    hash: z.string(),
    /** Ruta relativa al almacén de activos del control-plane. */
    path: z.string(),
  })
  .extend(AuditFields.shape);
export type Asset = z.infer<typeof Asset>;

export const AssetManifestEntry = z.object({
  assetId: Id,
  hash: z.string(),
  mime: z.string(),
  bytes: z.number().int(),
  /** URL desde la que el agente descarga el activo (fleet) o la UI lo lee (station). */
  url: z.string(),
});
export type AssetManifestEntry = z.infer<typeof AssetManifestEntry>;

export const AssetUsage = z.object({
  assetId: Id,
  usedBy: z.array(z.object({ type: z.string(), id: Id, name: z.string().optional() })),
});
export type AssetUsage = z.infer<typeof AssetUsage>;

export const Announcement = z
  .object({
    id: Id,
    organizationId: Id,
    title: LocalizedText,
    body: LocalizedText,
    publishedAt: Timestamp,
    expiresAt: Timestamp.optional(),
    audienceFranchiseIds: z.array(Id).default([]),
    pinned: z.boolean().default(false),
  })
  .extend(AuditFields.shape);
export type Announcement = z.infer<typeof Announcement>;

export const InternalDocument = z
  .object({
    id: Id,
    organizationId: Id.optional(),
    title: LocalizedText,
    body: z.string(),
    attachedTo: z.object({
      type: z.enum(['hardwareProfile', 'location', 'franchise', 'product', 'maintenance', 'installation', 'troubleshooting', 'general']),
      id: Id.optional(),
    }),
    tags: z.array(z.string()).default([]),
  })
  .extend(AuditFields.shape);
export type InternalDocument = z.infer<typeof InternalDocument>;
