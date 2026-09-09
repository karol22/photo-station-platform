/**
 * Fixtures deterministas para las pruebas del dominio. Se construyen con los esquemas de
 * contracts (`parse`) para heredar defaults y garantizar que las formas son válidas.
 */
import {
  Franchise,
  Location,
  Machine,
  Organization,
  PrinterRuntime,
  Product,
  Region,
  RoleAssignment,
  StationSession,
  SupportAccess,
  User,
  type CapabilityKey,
  type MachineCapabilityState,
  type PaperSize,
  type PrinterStatus,
  type PrinterType,
  type RoleKey,
  type Scope,
} from '@psp/contracts';
import { buildHierarchyIndex, type HierarchyIndex } from '../hierarchy';

export const AT = '2026-09-01T00:00:00Z';
/** Martes 8 de septiembre de 2026, 18:00 en America/Mexico_City (UTC-6). */
export const NOW = new Date('2026-09-09T00:00:00Z');
export const TZ = 'America/Mexico_City';

export const ORG = 'org_lumina';
export const ORG_OTHER = 'org_other';
export const FR_NORTE = 'fr_norte';
export const FR_BAJIO = 'fr_bajio';
export const REG_NORTE = 'reg_norte';
export const LOC_N1 = 'loc_norte_1';
export const LOC_N2 = 'loc_norte_2';
export const LOC_B1 = 'loc_bajio_1';
export const LOC_HQ = 'loc_hq';

export function organization(id: string, over: Record<string, unknown> = {}): Organization {
  return Organization.parse({
    id,
    slug: id,
    name: `Organización ${id}`,
    country: 'MX',
    currency: 'MXN',
    timezone: TZ,
    defaultLocale: 'es',
    locales: ['es', 'en'],
    createdAt: AT,
    ...over,
  });
}

export function franchise(id: string, organizationId: string, over: Record<string, unknown> = {}): Franchise {
  return Franchise.parse({ id, organizationId, name: `Franquicia ${id}`, createdAt: AT, ...over });
}

export function region(id: string, organizationId: string, franchiseId?: string): Region {
  return Region.parse({ id, organizationId, name: `Región ${id}`, createdAt: AT, ...(franchiseId ? { franchiseId } : {}) });
}

export function location(id: string, over: { organizationId: string; franchiseId?: string; regionId?: string }): Location {
  return Location.parse({
    id,
    internalName: id,
    publicName: `Ubicación ${id}`,
    type: 'mall',
    address: { line1: 'Calle 1', city: 'Ciudad', country: 'MX' },
    timezone: TZ,
    createdAt: AT,
    ...over,
  });
}

export function capability(key: CapabilityKey, present = true, operational = true): MachineCapabilityState {
  return { key, present, operational };
}

export const STANDARD_CAPABILITIES: MachineCapabilityState[] = [
  capability('camera.primary'),
  capability('display.touch'),
  capability('printer.photo'),
  capability('storage.local'),
];

export function machine(
  id: string,
  over: {
    organizationId: string;
    franchiseId?: string;
    regionId?: string;
    locationId?: string;
    tags?: string[];
    releaseChannel?: string;
    hardwareProfileId?: string;
    capabilities?: MachineCapabilityState[];
    status?: string;
  },
): Machine {
  const { capabilities, ...rest } = over;
  return Machine.parse({
    id,
    code: id.toUpperCase(),
    name: `Máquina ${id}`,
    hardwareProfileId: 'hwp_std',
    status: 'active',
    capabilities: capabilities ?? STANDARD_CAPABILITIES,
    printers: [{ id: 'prn_1', name: 'Foto', type: 'photo', paperSizes: ['4x6in'], color: true }],
    createdAt: AT,
    ...rest,
  });
}

export function printer(
  id: string,
  over: { type?: PrinterType; paperSizes?: PaperSize[]; status?: PrinterStatus; paperEstimate?: number } = {},
): PrinterRuntime {
  return PrinterRuntime.parse({
    id,
    name: id,
    type: over.type ?? 'photo',
    paperSizes: over.paperSizes ?? ['4x6in'],
    color: true,
    status: over.status ?? 'ready',
    ...(over.paperEstimate !== undefined ? { paperEstimate: over.paperEstimate } : {}),
  });
}

