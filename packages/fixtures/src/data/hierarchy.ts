/**
 * Jerarquía demo: organizaciones, franquicias, territorios, regiones, ubicaciones, perfiles de
 * hardware, blueprints y máquinas. Las máquinas llevan explícitos organización, franquicia, región y
 * ubicación para que `scopeChain` de @psp/domain resuelva sin ambigüedad.
 */
import {
  Blueprint,
  Franchise,
  HardwareProfile,
  Location,
  Machine,
  Organization,
  Region,
  Territory,
  type CapabilityKey,
  type MachineCapabilityState,
  type PrinterDefinition,
} from '@psp/contracts';
import { DEMO_IDS, PILOT_TAG, SOFTWARE_VERSIONS } from '../ids';
import { hoursAgo, minutesAgo, daysAgo } from '../time';
import { L, TZ_BOG, TZ_MTY, TZ_MX, audit } from './common';

const ID = DEMO_IDS;

export function buildOrganizations(): Organization[] {
  return [
    Organization.parse({
      id: ID.org.unaDeTodos,
      slug: 'una-de-todos',
      name: 'Una de Todos',
      legalName: 'Una de Todos Fotografía S.A. de C.V.',
      country: 'MX',
      currency: 'MXN',
      timezone: TZ_MX,
      defaultLocale: 'es',
      locales: ['es', 'en'],
      support: { name: 'Soporte Una de Todos', phone: '+52 55 0000 0001', email: 'soporte@unadetodos.demo' },
      legal: {
        privacyNotice: L('Una de Todos usa tu foto sólo para imprimirla y la borra de la máquina al terminar la sesión.', 'Una de Todos uses your photo only to print it and deletes it from the machine when the session ends.'),
        terms: L('El servicio se presta tal cual; verifica la foto antes de imprimir.', 'The service is provided as is; check the photo before printing.'),
      },
      ...audit(ID.user.owner),
      createdAt: '2026-01-15T12:00:00Z',
    }),
    Organization.parse({
      id: ID.org.fotorapida,
      slug: 'fotorapida',
      name: 'FotoRápida',
      legalName: 'FotoRápida Colombia S.A.S.',
      country: 'CO',
      currency: 'COP',
      timezone: TZ_BOG,
      defaultLocale: 'es',
      locales: ['es'],
      support: { name: 'Soporte FotoRápida', phone: '+57 1 000 0002', email: 'soporte@fotorapida.demo' },
      legal: { privacyNotice: L('FotoRápida no conserva tus fotografías después de imprimir.') },
      ...audit(ID.user.owner),
      createdAt: '2026-03-01T12:00:00Z',
    }),
  ];
}

export function buildFranchises(): Franchise[] {
  return [
    Franchise.parse({ id: ID.franchise.norte, organizationId: ID.org.unaDeTodos, name: 'Una de Todos Norte', legalName: 'Fotografía del Norte S.A. de C.V.', contact: { name: 'Franquiciatario Norte', email: 'franq@norte.demo', phone: '+52 81 0000 0003' }, status: 'active', notes: 'Franquicia piloto: universidades y cafeterías de Monterrey.', ...audit(ID.user.adminUnaDeTodos), createdAt: '2026-02-01T12:00:00Z' }),
    Franchise.parse({ id: ID.franchise.bajio, organizationId: ID.org.unaDeTodos, name: 'Una de Todos Bajío', legalName: 'Imagen Bajío S. de R.L.', contact: { name: 'Franquiciatario Bajío', email: 'franq@bajio.demo', phone: '+52 442 000 0004' }, status: 'active', notes: 'Cines y hoteles en Querétaro y León.', ...audit(ID.user.adminUnaDeTodos), createdAt: '2026-04-01T12:00:00Z' }),
  ];
}

export function buildTerritories(): Territory[] {
  return [
    Territory.parse({ id: ID.territory.norteNuevoLeon, franchiseId: ID.franchise.norte, country: 'MX', state: 'Nuevo León', city: 'Monterrey', commercialZone: 'Área metropolitana de Monterrey', contractualText: 'Exclusividad en campus universitarios del área metropolitana.', startDate: '2026-02-01T00:00:00Z', exclusive: true, ...audit(ID.user.adminUnaDeTodos) }),
    Territory.parse({ id: ID.territory.bajioQroGto, franchiseId: ID.franchise.bajio, country: 'MX', state: 'Querétaro y Guanajuato', commercialZone: 'Corredor Querétaro–León', startDate: '2026-04-01T00:00:00Z', exclusive: false, ...audit(ID.user.adminUnaDeTodos) }),
  ];
}

