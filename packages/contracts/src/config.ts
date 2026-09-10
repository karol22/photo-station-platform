import { z } from 'zod';
import { Id, JsonValue, LocalizedText, ScopeLevel, Timestamp } from './common';

/** Nivel de una capa de configuración: los seis de jerarquía más blueprint y campaña. */
export const ConfigLevel = z.enum([
  'platform',
  'organization',
  'franchise',
  'region',
  'location',
  'machine',
  'blueprint',
  'campaign',
]);
export type ConfigLevel = z.infer<typeof ConfigLevel>;

/** Política de bloqueo declarada por un nivel superior (requisito 15.3). */
export const LockPolicy = z.enum(['mandatory', 'editable', 'range', 'hidden']);
export type LockPolicy = z.infer<typeof LockPolicy>;

export const ConfigLock = z.object({
  key: z.string(),
  policy: LockPolicy,
  range: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      allowed: z.array(z.string()).optional(),
    })
    .optional(),
  setBy: ConfigLevel,
  setById: Id.optional(),
});
export type ConfigLock = z.infer<typeof ConfigLock>;

export const ConfigLayer = z.object({
  id: Id,
  level: ConfigLevel,
  entityId: Id.optional(),
  values: z.record(z.string(), JsonValue),
  locks: z.array(ConfigLock).default([]),
  version: z.number().int().default(1),
  updatedAt: Timestamp,
  updatedBy: Id.optional(),
});
export type ConfigLayer = z.infer<typeof ConfigLayer>;

export const ProvenanceEntry = z.object({
  level: ConfigLevel,
  entityId: Id.optional(),
  layerId: Id.optional(),
  /** true cuando el valor viene del default del registro de claves. */
  isDefault: z.boolean().default(false),
});
export type ProvenanceEntry = z.infer<typeof ProvenanceEntry>;

export const EffectiveConfig = z.object({
  values: z.record(z.string(), JsonValue),
  provenance: z.record(z.string(), ProvenanceEntry),
  locks: z.record(z.string(), ConfigLock),
  /** Claves cuyo valor fue rechazado por bloqueo, con el nivel que lo intentó. */
  rejected: z
    .array(z.object({ key: z.string(), level: ConfigLevel, entityId: Id.optional(), reason: z.string() }))
    .default([]),
  hash: z.string(),
});
export type EffectiveConfig = z.infer<typeof EffectiveConfig>;

export const ConfigKeyType = z.enum([
  'string',
  'number',
  'boolean',
  'color',
  'asset',
  'text',
  'enum',
  'json',
  'stringList',
]);

export const ConfigGroup = z.enum([
  'branding',
  'kiosk',
  'timing',
  'legal',
  'privacy',
  'printing',
  'payment',
  'session',
  'customer',
  'sync',
  'techPanel',
  'accessibility',
]);
export type ConfigGroup = z.infer<typeof ConfigGroup>;

export const ConfigKeyDefinition = z.object({
  key: z.string(),
  type: ConfigKeyType,
  group: ConfigGroup,
  name: LocalizedText,
  description: LocalizedText.optional(),
  default: JsonValue,
  editableAt: z.array(ScopeLevel),
  enumValues: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  sensitive: z.boolean().default(false),
});
export type ConfigKeyDefinition = z.infer<typeof ConfigKeyDefinition>;

const L = (es: string, en: string) => ({ es, en });
const all: ScopeLevel[] = ['platform', 'organization', 'franchise', 'region', 'location', 'machine'];
const fromOrg: ScopeLevel[] = ['organization', 'franchise', 'region', 'location', 'machine'];

