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


export const GATE_CATALOG: CatalogEntry[] = [
  { kind: 'gate', key: 'agents-size', name: 'Tamaño de AGENTS.md', description: 'AGENTS.md mide menos de 12 000 caracteres.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'readmes', name: 'README por paquete', description: 'Todo paquete y app tiene README con Propósito, Cómo se usa y Cómo se prueba.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'catalog-complete', name: 'Catálogo completo', description: 'Features, capacidades, permisos, claves, apps, paquetes, comandos y compuertas están registrados.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'i18n-parity', name: 'Paridad i18n', description: 'Los catálogos es y en tienen exactamente las mismas claves.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'no-hardcoded-business-text', name: 'Sin texto de negocio en UIs', description: 'Ningún nombre de marca, precio, ciudad o dirección literal en kiosk y admin.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'no-secrets', name: 'Sin secretos', description: 'Ningún archivo versionado contiene un secreto reconocible.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'traceability', name: 'Trazabilidad', description: 'docs/trazabilidad.md referencia secciones existentes con estados válidos.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'progress-evidence', name: 'Evidencia en progreso', description: 'Cada fila de ops/state/PROGRESS.md tiene evidencia.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'validation-at-edges', name: 'Validación en bordes', description: 'Los mensajes de red se validan con safeParse en control-plane, station-agent y kiosco.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'docs-present-tense', name: 'Docs en presente', description: 'La documentación no contiene frases de bitácora.', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'typecheck', name: 'Typecheck', description: 'Los paquetes compilan (quick); todo compila (full).', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'unit-tests', name: 'Pruebas unitarias', description: 'Pruebas de packages y tools (quick) o de todo el repo (full).', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
  { kind: 'gate', key: 'build-apps', name: 'Build de apps', description: 'Las apps web construyen (full).', package: '@psp/gates', status: 'stable', docs: 'tools/gates/README.md' },
];

export const COMMAND_CATALOG: CatalogEntry[] = [
  { kind: 'command', key: 'psp catalog', name: 'pnpm psp catalog', description: 'Imprime el catálogo de capacidades.', package: '@psp/cli', status: 'stable', docs: 'tools/cli/README.md' },
  { kind: 'command', key: 'psp seed', name: 'pnpm psp seed', description: 'Siembra el dataset demo en var/control-plane.', package: '@psp/cli', status: 'stable', docs: 'tools/cli/README.md' },
  { kind: 'command', key: 'psp bundle', name: 'pnpm psp bundle', description: 'Materializa e imprime el bundle efectivo de una máquina con procedencia.', package: '@psp/cli', status: 'stable', docs: 'tools/cli/README.md' },
  { kind: 'command', key: 'psp simulate-fleet', name: 'pnpm psp simulate-fleet', description: 'Crea N máquinas virtuales que envían heartbeats.', package: '@psp/cli', status: 'stable', docs: 'tools/cli/README.md' },
  { kind: 'command', key: 'psp demo', name: 'pnpm psp demo', description: 'Arranque guiado de la demo local.', package: '@psp/cli', status: 'stable', docs: 'tools/cli/README.md' },
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
  return dedupe([...extra, ...entries, ...contractsCatalog(), ...STATIC_CATALOG, ...GATE_CATALOG, ...COMMAND_CATALOG]).sort((a, b) =>
    a.kind === b.kind ? a.key.localeCompare(b.key) : a.kind.localeCompare(b.kind),
  );
}

export const CATALOG: CatalogEntry[] = [...STATIC_CATALOG, ...GATE_CATALOG, ...COMMAND_CATALOG];
