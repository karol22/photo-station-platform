/**
 * Retención, checklists, capas de configuración y features (planes, entitlements, overrides).
 * `cfg_fr_norte` fija `branding.palette.primary` a propósito: la organización lo bloquea como
 * `mandatory`, así que el motor lo rechaza y lo reporta en `rejected` (escenario de bloqueo).
 * `techPanel.pinHash` vive en las capas de organización porque el registro no lo admite en plataforma.
 */
import { ConfigLayer, Entitlement, EntitlementPlan, FeatureOverride, MaintenanceChecklist, RetentionPolicy, type FeatureKey } from '@psp/contracts';
import { DEMO_IDS } from '../ids';
import { sha256Hex } from '../sha256';
import { L, UPDATED_AT } from './common';

const ID = DEMO_IDS;
export const TECH_PANEL_PIN = '2468';

export function buildRetentionPolicies(): RetentionPolicy[] {
  return [
    RetentionPolicy.parse({ id: ID.retention.deleteOnFinish, name: L('Borrar al terminar', 'Delete on finish'), mode: 'none', deleteIncomplete: true, appliesToKinds: ['document'], customerText: L('Tus fotos se eliminan de la máquina en cuanto termina tu sesión.', 'Your photos are deleted from the machine as soon as your session ends.'), leavesDevice: false }),
    RetentionPolicy.parse({ id: ID.retention.temp30min, name: L('Temporal 30 minutos', 'Temporary 30 minutes'), mode: 'temporary', durationMinutes: 30, deleteIncomplete: true, appliesToKinds: ['entertainment', 'portrait'], customerText: L('Conservamos tus fotos 30 minutos por si necesitas reimprimir; después se eliminan.', 'We keep your photos for 30 minutes in case you need a reprint; then they are deleted.'), leavesDevice: false }),
    RetentionPolicy.parse({ id: ID.retention.metadataOnly, name: L('Sólo metadatos', 'Metadata only'), mode: 'metadata_only', deleteIncomplete: true, appliesToKinds: [], customerText: L('No conservamos fotografías, sólo el registro de la sesión sin imágenes.', 'We keep no photos, only the session record without images.'), leavesDevice: false }),
    RetentionPolicy.parse({ id: ID.retention.derivatives24h, name: L('Derivados 24 horas', 'Derivatives 24 hours'), mode: 'derivatives_only', durationMinutes: 1440, deleteIncomplete: true, appliesToKinds: ['ai'], customerText: L('Conservamos sólo la imagen estilizada durante 24 horas; el original se elimina al terminar.', 'We keep only the stylized image for 24 hours; the original is deleted when you finish.'), leavesDevice: true }),
  ];
}

export function buildMaintenanceChecklists(): MaintenanceChecklist[] {
  return [
    MaintenanceChecklist.parse({ id: ID.checklist.docStation, hardwareProfileId: ID.hardwareProfile.docStation, name: L('Checklist estación documental', 'Document station checklist'), items: [{ key: 'lens', label: L('Lente limpio', 'Lens clean') }, { key: 'lighting', label: L('Iluminación operativa', 'Lighting working') }, { key: 'paper', label: L('Papel fotográfico suficiente', 'Enough photo paper') }, { key: 'test_print', label: L('Impresión de prueba correcta', 'Test print OK') }, { key: 'touch', label: L('Pantalla táctil calibrada', 'Touch screen calibrated') }] }),
    MaintenanceChecklist.parse({ id: ID.checklist.thermalKiosk, hardwareProfileId: ID.hardwareProfile.thermalKiosk, name: L('Checklist kiosco térmico', 'Thermal kiosk checklist'), items: [{ key: 'roll', label: L('Rollo térmico instalado', 'Thermal roll installed') }, { key: 'head', label: L('Cabezal limpio', 'Print head clean') }, { key: 'camera', label: L('Cámara enfocada', 'Camera focused') }] }),
  ];
}