export function buildRegions(): Region[] {
  return [
    Region.parse({ id: ID.region.norte, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.norte, name: 'Norte', country: 'MX', timezone: TZ_MTY, ...audit() }),
    Region.parse({ id: ID.region.bajio, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.bajio, name: 'Bajío', country: 'MX', timezone: TZ_MX, ...audit() }),
    Region.parse({ id: ID.region.centro, organizationId: ID.org.unaDeTodos, name: 'Centro', country: 'MX', timezone: TZ_MX, ...audit() }),
    Region.parse({ id: ID.region.bogota, organizationId: ID.org.fotorapida, name: 'Bogotá', country: 'CO', timezone: TZ_BOG, ...audit() }),
  ];
}

const weekdays = [1, 2, 3, 4, 5];
const weekend = [0, 6];
const allDays = [0, 1, 2, 3, 4, 5, 6];

export function buildLocations(): Location[] {
  return [
    Location.parse({
      id: ID.location.university, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.norte, regionId: ID.region.norte,
      internalName: 'UNI-NORTE-BIBLIOTECA', publicName: 'Universidad del Norte · Biblioteca central', type: 'university',
      address: { line1: 'Av. Universidad 1000', line2: 'Planta baja, junto a control escolar', city: 'Monterrey', state: 'Nuevo León', postalCode: '64000', country: 'MX' },
      timezone: TZ_MTY, contact: { name: 'Coordinación de servicios escolares', phone: '+52 81 0000 1001', email: 'servicios@uninorte.demo' },
      openingHours: [{ days: weekdays, from: '07:00', to: '21:00' }, { days: [6], from: '08:00', to: '14:00' }],
      accessNotes: 'Registrarse en vigilancia con identificación; la máquina está frente a ventanillas.',
      technicianInstructions: 'Llave del gabinete en caseta de vigilancia. Evitar horario de inscripciones (agosto).',
      status: 'active', installedAt: '2026-02-15T15:00:00Z', tags: ['universidad', 'documentos', 'alto-trafico'], ...audit(ID.user.franqNorte),
    }),
    Location.parse({
      id: ID.location.cafe, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.norte, regionId: ID.region.norte,
      internalName: 'CAFE-AURORA-SANPEDRO', publicName: 'Café Aurora · San Pedro', type: 'cafe',
      address: { line1: 'Calzada del Valle 200', city: 'San Pedro Garza García', state: 'Nuevo León', postalCode: '66220', country: 'MX' },
      timezone: TZ_MTY, contact: { name: 'Gerencia Café Aurora', phone: '+52 81 0000 1002' },
      openingHours: [{ days: allDays, from: '08:00', to: '22:00' }],
      accessNotes: 'Entrada por el patio; la cafetería presta enchufe dedicado.',
      technicianInstructions: 'Impresora térmica: rollo 58 mm; existencias en la barra.',
      status: 'active', installedAt: '2026-05-10T16:00:00Z', tags: ['cafeteria', 'termica'], ...audit(ID.user.franqNorte),
    }),
    Location.parse({
      id: ID.location.mallCdmx, organizationId: ID.org.unaDeTodos, regionId: ID.region.centro,
      internalName: 'MALL-CDMX-SUR', publicName: 'Plaza Meridiano Sur', type: 'mall',
      address: { line1: 'Av. Insurgentes Sur 3500', line2: 'Nivel 2, pasillo de cines', city: 'Ciudad de México', state: 'CDMX', postalCode: '14000', country: 'MX' },
      timezone: TZ_MX, contact: { name: 'Administración Plaza Meridiano', phone: '+52 55 0000 1003', email: 'admin@meridiano.demo' },
      openingHours: [{ days: allDays, from: '10:00', to: '22:00' }],
      accessNotes: 'Acceso de proveedores por andén norte antes de las 10:00.',
      technicianInstructions: 'Cabina premium: dos cámaras; revisar lector de pago mock al reiniciar.',
      status: 'active', installedAt: '2026-06-20T18:00:00Z', tags: ['mall', 'premium', PILOT_TAG], ...audit(ID.user.adminUnaDeTodos),
    }),
    Location.parse({
      id: ID.location.cinema, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.bajio, regionId: ID.region.bajio,
      internalName: 'CINE-QRO-JURIQUILLA', publicName: 'Cinema Juriquilla', type: 'cinema',
      address: { line1: 'Blvd. Juriquilla 3100', city: 'Querétaro', state: 'Querétaro', postalCode: '76230', country: 'MX' },
      timezone: TZ_MX, contact: { name: 'Gerencia Cinema Juriquilla', phone: '+52 442 000 1004' },
      openingHours: [{ days: allDays, from: '11:00', to: '23:30' }],
      accessNotes: 'Máquina en el lobby, junto a dulcería.',
      technicianInstructions: 'Poca luz ambiental: verificar iluminación integrada.',
      status: 'active', installedAt: '2026-07-01T17:00:00Z', tags: ['cine', 'bajio'], ...audit(ID.user.adminUnaDeTodos),
    }),
    Location.parse({
      id: ID.location.hotel, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.bajio, regionId: ID.region.bajio,
      internalName: 'HOTEL-LEON-CENTRO', publicName: 'Hotel Casa Real León', type: 'hotel',
      address: { line1: 'Calle Madero 45', city: 'León', state: 'Guanajuato', postalCode: '37000', country: 'MX' },
      timezone: TZ_MX, contact: { name: 'Recepción Hotel Casa Real', phone: '+52 477 000 1005' },
      openingHours: [{ days: allDays, from: '06:00', to: '23:59' }],
      accessNotes: 'Lobby; cortesía para huéspedes (modo courtesy).',
      technicianInstructions: 'Coordinar con recepción; hay bodega para papel en planta baja.',
      status: 'active', installedAt: '2026-07-15T17:00:00Z', tags: ['hotel', 'cortesia', 'bajio'], ...audit(ID.user.adminUnaDeTodos),
    }),
    Location.parse({
      id: ID.location.mallBogota, organizationId: ID.org.fotorapida, regionId: ID.region.bogota,
      internalName: 'MALL-BOG-CHAPINERO', publicName: 'Centro Comercial Andino Norte', type: 'mall',
      address: { line1: 'Carrera 11 # 82-71', line2: 'Piso 1', city: 'Bogotá', state: 'Bogotá D.C.', postalCode: '110221', country: 'CO' },
      timezone: TZ_BOG, contact: { name: 'Administración CC Andino Norte', phone: '+57 1 000 1006' },
      openingHours: [{ days: weekdays, from: '10:00', to: '21:00' }, { days: weekend, from: '11:00', to: '20:00' }],
      accessNotes: 'Puesto fijo frente a la entrada principal.',
      status: 'active', installedAt: '2026-05-01T15:00:00Z', tags: ['mall', 'colombia'], ...audit(ID.user.adminFotorapida),
    }),
  ];
}