/** Registro de claves de configuración conocidas. Toda clave usada por una app está aquí. */
export const CONFIG_KEYS: ConfigKeyDefinition[] = [
  { key: 'branding.publicName', type: 'string', group: 'branding', name: L('Nombre público', 'Public name'), default: '', editableAt: fromOrg, sensitive: false },
  { key: 'branding.logoAssetId', type: 'asset', group: 'branding', name: L('Logotipo', 'Logo'), default: null, editableAt: fromOrg, sensitive: false },
  { key: 'branding.secondaryLogoAssetId', type: 'asset', group: 'branding', name: L('Logo secundario', 'Secondary logo'), default: null, editableAt: fromOrg, sensitive: false },
  { key: 'branding.hostLogoAssetId', type: 'asset', group: 'branding', name: L('Logo del anfitrión', 'Host logo'), default: null, editableAt: ['location', 'machine'], sensitive: false },
  { key: 'branding.sponsorLogoAssetId', type: 'asset', group: 'branding', name: L('Logo del patrocinador', 'Sponsor logo'), default: null, editableAt: fromOrg, sensitive: false },
  { key: 'branding.palette.primary', type: 'color', group: 'branding', name: L('Color primario', 'Primary color'), default: '#1E5EFF', editableAt: fromOrg, sensitive: false },
  { key: 'branding.palette.secondary', type: 'color', group: 'branding', name: L('Color secundario', 'Secondary color'), default: '#0B1B3F', editableAt: fromOrg, sensitive: false },
  { key: 'branding.palette.accent', type: 'color', group: 'branding', name: L('Color de acento', 'Accent color'), default: '#FFB020', editableAt: fromOrg, sensitive: false },
  { key: 'branding.palette.background', type: 'color', group: 'branding', name: L('Fondo', 'Background'), default: '#F6F7FB', editableAt: fromOrg, sensitive: false },
  { key: 'branding.palette.text', type: 'color', group: 'branding', name: L('Texto', 'Text'), default: '#0B1B3F', editableAt: fromOrg, sensitive: false },
  { key: 'branding.palette.accents', type: 'stringList', group: 'branding', name: L('Colores de acento', 'Accent colors'), description: L('Colores vivos de la marca para elementos decorativos e ilustración.', 'Brand accent colors for decorative and illustrated elements.'), default: ['#FF6FA5', '#FF7A3C', '#FFC24A', '#5FCB92', '#4C86E8', '#A87BE8'], editableAt: fromOrg, sensitive: false },
  { key: 'branding.attractImageAssetIds', type: 'stringList', group: 'branding', name: L('Imágenes de atracción', 'Attract images'), default: [], editableAt: fromOrg, sensitive: false },
  { key: 'branding.tone', type: 'enum', group: 'branding', name: L('Tono textual', 'Text tone'), default: 'friendly', editableAt: fromOrg, enumValues: ['friendly', 'formal', 'playful'], sensitive: false },
  { key: 'branding.footerText', type: 'text', group: 'branding', name: L('Pie de pantalla', 'Footer text'), default: '', editableAt: fromOrg, sensitive: false },
  { key: 'branding.completionMessage', type: 'text', group: 'branding', name: L('Mensaje de finalización', 'Completion message'), default: '', editableAt: fromOrg, sensitive: false },
  { key: 'branding.printLogoAssetId', type: 'asset', group: 'branding', name: L('Logo en impresiones', 'Print logo'), default: null, editableAt: fromOrg, sensitive: false },
  { key: 'kiosk.defaultLocale', type: 'enum', group: 'kiosk', name: L('Idioma por defecto', 'Default language'), default: 'es', editableAt: all, enumValues: ['es', 'en'], sensitive: false },
  { key: 'kiosk.locales', type: 'stringList', group: 'kiosk', name: L('Idiomas disponibles', 'Available languages'), default: ['es', 'en'], editableAt: all, sensitive: false },
  { key: 'kiosk.showPricesOnIdle', type: 'boolean', group: 'kiosk', name: L('Mostrar precios en atracción', 'Show prices on idle'), default: true, editableAt: all, sensitive: false },
  { key: 'kiosk.attractRotationSec', type: 'number', group: 'kiosk', name: L('Rotación de atracción (s)', 'Attract rotation (s)'), default: 8, editableAt: all, min: 3, max: 120, sensitive: false },
  { key: 'kiosk.surveillanceNotice', type: 'boolean', group: 'kiosk', name: L('Aviso de videovigilancia', 'Surveillance notice'), default: false, editableAt: all, sensitive: false },
  { key: 'kiosk.simplifiedMode', type: 'boolean', group: 'accessibility', name: L('Experiencia simplificada', 'Simplified experience'), default: false, editableAt: all, sensitive: false },
  { key: 'kiosk.accessibleTimeoutMultiplier', type: 'number', group: 'accessibility', name: L('Multiplicador de tiempo accesible', 'Accessible timeout multiplier'), default: 1.5, editableAt: all, min: 1, max: 4, sensitive: false },
  { key: 'kiosk.screenBrightness', type: 'number', group: 'kiosk', name: L('Brillo de pantalla', 'Screen brightness'), default: 80, editableAt: ['machine'], min: 10, max: 100, sensitive: false },
  { key: 'kiosk.volume', type: 'number', group: 'kiosk', name: L('Volumen', 'Volume'), default: 50, editableAt: ['machine'], min: 0, max: 100, sensitive: false },
  { key: 'kiosk.orientation', type: 'enum', group: 'kiosk', name: L('Orientación de pantalla', 'Screen orientation'), default: 'portrait', editableAt: ['machine'], enumValues: ['portrait', 'landscape'], sensitive: false },
  // Dónde está el lente en el vidrio, en porcentaje de la pantalla. La interfaz dibuja ahí los
  // ojos que dirigen la mirada, y el sitio del lente cambia con el modelo de aparato: por eso es
  // configuración de máquina y no una constante del código.
  { key: 'kiosk.lens.offsetX', type: 'number', group: 'kiosk', name: L('Posición horizontal del lente', 'Lens horizontal position'), default: 50, editableAt: ['machine'], min: 0, max: 100, sensitive: false },
  { key: 'kiosk.lens.offsetY', type: 'number', group: 'kiosk', name: L('Posición vertical del lente', 'Lens vertical position'), default: 6, editableAt: ['machine'], min: 0, max: 100, sensitive: false },
  // Quien pasa por un pasillo no puede cambiar el ajuste de movimiento de su sistema operativo,
  // así que la cabina ofrece la preferencia por su cuenta: la máquina puede fijarla y la pantalla
  // en reposo la deja activar para la sesión.
  { key: 'kiosk.reducedMotion', type: 'boolean', group: 'kiosk', name: L('Movimiento reducido', 'Reduced motion'), default: false, editableAt: ['machine'], sensitive: false },
  { key: 'timing.idleTimeoutSec', type: 'number', group: 'timing', name: L('Tiempo de inactividad (s)', 'Idle timeout (s)'), default: 60, editableAt: all, min: 15, max: 600, sensitive: false },
  { key: 'timing.warningBeforeCancelSec', type: 'number', group: 'timing', name: L('Aviso antes de cancelar (s)', 'Warning before cancel (s)'), default: 15, editableAt: all, min: 5, max: 60, sensitive: false },
  { key: 'timing.captureCountdownSec', type: 'number', group: 'timing', name: L('Cuenta regresiva de captura (s)', 'Capture countdown (s)'), default: 3, editableAt: all, min: 1, max: 10, sensitive: false },
  { key: 'timing.prepareBeforeCaptureSec', type: 'number', group: 'timing', name: L('Preparación antes de captura (s)', 'Prepare before capture (s)'), default: 2, editableAt: all, min: 0, max: 10, sensitive: false },
  { key: 'timing.reviewTimeoutSec', type: 'number', group: 'timing', name: L('Tiempo máximo de revisión (s)', 'Review timeout (s)'), default: 90, editableAt: all, min: 15, max: 600, sensitive: false },
  { key: 'timing.autoCaptureStabilityMs', type: 'number', group: 'timing', name: L('Estabilidad para auto-captura (ms)', 'Auto-capture stability (ms)'), default: 1200, editableAt: all, min: 300, max: 5000, sensitive: false },
  { key: 'legal.privacyNotice', type: 'text', group: 'legal', name: L('Aviso de privacidad', 'Privacy notice'), default: '', editableAt: ['organization', 'franchise'], sensitive: false },
  { key: 'legal.terms', type: 'text', group: 'legal', name: L('Términos de servicio', 'Terms of service'), default: '', editableAt: ['organization', 'franchise'], sensitive: false },
  { key: 'legal.supportContact', type: 'string', group: 'legal', name: L('Contacto de soporte', 'Support contact'), default: '', editableAt: fromOrg, sensitive: false },
  { key: 'privacy.defaultRetentionPolicyId', type: 'string', group: 'privacy', name: L('Política de retención por defecto', 'Default retention policy'), default: 'ret_delete_on_finish', editableAt: ['organization', 'franchise'], sensitive: false },
  { key: 'privacy.deleteIncompleteSessions', type: 'boolean', group: 'privacy', name: L('Eliminar sesiones incompletas', 'Delete incomplete sessions'), default: true, editableAt: ['organization', 'franchise'], sensitive: false },
  { key: 'printing.defaultCopies', type: 'number', group: 'printing', name: L('Copias por defecto', 'Default copies'), default: 1, editableAt: all, min: 1, max: 10, sensitive: false },
  { key: 'printing.cutMarks', type: 'boolean', group: 'printing', name: L('Marcas de corte', 'Cut marks'), default: true, editableAt: all, sensitive: false },
  { key: 'printing.pickupInstructions', type: 'text', group: 'printing', name: L('Instrucciones para recoger', 'Pickup instructions'), default: '', editableAt: all, sensitive: false },
  { key: 'payment.businessMode', type: 'enum', group: 'payment', name: L('Modo de negocio', 'Business mode'), default: 'paid', editableAt: all, enumValues: ['paid', 'free_sponsored', 'demo', 'courtesy', 'included', 'promotional', 'internal'], sensitive: false },
  { key: 'payment.terminalAdapter', type: 'enum', group: 'payment', name: L('Adaptador de terminal', 'Terminal adapter'), default: 'mock', editableAt: ['organization', 'franchise', 'machine'], enumValues: ['none', 'mock', 'nayax', 'mercadopago_qr'], sensitive: false },
  { key: 'payment.timeoutSec', type: 'number', group: 'payment', name: L('Tiempo de espera de pago (s)', 'Payment timeout (s)'), default: 90, editableAt: all, min: 20, max: 600, sensitive: false },
  { key: 'session.maxRetakesDefault', type: 'number', group: 'session', name: L('Retakes por defecto', 'Default retakes'), default: 3, editableAt: all, min: 0, max: 10, sensitive: false },
  { key: 'sync.heartbeatIntervalSec', type: 'number', group: 'sync', name: L('Intervalo de heartbeat (s)', 'Heartbeat interval (s)'), default: 30, editableAt: ['platform', 'organization'], min: 5, max: 600, sensitive: false },
  { key: 'sync.eventBatchSize', type: 'number', group: 'sync', name: L('Tamaño de lote de eventos', 'Event batch size'), default: 100, editableAt: ['platform', 'organization'], min: 1, max: 1000, sensitive: false },
  { key: 'customer.handoffMethods', type: 'stringList', group: 'customer', name: L('Métodos de enlace', 'Link methods'), description: L('Formas de enlazar al cliente sin cuenta, en orden de preferencia.', 'Ways to link the customer without an account, in order of preference.'), default: ['display_qr'], editableAt: all, sensitive: false },
  { key: 'customer.handoffTtlSec', type: 'number', group: 'customer', name: L('Vigencia del enlace (s)', 'Link lifetime (s)'), description: L('El enlace caduca solo; la sesión siguiente nunca lo hereda.', 'The link expires on its own; the next session never inherits it.'), default: 180, editableAt: all, min: 30, max: 900, sensitive: false },
  { key: 'customer.handoffRotateSec', type: 'number', group: 'customer', name: L('Rotación del enlace (s)', 'Link rotation (s)'), description: L('Cada cuánto se regenera el token mostrado en pantalla.', 'How often the on-screen token regenerates.'), default: 30, editableAt: all, min: 10, max: 300, sensitive: false },
  { key: 'customer.handoffBaseUrl', type: 'string', group: 'customer', name: L('URL base del enlace', 'Link base URL'), description: L('Dirección corta que codifica el QR de pantalla.', 'Short address encoded by the on-screen QR.'), default: 'https://psp.local/e', editableAt: ['organization', 'franchise'], sensitive: false },
  { key: 'techPanel.pinHash', type: 'string', group: 'techPanel', name: L('PIN del panel técnico (hash)', 'Tech panel PIN (hash)'), default: '', editableAt: ['organization', 'franchise', 'machine'], sensitive: true },
];

export const CONFIG_KEY_INDEX: Record<string, ConfigKeyDefinition> = Object.fromEntries(
  CONFIG_KEYS.map((k) => [k.key, k]),
);
