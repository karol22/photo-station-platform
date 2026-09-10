import { z } from 'zod';
import { Address, AuditFields, Contact, DailySchedule, Id, LocaleCode, LocalizedText, PixelSize, Timestamp } from './common';
import { CapabilityKey, MachineCapabilityState, PaperSize, PrinterDefinition } from './capabilities';

export const OrganizationStatus = z.enum(['active', 'suspended']);

export const Organization = z
  .object({
    id: Id,
    slug: z.string(),
    name: z.string(),
    legalName: z.string().optional(),
    country: z.string().length(2),
    currency: z.string().length(3),
    timezone: z.string(),
    defaultLocale: LocaleCode,
    locales: z.array(LocaleCode).min(1),
    dateFormat: z.string().default('dd/MM/yyyy'),
    timeFormat: z.string().default('HH:mm'),
    support: Contact.default({}),
    legal: z
      .object({
        privacyNotice: LocalizedText.optional(),
        terms: LocalizedText.optional(),
      })
      .default({}),
    status: OrganizationStatus.default('active'),
  })
  .extend(AuditFields.shape);
export type Organization = z.infer<typeof Organization>;

export const FranchiseStatus = z.enum(['active', 'suspended', 'pending']);
export const Franchise = z
  .object({
    id: Id,
    organizationId: Id,
    name: z.string(),
    legalName: z.string().optional(),
    contact: Contact.default({}),
    status: FranchiseStatus.default('active'),
    notes: z.string().optional(),
  })
  .extend(AuditFields.shape);
export type Franchise = z.infer<typeof Franchise>;

export const Territory = z
  .object({
    id: Id,
    franchiseId: Id,
    country: z.string().length(2),
    state: z.string().optional(),
    city: z.string().optional(),
    commercialZone: z.string().optional(),
    contractualText: z.string().optional(),
    startDate: Timestamp,
    endDate: Timestamp.optional(),
    exclusive: z.boolean().default(false),
    status: z.enum(['active', 'inactive']).default('active'),
    notes: z.string().optional(),
  })
  .extend(AuditFields.shape);
export type Territory = z.infer<typeof Territory>;

export const Region = z
  .object({
    id: Id,
    organizationId: Id,
    franchiseId: Id.optional(),
    name: z.string(),
    country: z.string().length(2).optional(),
    timezone: z.string().optional(),
  })
  .extend(AuditFields.shape);
export type Region = z.infer<typeof Region>;

export const LocationType = z.enum([
  'mall',
  'cinema',
  'cafe',
  'restaurant',
  'hotel',
  'university',
  'school',
  'transport_terminal',
  'arcade',
  'store',
  'event',
  'tourist_attraction',
  'office',
  'temporary',
  'other',
]);
export type LocationType = z.infer<typeof LocationType>;

export const LocationStatus = z.enum(['active', 'inactive', 'temporary', 'closed', 'planned']);

export const Location = z
  .object({
    id: Id,
    organizationId: Id,
    franchiseId: Id.optional(),
    regionId: Id.optional(),
    internalName: z.string(),
    publicName: z.string(),
    type: LocationType,
    address: Address,
    timezone: z.string(),
    contact: Contact.default({}),
    openingHours: z.array(DailySchedule).default([]),
    accessNotes: z.string().optional(),
    technicianInstructions: z.string().optional(),
    referencePhotoAssetIds: z.array(Id).default([]),
    status: LocationStatus.default('active'),
    installedAt: Timestamp.optional(),
    removedAt: Timestamp.optional(),
    tags: z.array(z.string()).default([]),
  })
  .extend(AuditFields.shape);
export type Location = z.infer<typeof Location>;

/** Estado operativo de una máquina (requisito 13.3). */
export const MachineStatus = z.enum([
  'configuring',
  'active',
  'active_with_warnings',
  'maintenance',
  'out_of_service',
  'disconnected',
  'retired',
  'storage',
  'demo',
  'suspended',
]);
export type MachineStatus = z.infer<typeof MachineStatus>;

export const ReleaseChannel = z.enum([
  'development',
  'internal',
  'pilot',
  'stable',
  'franchise_pilot',
  'production',
]);
export type ReleaseChannel = z.infer<typeof ReleaseChannel>;

export const Machine = z
  .object({
    id: Id,
    code: z.string(),
    name: z.string(),
    organizationId: Id,
    franchiseId: Id.optional(),
    regionId: Id.optional(),
    locationId: Id.optional(),
    hardwareProfileId: Id,
    blueprintId: Id.optional(),
    status: MachineStatus.default('configuring'),
    capabilities: z.array(MachineCapabilityState).default([]),
    printers: z.array(PrinterDefinition).default([]),
    softwareVersion: z.string().optional(),
    targetSoftwareVersion: z.string().optional(),
    bundleVersion: z.string().optional(),
    targetBundleVersion: z.string().optional(),
    releaseChannel: ReleaseChannel.default('stable'),
    online: z.boolean().default(false),
    lastSeenAt: Timestamp.optional(),
    installedAt: Timestamp.optional(),
    timezone: z.string().optional(),
    localContact: Contact.default({}),
    notes: z.string().optional(),
    tags: z.array(z.string()).default([]),
  })
  .extend(AuditFields.shape);
export type Machine = z.infer<typeof Machine>;

export const HardwareProfile = z
  .object({
    id: Id,
    organizationId: Id.optional(),
    name: z.string(),
    description: z.string().optional(),
    camera: z.object({
      type: z.string(),
      count: z.number().int().min(0),
      resolution: PixelSize,
      orientation: z.enum(['portrait', 'landscape']),
    }),
    printers: z.array(PrinterDefinition),
    paperSizes: z.array(PaperSize),
    display: z.object({
      touch: z.boolean(),
      resolution: PixelSize,
      orientation: z.enum(['portrait', 'landscape']),
    }),
    lighting: z.boolean(),
    storageMinGb: z.number().int(),
    peripherals: z.array(z.string()).default([]),
    paymentReader: z.boolean(),
    audio: z.boolean(),
    sensors: z.array(z.string()).default([]),
    expectedCapabilities: z.array(CapabilityKey),
    version: z.number().int().default(1),
  })
  .extend(AuditFields.shape);
export type HardwareProfile = z.infer<typeof HardwareProfile>;

/** Configuración reusable de un tipo comercial de estación (requisito 44). */
export const Blueprint = z
  .object({
    id: Id,
    organizationId: Id.optional(),
    key: z.string(),
    name: LocalizedText,
    description: LocalizedText.optional(),
    hardwareProfileId: Id,
    productIds: z.array(Id).default([]),
    configValues: z.record(z.string(), z.unknown()).default({}),
    featureModes: z.record(z.string(), z.string()).default({}),
    maintenanceChecklistId: Id.optional(),
    baseCampaignIds: z.array(Id).default([]),
  })
  .extend(AuditFields.shape);
export type Blueprint = z.infer<typeof Blueprint>;
