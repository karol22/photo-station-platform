import { describe, expect, it } from 'vitest';
import {
  Asset,
  Blueprint,
  Campaign,
  ConfigBundle,
  ConfigLayer,
  DocumentPreset,
  DocumentPresetVersion,
  EditingPreset,
  Entitlement,
  EntitlementPlan,
  Experience,
  FeatureOverride,
  Franchise,
  HardwareProfile,
  Location,
  Machine,
  MaintenanceChecklist,
  Organization,
  PriceRule,
  PrintTemplate,
  Product,
  ProductAvailability,
  Promotion,
  Region,
  RetentionPolicy,
  type DocumentPresetSpec,
  type PrinterRuntime,
} from '@psp/contracts';
import { computeKioskAvailability, materializeBundle, type BundleSource } from './index';

const NOW = new Date('2026-09-09T12:00:00Z');
const T0 = '2026-01-01T00:00:00Z';
const es = (text: string) => ({ es: text });

/** Dataset mínimo construido a mano y validado contra los contratos (los `.parse` rellenan defaults). */
function buildSource(): BundleSource {
  const spec: DocumentPresetSpec = {
    physical: { widthMm: 35, heightMm: 45, orientation: 'portrait', dpi: 300 },
    color: 'color',
    background: 'white',
    face: {
      heightRatio: { min: 0.6, max: 0.75 },
      eyeLineFromTop: { min: 0.35, max: 0.45 },
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
    paper: { type: 'photo', finish: 'glossy' },
    defaultCopies: 4,
    sheetTemplateId: 'tpl_sheet',
    customerInstructions: es('Mire al frente'),
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
  const product = (over: Partial<Product> & Pick<Product, 'id' | 'organizationId' | 'priority'>): Product =>
    Product.parse({
      internalName: over.id,
      displayName: es(over.id),
      category: 'documents',
      kind: 'document',
      description: es('desc'),
      whatYouGet: es('foto'),
      estimatedDurationSec: 120,
      captureCount: 1,
      printCount: 1,
      output: { templateId: 'tpl_sheet', paperSize: '4x6in', copies: 1, printerType: 'photo' },
      editing: { enabled: true, allowedTools: ['crop'], allowedPresetIds: [] },
      retakes: { max: 2 },
      basePrice: { amount: 8000, currency: 'MXN' },
      hardwareRequirements: ['printer.photo'],
      status: 'active',
      createdAt: T0,
      ...over,
    });
  const asset = (id: string): Asset =>
    Asset.parse({
      id,
      name: id,
      category: 'other',
      ownerScope: { level: 'platform' },
      mime: 'image/svg+xml',
      bytes: 10,
      hash: `hash_${id}`,
      path: `assets/hash_${id}`,
      createdAt: T0,
    });
  const printer = { id: 'p1', name: 'Photo', type: 'photo', paperSizes: ['4x6in'], color: true, priority: 0 };
  const hardware = (id: string, printers: unknown[]): HardwareProfile =>
    HardwareProfile.parse({
      id,
      name: id,
      camera: { type: 'usb', count: 1, resolution: { width: 1920, height: 1080 }, orientation: 'portrait' },
      printers,
      paperSizes: ['4x6in'],
      display: { touch: true, resolution: { width: 1080, height: 1920 }, orientation: 'portrait' },
      lighting: false,
      storageMinGb: 32,
      paymentReader: false,
      audio: false,
      expectedCapabilities: ['camera.primary'],
      createdAt: T0,
    });
  const machine = (over: Partial<Machine> & Pick<Machine, 'id' | 'organizationId' | 'hardwareProfileId'>): Machine =>
    Machine.parse({
      code: over.id.toUpperCase(),
      name: over.id,
      status: 'active',
      capabilities: [
        { key: 'camera.primary', present: true, operational: true },
        { key: 'printer.photo', present: true, operational: true },
      ],
      printers: [printer],
      createdAt: T0,
      ...over,
    });
  const template = (over: Partial<PrintTemplate> & Pick<PrintTemplate, 'id'>): PrintTemplate =>
    PrintTemplate.parse({
      name: es(over.id),
      kind: 'single',
      paperSize: '4x6in',
      canvas: { widthMm: 102, heightMm: 152 },
      orientation: 'portrait',
      photoSlots: 1,
      elements: [],
      createdAt: T0,
      ...over,
    });
  const campaign = (over: Partial<Campaign> & Pick<Campaign, 'id' | 'organizationId' | 'status' | 'targets'>): Campaign =>
    Campaign.parse({
      name: es(over.id),
      startsAt: '2026-09-01T00:00:00Z',
      endsAt: '2026-09-30T00:00:00Z',
      createdAt: T0,
      ...over,
    });
  const layer = (over: Partial<ConfigLayer> & Pick<ConfigLayer, 'id' | 'level' | 'values'>): ConfigLayer =>
    ConfigLayer.parse({ updatedAt: T0, ...over });

  return {
    organizations: [
      Organization.parse({ id: 'org_a', slug: 'a', name: 'Org A', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', defaultLocale: 'es', locales: ['es', 'en'], createdAt: T0 }),
      Organization.parse({ id: 'org_b', slug: 'b', name: 'Org B', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', defaultLocale: 'es', locales: ['es'], createdAt: T0 }),
    ],
    franchises: [
      Franchise.parse({ id: 'fr_north', organizationId: 'org_a', name: 'Norte', createdAt: T0 }),
      Franchise.parse({ id: 'fr_south', organizationId: 'org_a', name: 'Sur', createdAt: T0 }),
    ],
    regions: [Region.parse({ id: 'reg_n', organizationId: 'org_a', franchiseId: 'fr_north', name: 'Región N', createdAt: T0 })],
    locations: [
      Location.parse({ id: 'loc_cafe', organizationId: 'org_a', franchiseId: 'fr_north', regionId: 'reg_n', internalName: 'Cafe', publicName: 'Café', type: 'cafe', address: { line1: 'x', city: 'y', country: 'MX' }, timezone: 'America/Monterrey', tags: ['cafe'], createdAt: T0 }),
      Location.parse({ id: 'loc_b', organizationId: 'org_b', internalName: 'B', publicName: 'B', type: 'mall', address: { line1: 'x', city: 'y', country: 'MX' }, timezone: 'America/Mexico_City', createdAt: T0 }),
    ],
    machines: [
      machine({ id: 'mch_a1', organizationId: 'org_a', franchiseId: 'fr_north', regionId: 'reg_n', locationId: 'loc_cafe', hardwareProfileId: 'hw_doc', blueprintId: 'bp_doc', tags: ['pilot'] }),
      machine({ id: 'mch_a2', organizationId: 'org_a', hardwareProfileId: 'hw_thermal' }),
      machine({ id: 'mch_b1', organizationId: 'org_b', locationId: 'loc_b', hardwareProfileId: 'hw_doc' }),
    ],
    hardwareProfiles: [hardware('hw_doc', [printer]), hardware('hw_thermal', [])],
    blueprints: [Blueprint.parse({ id: 'bp_doc', key: 'doc', name: es('Documental'), hardwareProfileId: 'hw_doc', configValues: { 'kiosk.attractRotationSec': 10 }, createdAt: T0 })],
    products: [
      product({ id: 'prd_doc', organizationId: 'org_a', priority: 10, presetId: 'pst_1', coverAssetId: 'ast_cover' }),
      product({ id: 'prd_fun', organizationId: 'org_a', priority: 20, kind: 'entertainment', category: 'fun', experienceId: 'exp_1', output: { templateId: 'tpl_strip', paperSize: '4x6in', copies: 1 }, editing: { enabled: true, allowedTools: ['frames'], allowedPresetIds: ['edp_1'] } }),
      product({ id: 'prd_thermal', organizationId: 'org_a', priority: 30, kind: 'entertainment', category: 'receipt_photo', hardwareRequirements: [] }),
      product({ id: 'prd_disabled', organizationId: 'org_a', priority: 40 }),
      product({ id: 'prd_inactive', organizationId: 'org_a', priority: 50, status: 'inactive' }),
      product({ id: 'prd_b', organizationId: 'org_b', priority: 10 }),
    ],
    productAvailabilities: [
      ProductAvailability.parse({ id: 'pa1', productId: 'prd_disabled', scope: { level: 'franchise', id: 'fr_north' }, enabled: false, updatedAt: T0 }),
      ProductAvailability.parse({ id: 'pa2', productId: 'prd_thermal', scope: { level: 'organization', id: 'org_a' }, enabled: false, updatedAt: T0 }),
      ProductAvailability.parse({ id: 'pa3', productId: 'prd_thermal', scope: { level: 'machine', id: 'mch_a2' }, enabled: true, updatedAt: T0 }),
    ],
    priceRules: [
      PriceRule.parse({ id: 'pr1', productId: 'prd_doc', scope: { level: 'organization', id: 'org_a' }, price: { amount: 8000, currency: 'MXN' }, updatedAt: T0 }),
      PriceRule.parse({ id: 'pr2', productId: 'prd_doc', scope: { level: 'franchise', id: 'fr_north' }, price: { amount: 7500, currency: 'MXN' }, updatedAt: T0 }),
    ],
    promotions: [
      Promotion.parse({ id: 'promo1', organizationId: 'org_a', name: es('10%'), type: 'percent_discount', value: 10, productIds: ['prd_fun'], scope: { level: 'organization', id: 'org_a' }, status: 'active', createdAt: T0 }),
    ],
    presets: [DocumentPreset.parse({ id: 'pst_1', name: es('Universidad'), country: 'MX', category: 'university', currentVersion: 2, createdAt: T0 })],
    presetVersions: [
      DocumentPresetVersion.parse({ presetId: 'pst_1', version: 1, spec, createdAt: T0 }),
      DocumentPresetVersion.parse({ presetId: 'pst_1', version: 2, spec: { ...spec, defaultCopies: 6 }, changeNote: 'copias', createdAt: T0 }),
    ],
    templates: [
      template({ id: 'tpl_sheet', kind: 'document_sheet', documentSheet: { photoWidthMm: 35, photoHeightMm: 45, gutterMm: 2, cutMarks: true } }),
      template({ id: 'tpl_strip', organizationId: 'org_a', kind: 'strip_vertical', photoSlots: 4, elements: [{ id: 'f', type: 'frame', box: { x: 0, y: 0, w: 50, h: 150, rotationDeg: 0 }, zIndex: 0, assetId: 'ast_frame' }] }),
      template({ id: 'tpl_campaign', organizationId: 'org_a' }),
    ],
    experiences: [
      Experience.parse({ id: 'exp_1', organizationId: 'org_a', key: 'friends', name: es('Amigos'), theme: 'best_friends', description: es('d'), poses: [{ key: 'p1', name: es('Pose'), instruction: es('Sonríe'), silhouetteAssetId: 'ast_sil' }], selection: { min: 1, max: 4 }, frameAssetIds: ['ast_frame2'], editingPresetIds: ['edp_1'], templateId: 'tpl_strip', createdAt: T0 }),
    ],
    editingPresets: [EditingPreset.parse({ id: 'edp_1', organizationId: 'org_a', key: 'warm', name: es('Cálido'), ops: [{ op: 'temperature', params: { amount: 0.2 } }], createdAt: T0 })],
    campaigns: [
      campaign({ id: 'cmp_active', organizationId: 'org_a', status: 'active', priority: 5, targets: { scopes: [{ level: 'franchise', id: 'fr_north' }], tags: [] }, configOverlay: { values: { 'branding.publicName': 'Campaña' }, locks: [] }, assetIds: ['ast_cmp'], templateIds: ['tpl_campaign'] }),
      campaign({ id: 'cmp_sched', organizationId: 'org_a', status: 'scheduled', priority: 1, startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-31T00:00:00Z', targets: { scopes: [], tags: ['cafe'] }, configOverlay: { values: { 'branding.tone': 'playful' }, locks: [] } }),
      campaign({ id: 'cmp_cancelled', organizationId: 'org_a', status: 'cancelled', targets: { scopes: [{ level: 'organization', id: 'org_a' }], tags: [] } }),
      campaign({ id: 'cmp_other', organizationId: 'org_a', status: 'active', targets: { scopes: [{ level: 'franchise', id: 'fr_south' }], tags: [] } }),
      campaign({ id: 'cmp_b', organizationId: 'org_b', status: 'active', targets: { scopes: [{ level: 'organization', id: 'org_b' }], tags: [] } }),
    ],
    assets: ['ast_cover', 'ast_frame', 'ast_frame2', 'ast_sil', 'ast_cmp', 'ast_logo', 'ast_unused'].map(asset),
    retentionPolicies: [
      RetentionPolicy.parse({ id: 'ret_global', name: es('Global'), mode: 'none', customerText: es('t') }),
      RetentionPolicy.parse({ id: 'ret_a', organizationId: 'org_a', name: es('A'), mode: 'temporary', durationMinutes: 30, customerText: es('t') }),
      RetentionPolicy.parse({ id: 'ret_b', organizationId: 'org_b', name: es('B'), mode: 'none', customerText: es('t') }),
    ],
    maintenanceChecklists: [
      MaintenanceChecklist.parse({ id: 'chk_global', name: es('General'), items: [{ key: 'screen', label: es('Pantalla') }] }),
      MaintenanceChecklist.parse({ id: 'chk_thermal', hardwareProfileId: 'hw_thermal', name: es('Térmica'), items: [] }),
    ],
    configLayers: [
      layer({ id: 'cfg_platform', level: 'platform', values: { 'sync.heartbeatIntervalSec': 20 } }),
      layer({ id: 'cfg_org_a', level: 'organization', entityId: 'org_a', values: { 'branding.logoAssetId': 'ast_logo', 'timing.idleTimeoutSec': 45 }, locks: [{ key: 'timing.idleTimeoutSec', policy: 'mandatory', setBy: 'organization', setById: 'org_a' }] }),
      layer({ id: 'cfg_fr_north', level: 'franchise', entityId: 'fr_north', values: { 'branding.publicName': 'Norte' } }),
      layer({ id: 'cfg_mch_a1', level: 'machine', entityId: 'mch_a1', values: { 'timing.idleTimeoutSec': 30, 'kiosk.volume': 70 } }),
    ],
    featureOverrides: [FeatureOverride.parse({ id: 'fo1', key: 'editing.creative', scope: { level: 'franchise', id: 'fr_north' }, mode: 'hidden', setAt: T0 })],
    entitlementPlans: [EntitlementPlan.parse({ id: 'plan_full', key: 'full', name: es('Completo'), features: ['documents.mode', 'documents.autoCapture', 'editing.local', 'editing.creative', 'printing.photo', 'entertainment.mode', 'campaigns'] })],
    entitlements: [Entitlement.parse({ id: 'ent_a', scope: { level: 'organization', id: 'org_a' }, planId: 'plan_full', startsAt: T0 })],
  };
}

const OPTS = { now: NOW, assetUrlBase: '/fleet/v1/assets' };

describe('materializeBundle', () => {
  const source = buildSource();
  const bundle = materializeBundle(source, 'mch_a1', OPTS);

  it('produce un bundle válido según el contrato y determinista', () => {
    expect(ConfigBundle.safeParse(bundle).success).toBe(true);
    const again = materializeBundle(source, 'mch_a1', { ...OPTS, generatedAt: '2030-01-01T00:00:00Z' });
    expect(again.version).toBe(bundle.version);
    expect(again.generatedAt).not.toBe(bundle.generatedAt);
    const later = materializeBundle(source, 'mch_a1', { ...OPTS, now: new Date('2026-12-15T12:00:00Z') });
    expect(later.version).not.toBe(bundle.version);
  });

  it('resuelve la cadena de capas con blueprint, bloqueos y overlay de campaña vigente', () => {
    expect(bundle.effective.values['branding.publicName']).toBe('Campaña');
    expect(bundle.effective.provenance['branding.publicName']?.level).toBe('campaign');
    expect(bundle.effective.values['branding.tone']).toBe('friendly');
    expect(bundle.effective.values['kiosk.attractRotationSec']).toBe(10);
    expect(bundle.effective.values['sync.heartbeatIntervalSec']).toBe(20);
    expect(bundle.effective.values['kiosk.volume']).toBe(70);
    expect(bundle.effective.values['timing.idleTimeoutSec']).toBe(45);
    expect(bundle.effective.rejected.some((r) => r.key === 'timing.idleTimeoutSec' && r.level === 'machine')).toBe(true);
    expect(bundle.basedOn.layerIds).toEqual(['cfg_platform', 'cfg_org_a', 'cfg_fr_north', 'cfg_mch_a1', 'cfg_blueprint_bp_doc']);
  });

  it('incluye las campañas aplicables (activas y programadas) y excluye el resto', () => {
    expect(bundle.campaigns.map((c) => c.id)).toEqual(['cmp_sched', 'cmp_active']);
    expect(bundle.basedOn.campaignIds).toEqual(['cmp_sched', 'cmp_active']);
  });

  it('filtra productos por organización, estado y disponibilidad de la cadena, ordenados por prioridad', () => {
    expect(bundle.products.map((p) => p.id)).toEqual(['prd_doc', 'prd_fun']);
    const a2 = materializeBundle(source, 'mch_a2', OPTS);
    expect(a2.products.map((p) => p.id)).toEqual(['prd_doc', 'prd_fun', 'prd_thermal', 'prd_disabled']);
    const b1 = materializeBundle(source, 'mch_b1', OPTS);
    expect(b1.products.map((p) => p.id)).toEqual(['prd_b']);
    expect(b1.campaigns.map((c) => c.id)).toEqual(['cmp_b']);
    expect(b1.retentionPolicies.map((r) => r.id)).toEqual(['ret_b', 'ret_global']);
  });

  it('resuelve un precio por producto con la regla más específica de la cadena', () => {
    expect(bundle.prices.map((p) => p.productId)).toEqual(['prd_doc', 'prd_fun']);
    const doc = bundle.prices[0];
    expect(doc?.list.currency).toBe('MXN');
    expect(doc?.list.amount).toBe(7500);
    expect(doc?.final.amount).toBeLessThanOrEqual(doc?.list.amount ?? 0);
  });

  it('lleva presets en su versión actual, plantillas, experiencias y presets de edición referenciados', () => {
    expect(bundle.presets.map((p) => p.id)).toEqual(['pst_1']);
    expect(bundle.presetVersions.map((v) => v.version)).toEqual([2]);
    expect(bundle.templates.map((t) => t.id)).toEqual(['tpl_campaign', 'tpl_sheet', 'tpl_strip']);
    expect(bundle.experiences.map((e) => e.id)).toEqual(['exp_1']);
    expect(bundle.editingPresets.map((e) => e.id)).toEqual(['edp_1']);
    expect(bundle.retentionPolicies.map((r) => r.id)).toEqual(['ret_a', 'ret_global']);
    expect(bundle.maintenanceChecklists.map((c) => c.id)).toEqual(['chk_global']);
  });

  it('resuelve features con overrides de la cadena', () => {
    expect(bundle.features.find((f) => f.key === 'editing.creative')?.mode).toBe('hidden');
    const a2 = materializeBundle(source, 'mch_a2', OPTS);
    expect(a2.features.find((f) => f.key === 'editing.creative')?.mode).toBe('enabled');
  });

  it('sólo lleva al manifiesto los activos referenciados, con URL por hash', () => {
    expect(bundle.assets.map((a) => a.assetId)).toEqual(['ast_cmp', 'ast_cover', 'ast_frame', 'ast_frame2', 'ast_logo', 'ast_sil']);
    expect(bundle.assets[0]?.url).toBe('/fleet/v1/assets/hash_ast_cmp');
  });

  it('falla con código claro si la máquina no existe', () => {
    expect(() => materializeBundle(source, 'mch_nope', OPTS)).toThrow(/machine not found/);
  });
});

describe('computeKioskAvailability', () => {
  const source = buildSource();
  const bundle = materializeBundle(source, 'mch_a1', OPTS);
  const machine = source.machines.find((m) => m.id === 'mch_a1');
  if (!machine) throw new Error('fixture');
  const printer = (status: PrinterRuntime['status']): PrinterRuntime => ({ ...machine.printers[0]!, status });

  it('marca sin papel cuando la impresora compatible no tiene papel', () => {
    const states = computeKioskAvailability(bundle, { machine, printers: [printer('no_paper')], maintenance: false, now: NOW });
    const doc = states.find((s) => s.productId === 'prd_doc');
    expect(doc?.available).toBe(false);
    expect(doc?.reasons).toContain('no_paper');
  });

  it('deja disponible el producto cuando todo está operativo', () => {
    const states = computeKioskAvailability(bundle, { machine, printers: [printer('ready')], maintenance: false, now: NOW });
    expect(states.find((s) => s.productId === 'prd_doc')?.available).toBe(true);
  });
});

describe('dataset demo (si @psp/fixtures ya lo exporta)', () => {
  it('materializa todas las máquinas del dataset demo', async () => {
    // Import relativo (sólo en pruebas): @psp/fixtures no es dependencia del paquete y puede no existir aún.
    let dataset: BundleSource;
    try {
      const fixtures = (await import('../../fixtures/src/index')) as unknown as { demoDataset?: () => BundleSource };
      if (typeof fixtures.demoDataset !== 'function') return;
      dataset = fixtures.demoDataset();
    } catch {
      return;
    }
    for (const machine of dataset.machines) {
      const bundle = materializeBundle(dataset, machine.id, OPTS);
      expect(ConfigBundle.safeParse(bundle).success).toBe(true);
      expect(bundle.machineId).toBe(machine.id);
    }
  });
});
