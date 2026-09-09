import {
  CONFIG_KEYS,
  CapabilityKey,
  FEATURE_DEFINITIONS,
  PermissionKey,
  type CatalogEntry,
} from '@psp/contracts';

/**
 * Catálogo descubrible. `fullCatalog()` agrega:
 * 1. entradas derivadas de los contratos (features, capacidades, permisos, claves de configuración),
 * 2. entradas estáticas de apps, paquetes y protocolos,
 * 3. `CATALOG` exportado por cada paquete (cargado dinámicamente; un paquete ausente no rompe el catálogo).
 * Se deduplica por (kind, key): la primera entrada gana, así los paquetes pueden enriquecer las derivadas.
 */

const CAPABILITY_DESCRIPTIONS: Record<CapabilityKey, string> = {
  'camera.primary': 'Cámara principal para captura',
  'camera.secondary': 'Cámara frontal o secundaria',
  'display.touch': 'Pantalla táctil',
  'printer.photo': 'Impresora fotográfica',
  'printer.thermal': 'Impresora térmica estilo recibo',
  'printer.color': 'Impresión a color',
  'printer.bw': 'Impresión en blanco y negro',
  'lighting.controllable': 'Iluminación controlable por software',
  'payment.terminal': 'Lector de pago (terminal)',
  'connectivity.online': 'Conectividad hacia la nube',
  'storage.local': 'Almacenamiento local suficiente',
  'audio.output': 'Salida de audio',
  'sensor.presence': 'Sensor de presencia',
  'sensor.temperature': 'Sensor de temperatura',
};

export const STATIC_CATALOG: CatalogEntry[] = [
  { kind: 'app', key: '@psp/control-plane', name: 'Control-plane', description: 'API central: administración (/admin/v1) y flota (/fleet/v1), SQLite, seed, simulación de flota.', package: '@psp/control-plane', status: 'stable', docs: 'apps/control-plane/README.md' },
  { kind: 'app', key: '@psp/station-agent', name: 'Station-agent', description: 'Servicio local de la máquina: /station/v1, SSE, sync, hardware mock, retención.', package: '@psp/station-agent', status: 'stable', docs: 'apps/station-agent/README.md' },
  { kind: 'app', key: '@psp/kiosk', name: 'Kiosk', description: 'UI táctil del cliente y panel técnico.', package: '@psp/kiosk', status: 'stable', docs: 'apps/kiosk/README.md' },
  { kind: 'app', key: '@psp/admin', name: 'Admin', description: 'Consola de administración y portal de franquicia.', package: '@psp/admin', status: 'stable', docs: 'apps/admin/README.md' },
  { kind: 'protocol', key: 'fleet.v1', name: 'Protocolo de flota v1', description: 'Estación ↔ nube: enroll, heartbeat, bundle, activos, eventos, comandos.', package: '@psp/contracts', status: 'stable', docs: 'docs/protocolos/fleet-sync-v1.md' },
  { kind: 'protocol', key: 'station.v1', name: 'API de estación v1', description: 'Kiosco ↔ agente local: estado, bundle, sesiones, pagos, IA, panel técnico, SSE.', package: '@psp/contracts', status: 'stable', docs: 'docs/protocolos/station-api-v1.md' },
  { kind: 'protocol', key: 'admin.v1', name: 'API de administración v1', description: 'Consola ↔ control-plane: recursos, configuración, acciones masivas, métricas, auditoría.', package: '@psp/contracts', status: 'stable', docs: 'docs/protocolos/admin-api-v1.md' },
  ...(['@psp/contracts', '@psp/domain', '@psp/config-engine', '@psp/bundler', '@psp/vision', '@psp/imaging', '@psp/integrations', '@psp/i18n', '@psp/ui', '@psp/sqlite', '@psp/fixtures', '@psp/catalog', '@psp/cli', '@psp/gates'] as const).map(
    (name): CatalogEntry => ({ kind: 'package', key: name, name, description: `Paquete ${name}`, package: name, status: 'stable', docs: `${name.startsWith('@psp/cli') || name.startsWith('@psp/gates') ? 'tools' : 'packages'}/${name.replace('@psp/', '')}/README.md` }),
  ),
];

export function contractsCatalog(): CatalogEntry[] {
  const features: CatalogEntry[] = FEATURE_DEFINITIONS.map((f) => ({
    kind: 'feature',
    key: f.key,
    name: f.name.es,
    description: f.description.es,
    package: '@psp/contracts',
    status: f.external ? 'planned' : 'stable',
    docs: 'docs/requisitos-producto.md#18',
  }));
  const capabilities: CatalogEntry[] = CapabilityKey.options.map((k) => ({
    kind: 'capability',
    key: k,
    name: k,
    description: CAPABILITY_DESCRIPTIONS[k],
    package: '@psp/contracts',
    status: 'stable',
    docs: 'docs/arquitectura/04-hardware-y-perifericos.md',
  }));
  const permissions: CatalogEntry[] = PermissionKey.options.map((k) => ({
    kind: 'permission',
    key: k,
    name: k,
    description: `Permiso ${k}`,
    package: '@psp/contracts',
    status: 'stable',
    docs: 'docs/requisitos-producto.md#3',
  }));
  const configKeys: CatalogEntry[] = CONFIG_KEYS.map((k) => ({
    kind: 'configKey',
    key: k.key,
    name: k.name.es,
    description: k.description?.es ?? `${k.group} · ${k.type} · default ${JSON.stringify(k.default)}`,
    package: '@psp/contracts',
    status: 'stable',
    docs: 'docs/arquitectura/02-configuracion-heredada.md',
  }));
  return [...features, ...capabilities, ...permissions, ...configKeys];
}

const PACKAGE_MODULES = ['@psp/domain', '@psp/config-engine', '@psp/bundler', '@psp/vision', '@psp/imaging', '@psp/integrations', '@psp/i18n', '@psp/sqlite', '@psp/fixtures', '@psp/ui'] as const;

export async function packageCatalogs(): Promise<{ entries: CatalogEntry[]; missing: string[] }> {
  const entries: CatalogEntry[] = [];
  const missing: string[] = [];
  for (const name of PACKAGE_MODULES) {
    try {
      const mod = (await import(name)) as { CATALOG?: CatalogEntry[] };
      if (Array.isArray(mod.CATALOG)) entries.push(...mod.CATALOG);
      else missing.push(name);
    } catch {
      missing.push(name);
    }
  }
  return { entries, missing };
}

export function dedupe(entries: CatalogEntry[]): CatalogEntry[] {
  const seen = new Set<string>();
  const out: CatalogEntry[] = [];
  for (const e of entries) {
    const id = `${e.kind}:${e.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(e);
  }
  return out;
}

/** Catálogo completo: paquetes primero (pueden enriquecer), luego derivadas de contratos y estáticas. */
export async function fullCatalog(extra: CatalogEntry[] = []): Promise<CatalogEntry[]> {
  const { entries } = await packageCatalogs();
  return dedupe([...extra, ...entries, ...contractsCatalog(), ...STATIC_CATALOG]).sort((a, b) =>
    a.kind === b.kind ? a.key.localeCompare(b.key) : a.kind.localeCompare(b.kind),
  );
}

export const CATALOG: CatalogEntry[] = STATIC_CATALOG;
