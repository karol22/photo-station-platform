/**
 * Tipos de apoyo del paquete. No dependen de zod directamente: las formas de entrada y salida
 * se leen de los esquemas exportados por `@psp/contracts` (`_input` / `_output`).
 */
import type {
  Announcement,
  Asset,
  Blueprint,
  Campaign,
  ConfigLayer,
  Consumable,
  DocumentPreset,
  DocumentPresetVersion,
  EditingPreset,
  Entitlement,
  EntitlementPlan,
  Experience,
  FeatureOverride,
  Franchise,
  HardwareProfile,
  Id,
  Incident,
  InternalDocument,
  Location,
  Machine,
  MaintenanceChecklist,
  MaintenanceLog,
  Organization,
  PriceRule,
  PrintTemplate,
  Product,
  ProductAvailability,
  Promotion,
  Region,
  Release,
  RetentionPolicy,
  RoleAssignment,
  RoleKey,
  Rollout,
  Scope,
  SessionRecord,
  SupportAccess,
  Territory,
  User,
} from '@psp/contracts';

/** Forma de entrada de un esquema zod (campos con default opcionales). */
export type Input<S extends { _input: unknown }> = S['_input'];
/** Forma de salida de un esquema zod (defaults aplicados). */
export type Output<S extends { _output: unknown }> = S['_output'];

/** Dataset demo completo. Cada colección está tipada con su contrato y validada por las pruebas. */
export interface DemoDataset {
  organizations: Organization[];
  franchises: Franchise[];
  territories: Territory[];
  regions: Region[];
  locations: Location[];
  machines: Machine[];
  hardwareProfiles: HardwareProfile[];
  blueprints: Blueprint[];
  users: User[];
  roleAssignments: RoleAssignment[];
  supportAccesses: SupportAccess[];
  products: Product[];
  productAvailabilities: ProductAvailability[];
  priceRules: PriceRule[];
  promotions: Promotion[];
  presets: DocumentPreset[];
  presetVersions: DocumentPresetVersion[];
  templates: PrintTemplate[];
  experiences: Experience[];
  editingPresets: EditingPreset[];
  campaigns: Campaign[];
  assets: Asset[];
  retentionPolicies: RetentionPolicy[];
  maintenanceChecklists: MaintenanceChecklist[];
  configLayers: ConfigLayer[];
  featureOverrides: FeatureOverride[];
  entitlementPlans: EntitlementPlan[];
  entitlements: Entitlement[];
  releases: Release[];
  rollouts: Rollout[];
  internalDocuments: InternalDocument[];
  announcements: Announcement[];
  incidents: Incident[];
  maintenanceLogs: MaintenanceLog[];
  consumables: Consumable[];
  sessionRecords: SessionRecord[];
}

/** Usuario demo con credencial. `passwordHash` es sha256 hex de `password`; nunca viaja en `User`. */
export interface DemoUser {
  id: Id;
  email: string;
  password: string;
  passwordHash: string;
  name: string;
  roleKey: RoleKey;
  scope: Scope;
}

/** Resultado de `generateFleet`: entidades nuevas que se agregan al dataset base. */
export interface FleetResult {
  machines: Machine[];
  locations: Location[];
  configLayers: ConfigLayer[];
}

/** Contenido binario de un activo generado. */
export interface AssetContent {
  mime: string;
  bytes: Uint8Array;
}

/** Subconjunto del dataset que necesita el generador de sesiones. */
export type SessionHistoryBase = Pick<
  DemoDataset,
  | 'organizations'
  | 'locations'
  | 'machines'
  | 'blueprints'
  | 'products'
  | 'presets'
  | 'presetVersions'
  | 'templates'
  | 'priceRules'
  | 'promotions'
  | 'campaigns'
  | 'retentionPolicies'
  | 'configLayers'
  | 'incidents'
>;

/** Subconjunto del dataset que necesita el generador de flota. */
export type FleetBase = Pick<
  DemoDataset,
  'organizations' | 'franchises' | 'regions' | 'locations' | 'machines' | 'hardwareProfiles' | 'blueprints'
>;