/** Impresoras canónicas de cada perfil; las máquinas las reutilizan tal cual. */
export const PRINTERS = {
  photo4x6: { id: ID.printer.photo, name: 'Impresora fotográfica', type: 'photo', paperSizes: ['4x6in', '5x7in', '2x6in-strip'], color: true, consumableType: 'photo_paper', priority: 0 } satisfies PrinterDefinition,
  thermal58: { id: ID.printer.thermal, name: 'Impresora térmica 58 mm', type: 'thermal', paperSizes: ['58mm-thermal'], color: false, consumableType: 'thermal_paper', priority: 0 } satisfies PrinterDefinition,
  /** La cabina premium imprime tiras 2x6 cortando hojas 4x6: por eso declara `2x6in-strip`. */
  photoPremium: { id: ID.printer.photo, name: 'Impresora fotográfica premium', type: 'photo', paperSizes: ['4x6in', '6x8in', '2x6in-strip', '5x7in'], color: true, consumableType: 'photo_paper', priority: 0 } satisfies PrinterDefinition,
} as const;

const CAPS = {
  docStation: ['camera.primary', 'display.touch', 'printer.photo', 'printer.color', 'lighting.controllable', 'connectivity.online', 'storage.local'],
  thermalKiosk: ['camera.primary', 'display.touch', 'printer.thermal', 'printer.bw', 'connectivity.online', 'storage.local'],
  premiumBooth: ['camera.primary', 'camera.secondary', 'display.touch', 'printer.photo', 'printer.color', 'lighting.controllable', 'payment.terminal', 'audio.output', 'sensor.presence', 'connectivity.online', 'storage.local'],
} satisfies Record<string, CapabilityKey[]>;