export function buildConfigLayers(): ConfigLayer[] {
  const C = ID.configLayer;
  return [
    ConfigLayer.parse({
      id: C.platform, level: 'platform', values: { 'sync.heartbeatIntervalSec': 30, 'sync.eventBatchSize': 100, 'kiosk.attractRotationSec': 8 },
      locks: [{ key: 'sync.heartbeatIntervalSec', policy: 'hidden', setBy: 'platform' }, { key: 'sync.eventBatchSize', policy: 'hidden', setBy: 'platform' }], version: 1, updatedAt: UPDATED_AT, updatedBy: ID.user.owner,
    }),
    ConfigLayer.parse({
      id: C.orgLumina, level: 'organization', entityId: ID.org.lumina,
      values: {
        'branding.publicName': 'Lumina Foto', 'branding.logoAssetId': ID.asset.logoLumina, 'branding.printLogoAssetId': ID.asset.logoLumina,
        'branding.palette.primary': '#1E5EFF', 'branding.palette.secondary': '#0B1B3F', 'branding.palette.accent': '#FFB020', 'branding.palette.background': '#F6F7FB', 'branding.palette.text': '#0B1B3F',
        'branding.attractImageAssetIds': [ID.asset.promoDocuments], 'branding.completionMessage': '¡Gracias por elegir Lumina Foto!',
        'legal.privacyNotice': 'Lumina Foto trata tus fotografías sólo para producir tu impresión.', 'legal.terms': 'Verifica la foto antes de imprimir; no hay reembolsos por errores del cliente.', 'legal.supportContact': 'soporte@lumina.demo',
        'privacy.defaultRetentionPolicyId': ID.retention.temp30min, 'timing.idleTimeoutSec': 60, 'kiosk.locales': ['es', 'en'], 'techPanel.pinHash': sha256Hex(TECH_PANEL_PIN),
      },
      locks: [
        { key: 'branding.palette.primary', policy: 'mandatory', setBy: 'organization', setById: ID.org.lumina },
        { key: 'branding.palette.secondary', policy: 'mandatory', setBy: 'organization', setById: ID.org.lumina },
        { key: 'branding.palette.accent', policy: 'mandatory', setBy: 'organization', setById: ID.org.lumina },
        { key: 'timing.idleTimeoutSec', policy: 'range', range: { min: 30, max: 180 }, setBy: 'organization', setById: ID.org.lumina },
      ],
      version: 3, updatedAt: UPDATED_AT, updatedBy: ID.user.adminLumina,
    }),
    ConfigLayer.parse({
      id: C.orgFotorapida, level: 'organization', entityId: ID.org.fotorapida,
      values: { 'branding.publicName': 'FotoRápida', 'branding.logoAssetId': ID.asset.logoFotorapida, 'branding.printLogoAssetId': ID.asset.logoFotorapida, 'branding.palette.primary': '#E63946', 'branding.palette.secondary': '#1D3557', 'branding.palette.accent': '#F1FAEE', 'branding.palette.background': '#FFFFFF', 'branding.palette.text': '#1D3557', 'kiosk.locales': ['es'], 'kiosk.defaultLocale': 'es', 'legal.privacyNotice': 'FotoRápida no conserva tus fotografías después de imprimir.', 'privacy.defaultRetentionPolicyId': ID.retention.deleteOnFinish, 'techPanel.pinHash': sha256Hex(TECH_PANEL_PIN) },
      locks: [], version: 1, updatedAt: UPDATED_AT, updatedBy: ID.user.adminFotorapida,
    }),
    ConfigLayer.parse({
      id: C.frNorte, level: 'franchise', entityId: ID.franchise.norte,
      // `branding.palette.primary` viola el bloqueo mandatory de la organización: el motor lo rechaza.
      values: { 'branding.footerText': 'Lumina Norte · Monterrey', 'kiosk.locales': ['es'], 'branding.palette.primary': '#FF0000', 'branding.secondaryLogoAssetId': ID.asset.logoNorte },
      locks: [], version: 2, updatedAt: UPDATED_AT, updatedBy: ID.user.franqNorte,
    }),
    ConfigLayer.parse({ id: C.locUniversity, level: 'location', entityId: ID.location.university, values: { 'branding.hostLogoAssetId': ID.asset.logoHostUniversity, 'branding.tone': 'formal' }, locks: [], version: 1, updatedAt: UPDATED_AT, updatedBy: ID.user.franqNorte }),
    ConfigLayer.parse({ id: C.locCafe, level: 'location', entityId: ID.location.cafe, values: { 'printing.pickupInstructions': 'Recoge tu ticket en la barra junto a la caja.' }, locks: [], version: 1, updatedAt: UPDATED_AT, updatedBy: ID.user.franqNorte }),
    ConfigLayer.parse({ id: C.mchDoc, level: 'machine', entityId: ID.machine.doc, values: { 'timing.captureCountdownSec': 3, 'kiosk.screenBrightness': 85 }, locks: [], version: 1, updatedAt: UPDATED_AT, updatedBy: ID.user.tecnicoNorte }),
    ConfigLayer.parse({ id: C.mchHotel, level: 'machine', entityId: ID.machine.hotel, values: { 'payment.businessMode': 'courtesy', 'kiosk.showPricesOnIdle': false }, locks: [], version: 1, updatedAt: UPDATED_AT, updatedBy: ID.user.adminLumina }),
    ConfigLayer.parse({ id: C.mchDemo, level: 'machine', entityId: ID.machine.demo, values: { 'payment.businessMode': 'demo', 'kiosk.showPricesOnIdle': false }, locks: [], version: 1, updatedAt: UPDATED_AT, updatedBy: ID.user.owner }),
    ConfigLayer.parse({ id: C.mchPremium, level: 'machine', entityId: ID.machine.premium, values: { 'payment.terminalAdapter': 'mock', 'payment.businessMode': 'paid', 'kiosk.volume': 60 }, locks: [], version: 1, updatedAt: UPDATED_AT, updatedBy: ID.user.adminLumina }),
  ];
}

