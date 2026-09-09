import { z } from 'zod';
import { Id, LocalizedText, Scope, ScopeLevel, Timestamp } from './common';
import { CapabilityKey } from './capabilities';

/** Funciones habilitables por nivel (requisito 18.2). Lista cerrada. */
export const FeatureKey = z.enum([
  'documents.mode',
  'documents.autoCapture',
  'documents.advancedValidation',
  'editing.local',
  'editing.creative',
  'printing.photo',
  'printing.thermal',
  'entertainment.mode',
  'campaigns',
  'i18n.multi',
  'branding.coBranding',
  'branding.advanced',
  'analytics.advanced',
  'ai.experiences',
  'payments.terminal',
  'payments.qr',
  'delivery.digital',
  'customer.handoff',
  'franchise.mode',
  'support.remote',
  'kiosk.accessibility',
  'kiosk.demoMode',
]);
export type FeatureKey = z.infer<typeof FeatureKey>;

/** Cómo se presenta una función no autorizada (requisito 18.4). */
export const FeatureMode = z.enum(['enabled', 'hidden', 'locked', 'coming_soon']);
export type FeatureMode = z.infer<typeof FeatureMode>;

export const FeatureAppliesTo = z.enum([...ScopeLevel.options, 'product', 'user']);

export const FeatureDefinition = z.object({
  key: FeatureKey,
  name: LocalizedText,
  description: LocalizedText,
  appliesTo: z.array(FeatureAppliesTo),
  defaultMode: FeatureMode,
  dependsOn: z.array(FeatureKey).default([]),
  requiresCapabilities: z.array(CapabilityKey).default([]),
  /** true = la función depende de un proveedor externo futuro. */
  external: z.boolean().default(false),
});
export type FeatureDefinition = z.infer<typeof FeatureDefinition>;

export const FeatureState = z.object({
  key: FeatureKey,
  mode: FeatureMode,
  reason: LocalizedText.optional(),
  source: z.union([Scope, z.literal('plan'), z.literal('default'), z.literal('capability')]),
});
export type FeatureState = z.infer<typeof FeatureState>;

export const EntitlementPlan = z.object({
  id: Id,
  key: z.string(),
  name: LocalizedText,
  features: z.array(FeatureKey),
  limits: z
    .object({
      maxMachines: z.number().int().optional(),
      maxLocations: z.number().int().optional(),
      maxUsers: z.number().int().optional(),
    })
    .default({}),
});
export type EntitlementPlan = z.infer<typeof EntitlementPlan>;

export const Entitlement = z.object({
  id: Id,
  scope: Scope,
  planId: Id,
  startsAt: Timestamp,
  endsAt: Timestamp.optional(),
  notes: z.string().optional(),
});
export type Entitlement = z.infer<typeof Entitlement>;

export const FeatureOverride = z.object({
  id: Id,
  key: FeatureKey,
  scope: Scope,
  mode: FeatureMode,
  reason: z.string().optional(),
  setBy: Id.optional(),
  setAt: Timestamp,
});
export type FeatureOverride = z.infer<typeof FeatureOverride>;