export function buildHardwareProfiles(): HardwareProfile[] {
  return [
    HardwareProfile.parse({
      id: ID.hardwareProfile.docStation, name: 'Estación documental', description: 'Cámara 1080p vertical, impresora fotográfica 4x6/5x7 a color, pantalla táctil e iluminación frontal.',
      camera: { type: 'usb-uvc', count: 1, resolution: { width: 1080, height: 1920 }, orientation: 'portrait' },
      printers: [PRINTERS.photo4x6], paperSizes: ['4x6in', '5x7in', '2x6in-strip'],
      display: { touch: true, resolution: { width: 1080, height: 1920 }, orientation: 'portrait' },
      lighting: true, storageMinGb: 64, peripherals: ['led-ring'], paymentReader: false, audio: false, sensors: [],
      expectedCapabilities: CAPS.docStation, version: 1, ...audit(ID.user.owner),
    }),
    HardwareProfile.parse({
      id: ID.hardwareProfile.thermalKiosk, name: 'Kiosco térmico', description: 'Cámara 720p, impresora térmica 58 mm en blanco y negro y pantalla táctil; sin iluminación.',
      camera: { type: 'usb-uvc', count: 1, resolution: { width: 720, height: 1280 }, orientation: 'portrait' },
      printers: [PRINTERS.thermal58], paperSizes: ['58mm-thermal'],
      display: { touch: true, resolution: { width: 800, height: 1280 }, orientation: 'portrait' },
      lighting: false, storageMinGb: 32, peripherals: [], paymentReader: false, audio: false, sensors: [],
      expectedCapabilities: CAPS.thermalKiosk, version: 1, ...audit(ID.user.owner),
    }),
    HardwareProfile.parse({
      id: ID.hardwareProfile.premiumBooth, name: 'Cabina premium', description: 'Dos cámaras, impresora fotográfica 4x6/6x8, pantalla táctil, iluminación, lector de pago, audio y sensor de presencia.',
      camera: { type: 'usb-uvc', count: 2, resolution: { width: 2160, height: 3840 }, orientation: 'portrait' },
      printers: [PRINTERS.photoPremium], paperSizes: ['4x6in', '6x8in', '2x6in-strip', '5x7in'],
      display: { touch: true, resolution: { width: 1080, height: 1920 }, orientation: 'portrait' },
      lighting: true, storageMinGb: 128, peripherals: ['led-panel', 'payment-reader', 'speakers'], paymentReader: true, audio: true, sensors: ['presence'],
      expectedCapabilities: CAPS.premiumBooth, version: 1, ...audit(ID.user.owner),
    }),
  ];
}

/**
 * Planos reutilizables de la marca: la familia comercial Pro, AI, Pareja, Familia y Mini. Cada plano
 * es una configuración distinta de la misma plataforma sobre un perfil de hardware. El Club no
 * aparece: es pertenencia, no una variante de gabinete, y pertenece a una etapa posterior.
 */
