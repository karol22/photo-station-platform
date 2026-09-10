/**
 * Dataset mínimo para pruebas herméticas (no depende de @psp/fixtures): una organización, dos
 * franquicias con una ubicación y una máquina cada una, tres usuarios (owner, franquiciatario del
 * norte y analista), un producto documental con preset/plantilla, capas de configuración con un
 * bloqueo de plataforma, una release publicada y un rollout en borrador hacia la franquicia norte.
 */
import type { SeedDataset } from '../seed/index';
import { sha256HexOf } from './auth';

export const TEST_NOW = new Date('2026-09-09T12:00:00Z');
const T = TEST_NOW.toISOString();

export const TEST_USERS = [
  { id: 'usr_owner', email: 'owner@psp.test', password: 'owner-pass', passwordHash: sha256HexOf('owner-pass') },
  { id: 'usr_franq_norte', email: 'franq@norte.test', password: 'norte-pass', passwordHash: sha256HexOf('norte-pass') },
  { id: 'usr_analyst', email: 'analyst@psp.test', password: 'analyst-pass', passwordHash: sha256HexOf('analyst-pass') },
];

const printer = { id: 'prn_photo_1', name: 'Photo printer', type: 'photo', paperSizes: ['4x6in'], color: true, consumableType: 'photo_paper', priority: 0 };