export function product(id: string, over: Record<string, unknown> = {}): Product {
  return Product.parse({
    id,
    organizationId: ORG,
    internalName: id,
    displayName: { es: `Producto ${id}`, en: `Product ${id}` },
    category: 'documents',
    kind: 'document',
    description: { es: 'Descripción' },
    whatYouGet: { es: 'Lo que recibes' },
    estimatedDurationSec: 120,
    captureCount: 1,
    printCount: 1,
    output: { templateId: 'tpl_doc', paperSize: '4x6in', copies: 1, printerType: 'photo' },
    editing: { enabled: true, allowedTools: ['crop', 'brightness'] },
    retakes: { max: 3 },
    basePrice: { amount: 8000, currency: 'MXN' },
    status: 'active',
    createdAt: AT,
    ...over,
  });
}

export function user(id: string, over: Record<string, unknown> = {}): User {
  return User.parse({ id, email: `${id}@example.test`, name: id, createdAt: AT, ...over });
}

export function assignment(id: string, userId: string, roleKey: RoleKey, scope: Scope, over: Record<string, unknown> = {}): RoleAssignment {
  return RoleAssignment.parse({ id, userId, roleKey, scope, grantedAt: AT, ...over });
}

export function supportAccess(id: string, userId: string, scope: Scope, permissions: string[], over: Record<string, unknown> = {}): SupportAccess {
  return SupportAccess.parse({
    id,
    userId,
    scope,
    permissions,
    reason: 'Incidencia INC-1',
    grantedBy: 'usr_platform',
    startsAt: '2026-09-08T00:00:00Z',
    expiresAt: '2026-09-10T00:00:00Z',
    ...over,
  });
}

/** Jerarquía demo: una marca con dos franquicias (5 máquinas en norte, 2 en bajío), una sede y otra marca. */
export function demoHierarchy(): HierarchyIndex & { all: Parameters<typeof buildHierarchyIndex>[0] } {
  const data = {
    organizations: [organization(ORG), organization(ORG_OTHER)],
    franchises: [franchise(FR_NORTE, ORG), franchise(FR_BAJIO, ORG)],
    regions: [region(REG_NORTE, ORG, FR_NORTE)],
    locations: [
      location(LOC_N1, { organizationId: ORG, franchiseId: FR_NORTE, regionId: REG_NORTE }),
      location(LOC_N2, { organizationId: ORG, franchiseId: FR_NORTE }),
      location(LOC_B1, { organizationId: ORG, franchiseId: FR_BAJIO }),
      location(LOC_HQ, { organizationId: ORG }),
    ],
    machines: [
      machine('mch_n1', { organizationId: ORG, franchiseId: FR_NORTE, locationId: LOC_N1, tags: ['piloto'] }),
      machine('mch_n2', { organizationId: ORG, franchiseId: FR_NORTE, locationId: LOC_N1 }),
      // Sin franchiseId propio: lo hereda de la ubicación.
      machine('mch_n3', { organizationId: ORG, locationId: LOC_N2, releaseChannel: 'pilot' }),
      machine('mch_n4', { organizationId: ORG, franchiseId: FR_NORTE, locationId: LOC_N2, hardwareProfileId: 'hwp_thermal' }),
      machine('mch_n5', { organizationId: ORG, franchiseId: FR_NORTE, locationId: LOC_N2 }),
      machine('mch_b1', { organizationId: ORG, franchiseId: FR_BAJIO, locationId: LOC_B1 }),
      machine('mch_b2', { organizationId: ORG, franchiseId: FR_BAJIO, locationId: LOC_B1, tags: ['piloto'] }),
      machine('mch_hq', { organizationId: ORG, locationId: LOC_HQ }),
      machine('mch_other', { organizationId: ORG_OTHER }),
    ],
  };
  return { ...buildHierarchyIndex(data), all: data };
}

export const scope = {
  platform: (): Scope => ({ level: 'platform' }),
  organization: (id: string): Scope => ({ level: 'organization', id }),
  franchise: (id: string): Scope => ({ level: 'franchise', id }),
  region: (id: string): Scope => ({ level: 'region', id }),
  location: (id: string): Scope => ({ level: 'location', id }),
  machine: (id: string): Scope => ({ level: 'machine', id }),
};