export function buildBlueprints(): Blueprint[] {
  const P = ID.product;
  return [
    Blueprint.parse({
      id: ID.blueprint.pro, organizationId: ID.org.unaDeTodos, key: 'pro', name: L('Pro', 'Pro'),
      description: L('La experiencia completa: tira social, retrato, campañas y trámites en la misma cabina.', 'The complete experience: social strip, portrait, campaigns and ID photos in one booth.'),
      hardwareProfileId: ID.hardwareProfile.premiumBooth, productIds: [P.friendsStrip, P.portraitPro, P.christmasPortrait, P.docUniversity, P.docVisaUsa],
      configValues: { 'timing.idleTimeoutSec': 90, 'kiosk.volume': 60, 'branding.tone': 'friendly', 'kiosk.showPricesOnIdle': true },
      featureModes: { 'entertainment.mode': 'enabled', 'documents.mode': 'enabled', 'payments.terminal': 'enabled' },
      ...audit(ID.user.adminUnaDeTodos),
    }),
    Blueprint.parse({
      id: ID.blueprint.ai, organizationId: ID.org.unaDeTodos, key: 'ai', name: L('AI', 'AI'),
      description: L('Fondos, estilos y magia con inteligencia artificial, con consentimiento explícito en cada sesión.', 'AI backgrounds, styles and magic, with explicit consent in every session.'),
      hardwareProfileId: ID.hardwareProfile.premiumBooth, productIds: [P.aiAnime, P.friendsStrip, P.portraitPro],
      configValues: { 'timing.idleTimeoutSec': 120, 'kiosk.volume': 60, 'branding.tone': 'playful' },
      featureModes: { 'ai.experiences': 'enabled', 'entertainment.mode': 'enabled', 'payments.terminal': 'enabled' },
      ...audit(ID.user.adminUnaDeTodos),
    }),
    Blueprint.parse({
      id: ID.blueprint.couple, organizationId: ID.org.unaDeTodos, key: 'pareja', name: L('Pareja', 'Couple'),
      description: L('Dos es mejor: poses en pareja y tira social como producto insignia.', 'Two is better: couple poses and the social strip as the flagship product.'),
      hardwareProfileId: ID.hardwareProfile.premiumBooth, productIds: [P.friendsStrip, P.portraitPro],
      configValues: { 'timing.idleTimeoutSec': 75, 'branding.tone': 'friendly' },
      featureModes: { 'entertainment.mode': 'enabled', 'documents.mode': 'hidden' },
      ...audit(ID.user.adminUnaDeTodos),
    }),
    Blueprint.parse({
      id: ID.blueprint.family, organizationId: ID.org.unaDeTodos, key: 'familia', name: L('Familia', 'Family'),
      description: L('Para todos, sin límites: el recorrido social y el documental conviven en la misma máquina.', 'For everyone, no limits: the social journey and the ID journey live in the same machine.'),
      hardwareProfileId: ID.hardwareProfile.docStation, productIds: [P.docUniversity, P.docGraduation, P.docChild, P.docVisaUsa, P.portraitPro, P.christmasPortrait],
      configValues: { 'kiosk.showPricesOnIdle': true, 'timing.idleTimeoutSec': 60, 'branding.tone': 'friendly' },
      featureModes: { 'documents.mode': 'enabled', 'entertainment.mode': 'enabled' },
      maintenanceChecklistId: ID.checklist.docStation, ...audit(ID.user.adminUnaDeTodos),
    }),
    Blueprint.parse({
      id: ID.blueprint.mini, organizationId: ID.org.unaDeTodos, key: 'mini', name: L('Mini', 'Mini'),
      description: L('Pequeño pero poderoso: gabinete compacto con impresión térmica al instante.', 'Small but mighty: a compact cabinet with instant thermal printing.'),
      hardwareProfileId: ID.hardwareProfile.thermalKiosk, productIds: [P.receiptPhoto],
      configValues: { 'timing.idleTimeoutSec': 45, 'branding.tone': 'playful', 'printing.cutMarks': false },
      featureModes: { 'documents.mode': 'hidden', 'printing.thermal': 'enabled', 'entertainment.mode': 'enabled' },
      maintenanceChecklistId: ID.checklist.thermalKiosk, ...audit(ID.user.adminUnaDeTodos),
    }),
  ];
}

function caps(keys: readonly CapabilityKey[], broken: Partial<Record<CapabilityKey, string>> = {}): MachineCapabilityState[] {
  return keys.map((key) => {
    const detail = broken[key];
    return detail === undefined
      ? { key, present: true, operational: true, updatedAt: hoursAgo(1) }
      : { key, present: true, operational: false, detail, updatedAt: hoursAgo(1) };
  });
}

interface MachineSeed {
  id: string; code: string; name: string; locationId?: string; franchiseId?: string; regionId?: string; organizationId?: string;
  hardwareProfileId: string; blueprintId?: string; status: Machine['status']; capabilities: MachineCapabilityState[]; printers: PrinterDefinition[];
  softwareVersion: string; targetSoftwareVersion?: string; releaseChannel?: Machine['releaseChannel']; online: boolean; lastSeenAt: string; installedAt: string; timezone: string; tags: string[]; notes?: string;
}