export function testDataset(): SeedDataset {
  return {
    organizations: [
      { id: 'org_lumina', slug: 'lumina', name: 'Lumina', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', defaultLocale: 'es', locales: ['es', 'en'], dateFormat: 'dd/MM/yyyy', timeFormat: 'HH:mm', support: {}, legal: {}, status: 'active', createdAt: T },
    ],
    franchises: [
      { id: 'fr_norte', organizationId: 'org_lumina', name: 'Franquicia Norte', contact: {}, status: 'active', createdAt: T },
      { id: 'fr_sur', organizationId: 'org_lumina', name: 'Franquicia Sur', contact: {}, status: 'active', createdAt: T },
    ],
    regions: [],
    territories: [],
    locations: [
      { id: 'loc_norte_1', organizationId: 'org_lumina', franchiseId: 'fr_norte', internalName: 'Plaza Norte', publicName: 'Plaza Norte', type: 'mall', address: { line1: 'Av. Norte 1', city: 'Monterrey', country: 'MX' }, timezone: 'America/Monterrey', contact: {}, openingHours: [], referencePhotoAssetIds: [], status: 'active', tags: [], createdAt: T },
      { id: 'loc_sur_1', organizationId: 'org_lumina', franchiseId: 'fr_sur', internalName: 'Plaza Sur', publicName: 'Plaza Sur', type: 'mall', address: { line1: 'Av. Sur 1', city: 'Oaxaca', country: 'MX' }, timezone: 'America/Mexico_City', contact: {}, openingHours: [], referencePhotoAssetIds: [], status: 'active', tags: [], createdAt: T },
    ],
    machines: [
      { id: 'mch_norte_1', code: 'NOR-001', name: 'Norte 1', organizationId: 'org_lumina', franchiseId: 'fr_norte', locationId: 'loc_norte_1', hardwareProfileId: 'hwp_std', status: 'active', capabilities: [{ key: 'camera.primary', present: true, operational: true }, { key: 'printer.photo', present: true, operational: true }], printers: [printer], softwareVersion: '0.4.2', releaseChannel: 'stable', online: true, lastSeenAt: T, timezone: 'America/Monterrey', localContact: {}, tags: [], createdAt: T },
      { id: 'mch_sur_1', code: 'SUR-001', name: 'Sur 1', organizationId: 'org_lumina', franchiseId: 'fr_sur', locationId: 'loc_sur_1', hardwareProfileId: 'hwp_std', status: 'active', capabilities: [{ key: 'camera.primary', present: true, operational: true }, { key: 'printer.photo', present: true, operational: true }], printers: [printer], softwareVersion: '0.4.2', releaseChannel: 'stable', online: false, lastSeenAt: '2026-09-01T12:00:00Z', timezone: 'America/Mexico_City', localContact: {}, tags: [], createdAt: T },
    ],
    hardwareProfiles: [
      { id: 'hwp_std', name: 'Standard', camera: { type: 'usb', count: 1, resolution: { width: 1920, height: 1080 }, orientation: 'portrait' }, printers: [printer], paperSizes: ['4x6in'], display: { touch: true, resolution: { width: 1080, height: 1920 }, orientation: 'portrait' }, lighting: true, storageMinGb: 64, peripherals: [], paymentReader: false, audio: true, sensors: [], expectedCapabilities: ['camera.primary', 'printer.photo'], version: 1, createdAt: T },
    ],
    blueprints: [],
    users: [
      { id: 'usr_owner', email: 'owner@psp.test', name: 'Owner', status: 'active', locale: 'es', createdAt: T },
      { id: 'usr_franq_norte', email: 'franq@norte.test', name: 'Franquiciatario Norte', status: 'active', locale: 'es', createdAt: T },
      { id: 'usr_analyst', email: 'analyst@psp.test', name: 'Analista', status: 'active', locale: 'es', createdAt: T },
    ],
    roleAssignments: [
      { id: 'ras_owner', userId: 'usr_owner', roleKey: 'platform_owner', scope: { level: 'platform' }, grantedAt: T },
      { id: 'ras_norte', userId: 'usr_franq_norte', roleKey: 'franchise_owner', scope: { level: 'franchise', id: 'fr_norte' }, grantedAt: T },
      { id: 'ras_analyst', userId: 'usr_analyst', roleKey: 'analyst', scope: { level: 'organization', id: 'org_lumina' }, grantedAt: T },
    ],
    supportAccesses: [],
    products: [
      { id: 'prd_doc', organizationId: 'org_lumina', internalName: 'Foto infantil', displayName: { es: 'Foto infantil' }, category: 'documents', kind: 'document', description: { es: 'Foto tamaño infantil' }, whatYouGet: { es: '6 fotos' }, estimatedDurationSec: 120, captureCount: 1, printCount: 1, output: { templateId: 'tpl_sheet', paperSize: '4x6in', copies: 1 }, presetId: 'pst_infantil', editing: { enabled: true, allowedTools: ['crop'], allowedPresetIds: [] }, retakes: { max: 3, perPhoto: true, wholeSession: false, keepPreviousForCompare: true }, autoCapture: false, manualCapture: true, basePrice: { amount: 8000, currency: 'MXN' }, hardwareRequirements: ['camera.primary', 'printer.photo'], requiredFeatures: [], schedule: [], timing: {}, status: 'active', priority: 10, tags: [], createdAt: T },
    ],
    productAvailabilities: [],
    priceRules: [
      { id: 'prc_doc_org', productId: 'prd_doc', scope: { level: 'organization', id: 'org_lumina' }, price: { amount: 8000, currency: 'MXN' }, schedule: [], priority: 0, updatedAt: T },
    ],
    promotions: [],
    presets: [
      { id: 'pst_infantil', organizationId: 'org_lumina', name: { es: 'Infantil' }, country: 'MX', category: 'other', currentVersion: 1, status: 'active', tags: [], searchTerms: [], createdAt: T },
    ],
    presetVersions: [
      { presetId: 'pst_infantil', version: 1, createdAt: T, spec: { physical: { widthMm: 25, heightMm: 30, orientation: 'portrait', dpi: 300 }, color: 'color', background: 'white', face: { heightRatio: { min: 0.5, max: 0.7 }, eyeLineFromTop: { min: 0.3, max: 0.5 }, centerXTolerance: 0.05, topMarginMin: 0.05, sideMarginMin: 0.05, shouldersVisible: true }, expression: 'neutral', smile: 'forbidden', glasses: 'allowed', hairCoveringFace: 'forbidden', accessories: 'forbidden', headCover: 'forbidden', retouch: 'none', paper: { type: 'photo', finish: 'matte' }, defaultCopies: 1, sheetTemplateId: 'tpl_sheet', customerInstructions: { es: 'Mire a la cámara' }, editing: { enabled: true, allowedTools: ['crop'], allowedPresetIds: [] }, autoCapture: { enabled: false, stabilityMs: 1200 }, thresholds: { maxRollDeg: 5, maxYawDeg: 8, maxPitchDeg: 8, minBrightness: 0.3, maxBrightness: 0.85, minContrast: 0.2, minSharpness: 40, minBackgroundUniformity: 0.7, minEyeOpen: 0.35, maxGlassesGlare: 0.4 } } },
    ],
    templates: [
      { id: 'tpl_sheet', organizationId: 'org_lumina', name: { es: 'Hoja 4x6' }, kind: 'document_sheet', paperSize: '4x6in', canvas: { widthMm: 101.6, heightMm: 152.4, dpi: 300 }, orientation: 'portrait', photoSlots: 6, elements: [], variants: [], version: 1, status: 'published', tags: [], documentSheet: { photoWidthMm: 25, photoHeightMm: 30, gutterMm: 2, cutMarks: true }, createdAt: T },
    ],
    experiences: [],
    editingPresets: [],
    campaigns: [
      { id: 'cmp_verano', organizationId: 'org_lumina', name: { es: 'Verano' }, startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-31T00:00:00Z', targets: { scopes: [{ level: 'organization', id: 'org_lumina' }], tags: [] }, productIds: ['prd_doc'], priceOverrides: [], templateIds: [], assetIds: [], texts: {}, priority: 0, status: 'scheduled', configOverlay: { values: { 'branding.footerText': 'Campaña de verano' }, locks: [] }, franchiseEditableKeys: [], mandatory: false, createdAt: T },
    ],
    assets: [
      { id: 'ast_logo', organizationId: 'org_lumina', name: 'Logo', category: 'logo', ownerScope: { level: 'organization', id: 'org_lumina' }, tags: [], status: 'active', version: 1, locales: [], mime: 'image/png', bytes: 3, hash: 'a'.repeat(64), path: 'a'.repeat(64), createdAt: T },
    ],
    retentionPolicies: [
      { id: 'ret_delete_on_finish', name: { es: 'Borrar al terminar' }, mode: 'none', deleteIncomplete: true, appliesToKinds: [], customerText: { es: 'Tus fotos se borran al terminar.' }, leavesDevice: false },
    ],
    maintenanceChecklists: [],
    configLayers: [
      { id: 'cfg_platform', level: 'platform', values: { 'kiosk.attractRotationSec': 8 }, locks: [{ key: 'kiosk.attractRotationSec', policy: 'mandatory', setBy: 'platform' }], version: 1, updatedAt: T },
      { id: 'cfg_org_lumina', level: 'organization', entityId: 'org_lumina', values: { 'branding.publicName': 'Lumina Foto', 'branding.logoAssetId': 'ast_logo' }, locks: [], version: 1, updatedAt: T },
    ],
    featureOverrides: [],
    entitlementPlans: [],
    entitlements: [],
    releases: [
      { id: 'rel_0_5_0', version: '0.5.0', channel: 'stable', artifactHash: 'b'.repeat(64), compatibility: { requiresRestart: true, contractsVersion: 'v1' }, status: 'published', approved: true, publishedAt: T, createdAt: T },
    ],
    rollouts: [
      { id: 'rlt_norte', releaseId: 'rel_0_5_0', name: 'Piloto norte', targets: [{ kind: 'franchise', franchiseId: 'fr_norte' }], schedule: {}, status: 'draft', isRollback: false, createdAt: T },
    ],
    internalDocuments: [],
    announcements: [],
    incidents: [
      { id: 'inc_1', code: 'INC-0001', machineId: 'mch_sur_1', locationId: 'loc_sur_1', organizationId: 'org_lumina', franchiseId: 'fr_sur', severity: 'high', category: 'printer', title: 'Impresora atascada', evidenceAssetIds: [], reportedAt: T, reportedBy: { type: 'machine', id: 'mch_sur_1' }, status: 'open', notes: [], partsUsed: [], source: 'auto', createdAt: T },
    ],
    maintenanceLogs: [],
    consumables: [],
    savedViews: [],
    sessionRecords: [
      { id: 'ses_1', code: 'ABC123', machineId: 'mch_norte_1', locationId: 'loc_norte_1', organizationId: 'org_lumina', franchiseId: 'fr_norte', startedAt: '2026-09-09T10:00:00Z', endedAt: '2026-09-09T10:03:00Z', stage: 'done', result: 'completed', productId: 'prd_doc', productName: 'Foto infantil', productKind: 'document', captures: 1, retakes: 1, printsRequested: 1, printsCompleted: 1, durationSec: 180, commercial: { state: 'paid_simulated', promotionIds: [], paymentState: 'approved', finalPrice: { amount: 8000, currency: 'MXN' } }, softwareVersion: '0.4.2', bundleVersion: 'x', errors: [], consents: [], retention: { policyId: 'ret_delete_on_finish', mode: 'none' }, isDemo: false, operatorStarted: false, locale: 'es', editingUsed: false, editingTools: [] },
    ],
  };
}