const L = (es: string, en: string) => ({ es, en });

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  { key: 'documents.mode', name: L('Modo documentos', 'Documents mode'), description: L('Fotografías para trámites con presets y guía visual.', 'ID photos with presets and visual guidance.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine', 'product'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: ['camera.primary'], external: false },
  { key: 'documents.autoCapture', name: L('Auto-captura', 'Auto-capture'), description: L('Captura automática al cumplir criterios.', 'Automatic capture when criteria are met.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine', 'product'], defaultMode: 'enabled', dependsOn: ['documents.mode'], requiresCapabilities: ['camera.primary'], external: false },
  { key: 'documents.advancedValidation', name: L('Validación avanzada', 'Advanced validation'), description: L('Criterios adicionales: lentes, accesorios, fondo.', 'Extra criteria: glasses, accessories, background.'), appliesTo: ['platform', 'organization', 'franchise', 'machine'], defaultMode: 'enabled', dependsOn: ['documents.mode'], requiresCapabilities: [], external: false },
  { key: 'editing.local', name: L('Edición local', 'Local editing'), description: L('Ajustes básicos en el dispositivo.', 'Basic on-device adjustments.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine', 'product'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'editing.creative', name: L('Edición creativa', 'Creative editing'), description: L('Marcos, stickers, texto, overlays.', 'Frames, stickers, text, overlays.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine', 'product'], defaultMode: 'enabled', dependsOn: ['editing.local'], requiresCapabilities: [], external: false },
  { key: 'printing.photo', name: L('Impresión fotográfica', 'Photo printing'), description: L('Impresión en impresora fotográfica.', 'Printing on a photo printer.'), appliesTo: ['platform', 'organization', 'franchise', 'machine'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: ['printer.photo'], external: false },
  { key: 'printing.thermal', name: L('Impresión térmica', 'Thermal printing'), description: L('Foto estilo recibo en impresora térmica.', 'Receipt-style photo on a thermal printer.'), appliesTo: ['platform', 'organization', 'franchise', 'machine'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: ['printer.thermal'], external: false },
  { key: 'entertainment.mode', name: L('Entretenimiento', 'Entertainment'), description: L('Experiencias con secuencias de poses.', 'Experiences with pose sequences.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine', 'product'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: ['camera.primary'], external: false },
  { key: 'campaigns', name: L('Campañas', 'Campaigns'), description: L('Contenido estacional programado.', 'Scheduled seasonal content.'), appliesTo: ['platform', 'organization', 'franchise'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'i18n.multi', name: L('Multi-idioma', 'Multi-language'), description: L('Selector de idioma en el kiosco.', 'Language selector on the kiosk.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'branding.coBranding', name: L('Co-branding', 'Co-branding'), description: L('Logo de anfitrión y patrocinador.', 'Host and sponsor logos.'), appliesTo: ['platform', 'organization', 'franchise', 'location'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'branding.advanced', name: L('Personalización avanzada', 'Advanced branding'), description: L('Paleta, tipografía y pantallas personalizadas.', 'Palette, typography and custom screens.'), appliesTo: ['platform', 'organization', 'franchise'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'analytics.advanced', name: L('Analytics avanzados', 'Advanced analytics'), description: L('Comparaciones y utilización por franja.', 'Comparisons and utilization by time slot.'), appliesTo: ['platform', 'organization', 'franchise', 'user'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'ai.experiences', name: L('Experiencias de IA', 'AI experiences'), description: L('Estilización con proveedores externos.', 'Stylization with external providers.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine', 'product'], defaultMode: 'coming_soon', dependsOn: [], requiresCapabilities: ['connectivity.online'], external: true },
  { key: 'payments.terminal', name: L('Pago con terminal', 'Terminal payments'), description: L('Cobro con lector de tarjeta/NFC.', 'Card/NFC reader payments.'), appliesTo: ['platform', 'organization', 'franchise', 'machine'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: ['payment.terminal'], external: true },
  { key: 'payments.qr', name: L('Pago con QR', 'QR payments'), description: L('Cobro con código QR.', 'QR code payments.'), appliesTo: ['platform', 'organization', 'franchise', 'machine'], defaultMode: 'coming_soon', dependsOn: [], requiresCapabilities: ['connectivity.online'], external: true },
  { key: 'delivery.digital', name: L('Entrega digital', 'Digital delivery'), description: L('Envío por WhatsApp, SMS o correo.', 'Delivery by WhatsApp, SMS or email.'), appliesTo: ['platform', 'organization', 'franchise', 'machine', 'product'], defaultMode: 'coming_soon', dependsOn: [], requiresCapabilities: ['connectivity.online'], external: true },
  { key: 'customer.handoff', name: L('Enlace efímero de cliente', 'Ephemeral customer link'), description: L('QR o escaneo temporal para enlazar al cliente sin cuentas ni contraseñas.', 'Temporary QR or scan to link the customer without accounts or passwords.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine', 'product'], defaultMode: 'hidden', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'franchise.mode', name: L('Modo franquicia', 'Franchise mode'), description: L('Portal y permisos de franquiciatario.', 'Franchisee portal and permissions.'), appliesTo: ['platform', 'organization'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'support.remote', name: L('Soporte remoto', 'Remote support'), description: L('Diagnóstico y comandos remotos.', 'Remote diagnostics and commands.'), appliesTo: ['platform', 'organization', 'franchise', 'machine', 'user'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: ['connectivity.online'], external: false },
  { key: 'kiosk.accessibility', name: L('Accesibilidad', 'Accessibility'), description: L('Experiencia simplificada y tiempos ampliados.', 'Simplified experience and extended timeouts.'), appliesTo: ['platform', 'organization', 'franchise', 'location', 'machine'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
  { key: 'kiosk.demoMode', name: L('Modo demo', 'Demo mode'), description: L('Recorrido completo sin venta.', 'Full journey without a sale.'), appliesTo: ['platform', 'organization', 'franchise', 'machine'], defaultMode: 'enabled', dependsOn: [], requiresCapabilities: [], external: false },
];

export const FEATURE_INDEX: Record<string, FeatureDefinition> = Object.fromEntries(
  FEATURE_DEFINITIONS.map((f) => [f.key, f]),
);