const seeds: MachineSeed[] = [
  { id: ID.machine.doc, code: 'UDT-NTE-001', name: 'Documental Universidad del Norte', locationId: ID.location.university, franchiseId: ID.franchise.norte, regionId: ID.region.norte, hardwareProfileId: ID.hardwareProfile.docStation, blueprintId: ID.blueprint.family, status: 'active', capabilities: caps(CAPS.docStation), printers: [PRINTERS.photo4x6], softwareVersion: SOFTWARE_VERSIONS.v020, online: true, lastSeenAt: minutesAgo(1), installedAt: '2026-02-15T16:00:00Z', timezone: TZ_MTY, tags: ['universidad'], notes: 'Máquina que simula el agente por defecto (PSP_STATION_MACHINE_ID).' },
  { id: ID.machine.thermal, code: 'UDT-NTE-002', name: 'Kiosco térmico Café Aurora', locationId: ID.location.cafe, franchiseId: ID.franchise.norte, regionId: ID.region.norte, hardwareProfileId: ID.hardwareProfile.thermalKiosk, blueprintId: ID.blueprint.mini, status: 'active', capabilities: caps(CAPS.thermalKiosk), printers: [PRINTERS.thermal58], softwareVersion: SOFTWARE_VERSIONS.v010, online: true, lastSeenAt: minutesAgo(2), installedAt: '2026-05-10T17:00:00Z', timezone: TZ_MTY, tags: ['cafeteria'] },
  { id: ID.machine.premium, code: 'UDT-CEN-001', name: 'Cabina premium Plaza Meridiano', locationId: ID.location.mallCdmx, regionId: ID.region.centro, hardwareProfileId: ID.hardwareProfile.premiumBooth, blueprintId: ID.blueprint.pro, status: 'active_with_warnings', capabilities: caps(CAPS.premiumBooth, { 'printer.photo': 'Sin papel: incidencia abierta' }), printers: [PRINTERS.photoPremium], softwareVersion: SOFTWARE_VERSIONS.v010, targetSoftwareVersion: SOFTWARE_VERSIONS.v020, online: true, lastSeenAt: minutesAgo(1), installedAt: '2026-06-20T19:00:00Z', timezone: TZ_MX, tags: [PILOT_TAG, 'premium'], notes: 'Piloto de la release 0.2.0; papel fotográfico agotado.' },
  { id: ID.machine.cinema, code: 'UDT-BAJ-001', name: 'Documental Cinema Juriquilla', locationId: ID.location.cinema, franchiseId: ID.franchise.bajio, regionId: ID.region.bajio, hardwareProfileId: ID.hardwareProfile.docStation, blueprintId: ID.blueprint.family, status: 'maintenance', capabilities: caps(CAPS.docStation, { 'camera.primary': 'Cámara no responde; en revisión' }), printers: [PRINTERS.photo4x6], softwareVersion: SOFTWARE_VERSIONS.v010, online: true, lastSeenAt: minutesAgo(5), installedAt: '2026-07-01T18:00:00Z', timezone: TZ_MX, tags: ['cine'] },
  { id: ID.machine.hotel, code: 'UDT-BAJ-002', name: 'Cabina Hotel Casa Real', locationId: ID.location.hotel, franchiseId: ID.franchise.bajio, regionId: ID.region.bajio, hardwareProfileId: ID.hardwareProfile.premiumBooth, blueprintId: ID.blueprint.couple, status: 'active', capabilities: caps(CAPS.premiumBooth), printers: [PRINTERS.photoPremium], softwareVersion: SOFTWARE_VERSIONS.v010, online: true, lastSeenAt: minutesAgo(3), installedAt: '2026-07-15T18:00:00Z', timezone: TZ_MX, tags: ['hotel', 'cortesia'] },
  { id: ID.machine.demo, code: 'UDT-DEMO-001', name: 'Unidad demo itinerante', hardwareProfileId: ID.hardwareProfile.docStation, blueprintId: ID.blueprint.family, status: 'demo', capabilities: caps(CAPS.docStation), printers: [PRINTERS.photo4x6], softwareVersion: SOFTWARE_VERSIONS.v030pilot1, releaseChannel: 'pilot', online: true, lastSeenAt: minutesAgo(10), installedAt: '2026-08-01T12:00:00Z', timezone: TZ_MX, tags: ['demo'], notes: 'Sin ubicación fija; canal pilot.' },
  { id: ID.machine.bajio1, code: 'UDT-BAJ-003', name: 'Cabina Cinema Juriquilla', locationId: ID.location.cinema, franchiseId: ID.franchise.bajio, regionId: ID.region.bajio, hardwareProfileId: ID.hardwareProfile.premiumBooth, blueprintId: ID.blueprint.pro, status: 'active', capabilities: caps(CAPS.premiumBooth), printers: [PRINTERS.photoPremium], softwareVersion: SOFTWARE_VERSIONS.v020, online: true, lastSeenAt: minutesAgo(1), installedAt: '2026-07-01T18:30:00Z', timezone: TZ_MX, tags: [PILOT_TAG, 'cine'] },
  { id: ID.machine.bajio2, code: 'UDT-BAJ-004', name: 'Documental Hotel Casa Real', locationId: ID.location.hotel, franchiseId: ID.franchise.bajio, regionId: ID.region.bajio, hardwareProfileId: ID.hardwareProfile.docStation, blueprintId: ID.blueprint.family, status: 'disconnected', capabilities: caps(CAPS.docStation), printers: [PRINTERS.photo4x6], softwareVersion: SOFTWARE_VERSIONS.v010, online: false, lastSeenAt: daysAgo(2, 3), installedAt: '2026-07-15T18:30:00Z', timezone: TZ_MX, tags: ['hotel'], notes: 'Sin heartbeat desde hace dos días.' },
  { id: ID.machine.terminal, code: 'UDT-CEN-002', name: 'Kiosco térmico Plaza Meridiano', locationId: ID.location.mallCdmx, regionId: ID.region.centro, hardwareProfileId: ID.hardwareProfile.thermalKiosk, blueprintId: ID.blueprint.mini, status: 'out_of_service', capabilities: caps(CAPS.thermalKiosk, { 'printer.thermal': 'Cabezal térmico dañado; esperando refacción' }), printers: [PRINTERS.thermal58], softwareVersion: SOFTWARE_VERSIONS.v010, online: true, lastSeenAt: minutesAgo(4), installedAt: '2026-06-20T19:30:00Z', timezone: TZ_MX, tags: ['mall', 'termica'] },
  { id: ID.machine.bogota, code: 'FR-BOG-001', name: 'Documental Andino Norte', organizationId: ID.org.fotorapida, locationId: ID.location.mallBogota, regionId: ID.region.bogota, hardwareProfileId: ID.hardwareProfile.docStation, status: 'active', capabilities: caps(CAPS.docStation), printers: [PRINTERS.photo4x6], softwareVersion: SOFTWARE_VERSIONS.v010, online: true, lastSeenAt: minutesAgo(2), installedAt: '2026-05-01T16:00:00Z', timezone: TZ_BOG, tags: ['mall', 'colombia'] },
];

export function buildMachines(): Machine[] {
  return seeds.map((seed) =>
    Machine.parse({
      id: seed.id,
      code: seed.code,
      name: seed.name,
      organizationId: seed.organizationId ?? ID.org.unaDeTodos,
      franchiseId: seed.franchiseId,
      regionId: seed.regionId,
      locationId: seed.locationId,
      hardwareProfileId: seed.hardwareProfileId,
      blueprintId: seed.blueprintId,
      status: seed.status,
      capabilities: seed.capabilities,
      printers: seed.printers,
      softwareVersion: seed.softwareVersion,
      targetSoftwareVersion: seed.targetSoftwareVersion,
      bundleVersion: `bnd_${seed.id.slice(4, 12)}_v1`,
      releaseChannel: seed.releaseChannel ?? 'stable',
      online: seed.online,
      lastSeenAt: seed.lastSeenAt,
      installedAt: seed.installedAt,
      timezone: seed.timezone,
      notes: seed.notes,
      tags: seed.tags,
      ...audit(ID.user.adminUnaDeTodos),
      createdAt: seed.installedAt,
    }),
  );
}

export { CAPS as PROFILE_CAPABILITIES };
