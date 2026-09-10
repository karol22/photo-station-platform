// Fixtures deterministas para las pruebas del motor. Sin `Date.now()`: todo instante es fijo.
import type {
  Campaign,
  ConfigLayer,
  ConfigLevel,
  ConfigLock,
  DocumentPreset,
  DocumentPresetSpec,
  DocumentPresetVersion,
  EffectiveConfig,
  FeatureKey,
  FeatureMode,
  FeatureState,
  Id,
  JsonValue,
  LockPolicy,
  PrintTemplate,
  Product,
} from '@psp/contracts';
import { Campaign as CampaignSchema } from '@psp/contracts';
import type { BundleInput, CampaignOverlayInput } from '../index';

export const NOW = new Date('2026-09-09T12:00:00Z');
export const AT = '2026-09-01T00:00:00Z';
export const TZ = 'America/Mexico_City';

const ENTITY_BY_LEVEL: Record<ConfigLevel, Id | undefined> = {
  platform: undefined,
  organization: 'org_1',
  blueprint: 'bp_1',
  franchise: 'fr_1',
  region: 'reg_1',
  location: 'loc_1',
  machine: 'mch_1',
  campaign: 'cmp_1',
};

export interface LayerOptions {
  entityId?: Id;
  locks?: ConfigLock[];
  id?: Id;
}

export function layer(
  level: ConfigLevel,
  values: Record<string, JsonValue> = {},
  options: LayerOptions = {},
): ConfigLayer {
  const entityId = options.entityId ?? ENTITY_BY_LEVEL[level];
  return {
    id: options.id ?? `cfg_${level}_${entityId ?? 'root'}`,
    level,
    ...(entityId !== undefined ? { entityId } : {}),
    values,
    locks: options.locks ?? [],
    version: 1,
    updatedAt: AT,
  };
}

export function lock(
  key: string,
  policy: LockPolicy,
  setBy: ConfigLevel,
  range?: ConfigLock['range'],
): ConfigLock {
  return { key, policy, setBy, ...(range !== undefined ? { range } : {}) };
}

/** Cadena completa de seis niveles con una clave distinta por nivel. */
export function chain(): ConfigLayer[] {
  return [
    layer('platform', { 'timing.idleTimeoutSec': 90 }),
    layer('organization', {
      'branding.publicName': 'Marca Demo',
      'branding.palette.primary': '#112233',
    }),
    layer('franchise', { 'branding.palette.accent': '#445566' }),
    layer('region', { 'kiosk.defaultLocale': 'en' }),
    layer('location', { 'printing.defaultCopies': 2 }),
    layer('machine', { 'kiosk.screenBrightness': 70 }),
  ];
}

export interface CampaignOptions {
  priority?: number;
  startsAt?: string;
  endsAt?: string;
  values?: Record<string, JsonValue>;
  locks?: ConfigLock[];
}

export function campaign(id: Id, options: CampaignOptions = {}): Campaign {
  return CampaignSchema.parse({
    id,
    organizationId: 'org_1',
    name: { es: `Campaña ${id}` },
    startsAt: options.startsAt ?? '2026-09-01T00:00:00Z',
    endsAt: options.endsAt ?? '2026-10-01T00:00:00Z',
    targets: { scopes: [{ level: 'organization', id: 'org_1' }] },
    priority: options.priority ?? 0,
    status: 'active',
    configOverlay: { values: options.values ?? {}, locks: options.locks ?? [] },
    createdAt: '2026-08-01T00:00:00Z',
  });
}

export function overlay(id: Id, options: CampaignOptions = {}): CampaignOverlayInput {
  const entity = campaign(id, options);
  return {
    campaign: entity,
    layer: {
      id: `cfg_${id}`,
      level: 'campaign',
      entityId: id,
      values: entity.configOverlay.values,
      locks: entity.configOverlay.locks,
      version: 1,
      updatedAt: AT,
    },
  };
}

export function product(id: Id, amount: number): Product {
  return {
    id,
    organizationId: 'org_1',
    internalName: `product-${id}`,
    displayName: { es: `Producto ${id}` },
    category: 'documents',
    kind: 'document',
    description: { es: 'Descripción' },
    whatYouGet: { es: 'Fotos impresas' },
    estimatedDurationSec: 120,
    captureCount: 1,
    printCount: 1,
    output: { templateId: 'tpl_1', paperSize: '4x6in', copies: 1 },
    editing: { enabled: true, allowedTools: ['crop'], allowedPresetIds: [] },
    retakes: { max: 3, perPhoto: true, wholeSession: false, keepPreviousForCompare: true },
    autoCapture: false,
    manualCapture: true,
    basePrice: { amount, currency: 'MXN' },
    hardwareRequirements: [],
    requiredFeatures: [],
    schedule: [],
    timing: {},
    status: 'active',
    priority: 100,
    tags: [],
    createdAt: AT,
  };
}