const STARTER: FeatureKey[] = ['documents.mode', 'documents.autoCapture', 'documents.advancedValidation', 'editing.local', 'editing.creative', 'printing.photo', 'printing.thermal', 'entertainment.mode', 'campaigns', 'i18n.multi', 'kiosk.accessibility', 'kiosk.demoMode'];
const PRO: FeatureKey[] = [...STARTER, 'branding.coBranding', 'analytics.advanced', 'franchise.mode', 'support.remote', 'payments.terminal'];
const ENTERPRISE: FeatureKey[] = [...PRO, 'ai.experiences', 'delivery.digital', 'branding.advanced', 'payments.qr'];

export function buildEntitlementPlans(): EntitlementPlan[] {
  return [
    EntitlementPlan.parse({ id: ID.plan.starter, key: 'starter', name: L('Starter', 'Starter'), features: STARTER, limits: { maxMachines: 10, maxLocations: 5, maxUsers: 10 } }),
    EntitlementPlan.parse({ id: ID.plan.pro, key: 'pro', name: L('Pro', 'Pro'), features: PRO, limits: { maxMachines: 100, maxLocations: 50, maxUsers: 100 } }),
    EntitlementPlan.parse({ id: ID.plan.enterprise, key: 'enterprise', name: L('Enterprise', 'Enterprise'), features: ENTERPRISE, limits: {} }),
  ];
}

export function buildEntitlements(): Entitlement[] {
  return [
    Entitlement.parse({ id: ID.entitlement.lumina, scope: { level: 'organization', id: ID.org.lumina }, planId: ID.plan.enterprise, startsAt: '2026-01-15T12:00:00Z', notes: 'Plan enterprise anual.' }),
    Entitlement.parse({ id: ID.entitlement.fotorapida, scope: { level: 'organization', id: ID.org.fotorapida }, planId: ID.plan.starter, startsAt: '2026-03-01T12:00:00Z', endsAt: '2027-03-01T12:00:00Z', notes: 'Plan starter de prueba.' }),
  ];
}

export function buildFeatureOverrides(): FeatureOverride[] {
  return [
    FeatureOverride.parse({ id: ID.featureOverride.aiLuminaHidden, key: 'ai.experiences', scope: { level: 'organization', id: ID.org.lumina }, mode: 'hidden', reason: 'Proveedor de IA pendiente de contrato; oculto salvo en el piloto Norte.', setBy: ID.user.adminLumina, setAt: '2026-08-01T12:00:00Z' }),
    FeatureOverride.parse({ id: ID.featureOverride.aiNorte, key: 'ai.experiences', scope: { level: 'franchise', id: ID.franchise.norte }, mode: 'enabled', reason: 'Piloto de IA en franquicia Norte.', setBy: ID.user.adminLumina, setAt: '2026-08-15T12:00:00Z' }),
    FeatureOverride.parse({ id: ID.featureOverride.deliveryLumina, key: 'delivery.digital', scope: { level: 'organization', id: ID.org.lumina }, mode: 'coming_soon', reason: 'Entrega digital anunciada para 2027.', setBy: ID.user.adminLumina, setAt: '2026-08-01T12:00:00Z' }),
    FeatureOverride.parse({ id: ID.featureOverride.demoUnit, key: 'kiosk.demoMode', scope: { level: 'machine', id: ID.machine.demo }, mode: 'enabled', reason: 'Unidad demo itinerante.', setBy: ID.user.owner, setAt: '2026-08-01T12:00:00Z' }),
  ];
}