/** Sesión completa tal como la ve el kiosco, con rutas locales de fotografías que nunca deben salir. */
export function stationSession(over: Record<string, unknown> = {}): StationSession {
  const prd = product('prd_doc');
  return StationSession.parse({
    id: 'ses_1',
    code: 'AB3D7K',
    stage: 'done',
    startedAt: '2026-09-08T23:00:00Z',
    updatedAt: '2026-09-08T23:04:00Z',
    endedAt: '2026-09-08T23:04:30Z',
    locale: 'es',
    product: prd,
    presetVersion: {
      presetId: 'pst_uni',
      version: 3,
      createdAt: AT,
      spec: {
        physical: { widthMm: 25, heightMm: 30, orientation: 'portrait' },
        color: 'color',
        background: 'white',
        face: {
          heightRatio: { min: 0.5, max: 0.7 },
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
        paper: { type: 'photo', finish: 'matte' },
        defaultCopies: 4,
        sheetTemplateId: 'tpl_sheet',
        customerInstructions: { es: 'Mira al frente.' },
        editing: { enabled: true, allowedTools: ['crop'] },
        autoCapture: { enabled: true },
        thresholds: {},
      },
    },
    templateId: 'tpl_doc',
    templateVersion: 2,
    bundleVersion: 'bundle_abc',
    captures: [
      { id: 'cap_1', index: 0, takenAt: '2026-09-08T23:01:00Z', width: 1200, height: 1600, url: 'file:///var/station/mch_n1/sessions/ses_1/cap_1.png', editedUrl: 'file:///var/station/mch_n1/sessions/ses_1/cap_1_edit.png', selected: true },
      { id: 'cap_2', index: 0, takenAt: '2026-09-08T23:01:30Z', width: 1200, height: 1600, url: 'file:///var/station/mch_n1/sessions/ses_1/cap_2.png', retakeOf: 'cap_1', auto: true },
    ],
    retakesUsed: 1,
    edits: { cap_1: [{ op: 'brightness', params: { amount: 0.1 } }] },
    editingToolsUsed: ['brightness'],
    selection: ['cap_1'],
    composition: { url: 'file:///var/station/mch_n1/sessions/ses_1/composition.png', width: 1800, height: 1200, createdAt: '2026-09-08T23:02:00Z' },
    copies: 2,
    printJobs: [
      { id: 'job_1', sessionId: 'ses_1', machineId: 'mch_n1', printerId: 'prn_1', copies: 2, status: 'failed', attempt: 1, idempotencyKey: 'k1', createdAt: '2026-09-08T23:03:00Z', error: 'jam' },
      { id: 'job_2', sessionId: 'ses_1', machineId: 'mch_n1', printerId: 'prn_1', copies: 2, status: 'completed', attempt: 2, idempotencyKey: 'k1', createdAt: '2026-09-08T23:03:30Z', completedAt: '2026-09-08T23:04:00Z', outputPath: '/var/station/mch_n1/prints/job_2.png' },
      { id: 'job_t', machineId: 'mch_n1', printerId: 'prn_1', copies: 1, status: 'completed', idempotencyKey: 'kt', isTest: true, createdAt: '2026-09-08T22:00:00Z' },
    ],
    payment: { id: 'pay_1', sessionId: 'ses_1', amount: { amount: 8000, currency: 'MXN' }, state: 'approved', adapter: 'mock', createdAt: '2026-09-08T23:00:30Z', updatedAt: '2026-09-08T23:00:40Z' },
    commercial: { state: 'paid_simulated', listPrice: { amount: 8000, currency: 'MXN' }, finalPrice: { amount: 8000, currency: 'MXN' }, paymentState: 'approved', adapter: 'mock' },
    consents: [{ kind: 'service', given: true, at: '2026-09-08T23:00:10Z', textVersion: 'v1' }],
    timers: { idleTimeoutSec: 60, warningBeforeCancelSec: 15, captureCountdownSec: 3, prepareBeforeCaptureSec: 2, reviewTimeoutSec: 90, autoCaptureStabilityMs: 1200, paymentTimeoutSec: 90 },
    retention: { policyId: 'ret_temp', customerText: { es: 'Se elimina en 30 minutos.' }, deleteAt: '2026-09-08T23:34:30Z' },
    errors: [{ code: 'print_jam', message: 'Atasco de papel', at: '2026-09-08T23:03:10Z', stage: 'printing' }],
    isDemo: false,
    operatorStarted: false,
    ...over,
  });
}