export function template(id: Id, version = 1): PrintTemplate {
  return {
    id,
    name: { es: `Plantilla ${id}` },
    kind: 'single',
    paperSize: '4x6in',
    canvas: { widthMm: 152, heightMm: 102, dpi: 300 },
    orientation: 'landscape',
    photoSlots: 1,
    elements: [],
    variants: [],
    version,
    status: 'published',
    tags: [],
    createdAt: AT,
  };
}

export function preset(id: Id, currentVersion = 1): DocumentPreset {
  return {
    id,
    name: { es: `Preset ${id}` },
    country: 'MX',
    category: 'passport',
    currentVersion,
    status: 'active',
    tags: [],
    searchTerms: [],
    createdAt: AT,
  };
}

export function presetSpec(): DocumentPresetSpec {
  return {
    physical: { widthMm: 35, heightMm: 45, orientation: 'portrait', dpi: 300 },
    color: 'color',
    background: 'white',
    face: {
      heightRatio: { min: 0.6, max: 0.8 },
      eyeLineFromTop: { min: 0.35, max: 0.5 },
      centerXTolerance: 0.05,
      topMarginMin: 0.05,
      sideMarginMin: 0.1,
      shouldersVisible: true,
    },
    expression: 'neutral',
    smile: 'forbidden',
    glasses: 'allowed',
    hairCoveringFace: 'forbidden',
    accessories: 'forbidden',
    headCover: 'forbidden',
    retouch: 'none',
    paper: { type: 'photo', finish: 'matte' },
    defaultCopies: 4,
    sheetTemplateId: 'tpl_sheet',
    customerInstructions: { es: 'Mire a la cámara.' },
    editing: { enabled: true, allowedTools: ['crop'], allowedPresetIds: [] },
    autoCapture: { enabled: true, stabilityMs: 1200 },
    thresholds: {
      maxRollDeg: 5,
      maxYawDeg: 8,
      maxPitchDeg: 8,
      minBrightness: 0.3,
      maxBrightness: 0.85,
      minContrast: 0.2,
      minSharpness: 40,
      minBackgroundUniformity: 0.7,
      minEyeOpen: 0.35,
      maxGlassesGlare: 0.4,
    },
  };
}

export function presetVersion(presetId: Id, version: number): DocumentPresetVersion {
  return { presetId, version, spec: presetSpec(), createdAt: AT };
}

export function feature(key: FeatureKey, mode: FeatureMode = 'enabled'): FeatureState {
  return { key, mode, source: 'default' };
}

export function bundleInput(
  effective: EffectiveConfig,
  overrides: Partial<BundleInput> = {},
): BundleInput {
  return {
    machineId: 'mch_1',
    organizationId: 'org_1',
    generatedAt: '2026-09-09T12:00:00Z',
    basedOn: {
      layerIds: ['cfg_organization_org_1', 'cfg_machine_mch_1'],
      campaignIds: [],
      catalogRevision: 'rev_1',
    },
    organization: {
      id: 'org_1',
      name: 'Organización Demo',
      slug: 'demo',
      currency: 'MXN',
      defaultLocale: 'es',
      locales: ['es', 'en'],
      timezone: TZ,
      country: 'MX',
      support: {},
    },
    machine: {
      id: 'mch_1',
      code: 'M-001',
      name: 'Máquina 1',
      releaseChannel: 'stable',
      printers: [],
    },
    hardwareProfile: {
      id: 'hw_1',
      name: 'Perfil base',
      camera: {
        type: 'usb',
        count: 1,
        resolution: { width: 1920, height: 1080 },
        orientation: 'portrait',
      },
      printers: [],
      paperSizes: ['4x6in'],
      display: { touch: true, resolution: { width: 1080, height: 1920 }, orientation: 'portrait' },
      lighting: false,
      storageMinGb: 32,
      peripherals: [],
      paymentReader: false,
      audio: true,
      sensors: [],
      expectedCapabilities: ['camera.primary', 'display.touch'],
      version: 1,
      createdAt: AT,
    },
    effective,
    products: [product('prd_1', 15000)],
    prices: [
      {
        productId: 'prd_1',
        list: { amount: 15000, currency: 'MXN' },
        final: { amount: 15000, currency: 'MXN' },
        appliedPromotionIds: [],
        provenance: { level: 'organization', id: 'org_1' },
      },
    ],
    promotions: [],
    presets: [preset('pst_1')],
    presetVersions: [presetVersion('pst_1', 1)],
    templates: [template('tpl_1')],
    experiences: [],
    editingPresets: [],
    campaigns: [campaign('cmp_1')],
    features: [feature('documents.mode')],
    retentionPolicies: [],
    maintenanceChecklists: [],
    assets: [
      {
        assetId: 'ast_1',
        hash: 'a'.repeat(64),
        mime: 'image/png',
        bytes: 10,
        url: '/assets/ast_1',
      },
    ],
    ...overrides,
  };
}
