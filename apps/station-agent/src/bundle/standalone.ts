/**
 * Bundle standalone mínimo: un producto documental, una plantilla de hoja y una impresora
 * fotográfica. Se usa cuando `@psp/fixtures` no puede materializar el dataset demo y en pruebas.
 * Todo pasa por `ConfigBundle.parse`, así que la forma es la del contrato.
 */
import type { ConfigBundle, JsonValue, ProvenanceEntry } from '@psp/contracts';
import { CONFIG_KEYS, ConfigBundle as ConfigBundleSchema } from '@psp/contracts';
import { stableHash } from '@psp/domain';

export interface StandaloneBundleOptions {
  now: Date;
  assetUrlBase: string;
  /** Sobrescribe valores efectivos (p. ej. `payment.businessMode`). */
  values?: Record<string, JsonValue>;
  /** Sobrescribe el modo de funciones concretas (p. ej. `customer.handoff`). */
  featureModes?: Record<string, 'enabled' | 'hidden' | 'locked' | 'coming_soon'>;
}

export function standaloneBundle(machineId: string, opts: StandaloneBundleOptions): ConfigBundle {
  const values: Record<string, JsonValue> = {};
  const provenance: Record<string, ProvenanceEntry> = {};
  for (const definition of CONFIG_KEYS) {
    values[definition.key] = (definition.default ?? null) as JsonValue;
    provenance[definition.key] = { level: 'platform', isDefault: true };
  }
  values['branding.publicName'] = 'Foto Estación Demo';
  values['payment.businessMode'] = 'paid';
  values['payment.terminalAdapter'] = 'mock';
  Object.assign(values, opts.values ?? {});
  const at = opts.now.toISOString();
  const organizationId = 'org_standalone';
  const printer = {
    id: 'prn_photo_1',
    name: 'Impresora fotográfica',
    type: 'photo' as const,
    paperSizes: ['4x6in' as const],
    color: true,
    consumableType: 'photo_paper',
    priority: 0,
  };
  const draft = {
    version: '',
    contractsVersion: 'v1' as const,
    machineId,
    organizationId,
    generatedAt: at,
    basedOn: { layerIds: [], campaignIds: [], catalogRevision: 'standalone' },
    organization: {
      id: organizationId,
      name: 'Organización demo',
      slug: 'demo',
      currency: 'MXN',
      defaultLocale: 'es' as const,
      locales: ['es' as const, 'en' as const],
      timezone: 'America/Mexico_City',
      country: 'MX',
      support: {},
    },
    machine: {
      id: machineId,
      code: 'DEMO-01',
      name: 'Máquina demo',
      timezone: 'America/Mexico_City',
      releaseChannel: 'stable' as const,
      printers: [printer],
    },
    hardwareProfile: {
      id: 'hwp_standalone',
      name: 'Estación documental (standalone)',
      camera: {
        type: 'usb',
        count: 1,
        resolution: { width: 1920, height: 1080 },
        orientation: 'portrait' as const,
      },
      printers: [printer],
      paperSizes: ['4x6in' as const],
      display: {
        touch: true,
        resolution: { width: 1080, height: 1920 },
        orientation: 'portrait' as const,
      },
      lighting: true,
      storageMinGb: 32,
      peripherals: [],
      paymentReader: true,
      audio: true,
      sensors: [],
      expectedCapabilities: [
        'camera.primary',
        'display.touch',
        'printer.photo',
        'printer.color',
        'payment.terminal',
        'connectivity.online',
        'storage.local',
        'audio.output',
      ] as const,
      createdAt: at,
    },
    effective: { values, provenance, locks: {}, rejected: [], hash: stableHash(values) },
    products: [
      {
        id: 'prd_standalone_doc',
        organizationId,
        internalName: 'doc-standalone',
        displayName: { es: 'Fotos para documentos', en: 'Document photos' },
        category: 'documents' as const,
        kind: 'document' as const,
        description: { es: 'Hoja de fotografías tamaño infantil.', en: 'Sheet of ID photos.' },
        whatYouGet: { es: '6 fotografías impresas', en: '6 printed photos' },
        estimatedDurationSec: 120,
        captureCount: 1,
        printCount: 1,
        output: { templateId: 'tpl_standalone_sheet', paperSize: '4x6in' as const, copies: 1 },
        editing: {
          enabled: true,
          allowedTools: ['brightness' as const, 'contrast' as const],
          allowedPresetIds: [],
        },
        retakes: { max: 3 },
        basePrice: { amount: 8000, currency: 'MXN' },
        status: 'active' as const,
        priority: 10,
        createdAt: at,
      },
    ],
    prices: [
      {
        productId: 'prd_standalone_doc',
        list: { amount: 8000, currency: 'MXN' },
        final: { amount: 8000, currency: 'MXN' },
        appliedPromotionIds: [],
        provenance: { level: 'platform' as const },
      },
    ],
    promotions: [],
    presets: [],
    presetVersions: [],
    templates: [
      {
        id: 'tpl_standalone_sheet',
        organizationId,
        name: { es: 'Hoja documental 4x6', en: 'Document sheet 4x6' },
        kind: 'document_sheet' as const,
        paperSize: '4x6in' as const,
        canvas: { widthMm: 152, heightMm: 102, dpi: 300 },
        orientation: 'landscape' as const,
        photoSlots: 6,
        elements: [],
        variants: [],
        version: 1,
        status: 'published' as const,
        documentSheet: { photoWidthMm: 35, photoHeightMm: 45, gutterMm: 2, cutMarks: true },
        createdAt: at,
      },
    ],
    experiences: [],
    editingPresets: [],
    campaigns: [],
    features: [
      { key: 'documents.mode' as const, mode: 'enabled' as const, source: 'default' as const },
      { key: 'printing.photo' as const, mode: 'enabled' as const, source: 'default' as const },
      { key: 'editing.local' as const, mode: 'enabled' as const, source: 'default' as const },
      { key: 'payments.terminal' as const, mode: 'enabled' as const, source: 'default' as const },
      { key: 'kiosk.demoMode' as const, mode: 'enabled' as const, source: 'default' as const },
      { key: 'ai.experiences' as const, mode: 'coming_soon' as const, source: 'default' as const },
      {
        key: 'delivery.digital' as const,
        mode: 'coming_soon' as const,
        source: 'default' as const,
      },
      { key: 'customer.handoff' as const, mode: 'hidden' as const, source: 'default' as const },
    ].map((feature) => {
      const override = opts.featureModes?.[feature.key];
      return override ? { ...feature, mode: override } : feature;
    }),
    retentionPolicies: [
      {
        id: 'ret_delete_on_finish',
        name: { es: 'Eliminar al terminar', en: 'Delete on finish' },
        mode: 'none' as const,
        deleteIncomplete: true,
        appliesToKinds: [],
        customerText: {
          es: 'Tus fotos se procesan en esta máquina y se eliminan al terminar la sesión.',
          en: 'Your photos are processed on this machine and deleted when the session ends.',
        },
        leavesDevice: false,
      },
    ],
    maintenanceChecklists: [],
    assets: [],
  };
  const version = stableHash({ ...draft, generatedAt: undefined });
  return ConfigBundleSchema.parse({ ...draft, version });
}
