import { z } from 'zod';
import { Id, Timestamp } from './common';
import { EffectiveConfig } from './config';
import { HardwareProfile, Location, Machine, Organization } from './hierarchy';
import { Product, Promotion, ResolvedPrice } from './catalog';
import { DocumentPreset, DocumentPresetVersion } from './presets';
import { PrintTemplate } from './templates';
import { EditingPreset, Experience } from './experiences';
import { AssetManifestEntry, Campaign } from './campaigns';
import { FeatureState } from './features';
import { RetentionPolicy } from './sessions';
import { MaintenanceChecklist } from './ops';

/**
 * Bundle de configuración: todo lo que una máquina necesita para operar, materializado por el
 * control-plane y cacheado por el agente. Inmutable; `version` es el hash de su contenido.
 */
export const ConfigBundle = z.object({
  version: z.string(),
  contractsVersion: z.literal('v1'),
  machineId: Id,
  organizationId: Id,
  generatedAt: Timestamp,
  basedOn: z.object({
    layerIds: z.array(Id),
    campaignIds: z.array(Id),
    catalogRevision: z.string(),
  }),
  organization: Organization.pick({ id: true, name: true, slug: true, currency: true, defaultLocale: true, locales: true, timezone: true, country: true, support: true }),
  location: Location.pick({ id: true, publicName: true, internalName: true, timezone: true, type: true, address: true }).optional(),
  machine: Machine.pick({ id: true, code: true, name: true, timezone: true, releaseChannel: true, printers: true }),
  hardwareProfile: HardwareProfile,
  effective: EffectiveConfig,
  products: z.array(Product),
  prices: z.array(ResolvedPrice),
  promotions: z.array(Promotion),
  presets: z.array(DocumentPreset),
  presetVersions: z.array(DocumentPresetVersion),
  templates: z.array(PrintTemplate),
  experiences: z.array(Experience),
  editingPresets: z.array(EditingPreset),
  campaigns: z.array(Campaign),
  features: z.array(FeatureState),
  retentionPolicies: z.array(RetentionPolicy),
  maintenanceChecklists: z.array(MaintenanceChecklist),
  assets: z.array(AssetManifestEntry),
});
export type ConfigBundle = z.infer<typeof ConfigBundle>;

/** Motivos por los que un producto no está disponible en este momento en esta máquina. */
export const UnavailabilityReason = z.enum([
  'missing_capability',
  'capability_not_operational',
  'feature_disabled',
  'feature_hidden',
  'feature_locked',
  'feature_coming_soon',
  'out_of_schedule',
  'out_of_window',
  'inactive',
  'printer_unavailable',
  'no_paper',
  'maintenance',
  'not_available_here',
]);
export type UnavailabilityReason = z.infer<typeof UnavailabilityReason>;

export const ProductAvailabilityState = z.object({
  productId: Id,
  available: z.boolean(),
  /** Cómo mostrarlo cuando no está disponible: oculto, bloqueado con explicación o próximamente. */
  presentation: z.enum(['show', 'hidden', 'locked', 'coming_soon']),
  reasons: z.array(UnavailabilityReason),
});
export type ProductAvailabilityState = z.infer<typeof ProductAvailabilityState>;
