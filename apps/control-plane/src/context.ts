/**
 * Contexto compartido por las rutas: base, reloj e ids inyectables, índice de jerarquía, fuente
 * de bundles, caché de bundles materializados y auditoría. Sin estado global de módulo.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Actor,
  AuditEntry,
  ConfigBundle,
  Id,
  KioskBundle,
  Machine,
  Scope,
} from '@psp/contracts';
import { buildHierarchyIndex, makeId, type HierarchyIndex } from '@psp/domain';
import { computeKioskAvailability, materializeBundle, type BundleSource } from '@psp/bundler';
import type { DatabaseSync } from '@psp/sqlite';
import {
  EntityRepo,
  getCachedBundle,
  getHeartbeat,
  invalidateBundles,
  putAuditEntry,
  putCachedBundle,
  type EntityType,
} from './store';

/** Error HTTP con forma `ApiError`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string, id?: string): HttpError => new HttpError(404, 'not_found', id ? `${what} not found: ${id}` : `${what} not found`);
export const forbidden = (message = 'Forbidden'): HttpError => new HttpError(403, 'forbidden', message);
export const unauthorized = (message = 'Unauthorized'): HttpError => new HttpError(401, 'unauthorized', message);
export const validation = (details: unknown, message = 'Validation failed'): HttpError => new HttpError(400, 'validation', message, details);
export const conflict = (message: string, details?: unknown): HttpError => new HttpError(409, 'conflict', message, details);

export interface ContextOptions {
  db: DatabaseSync;
  /** Reloj inyectable. */
  now?: () => Date;
  /** Generador aleatorio para ids (inyectable en pruebas). */
  random?: () => string;
  /** Directorio de activos (`<hash>` por archivo). */
  assetsDir: string;
  /** Base de URL para el manifiesto de activos del bundle. */
  assetUrlBase?: string;
}

const SOURCE_TYPES: Array<keyof BundleSource> = [
  'organizations',
  'franchises',
  'regions',
  'locations',
  'machines',
  'hardwareProfiles',
  'blueprints',
  'products',
  'productAvailabilities',
  'priceRules',
  'promotions',
  'presets',
  'presetVersions',
  'templates',
  'experiences',
  'editingPresets',
  'campaigns',
  'assets',
  'retentionPolicies',
  'maintenanceChecklists',
  'configLayers',
  'featureOverrides',
  'entitlementPlans',
  'entitlements',
];

export class AppContext {
  readonly db: DatabaseSync;
  readonly repo: EntityRepo;
  readonly now: () => Date;
  readonly random: (() => string) | undefined;
  readonly assetsDir: string;
  readonly assetUrlBase: string;
  private sourceCache: BundleSource | undefined;
  private indexCache: HierarchyIndex | undefined;

  constructor(opts: ContextOptions) {
    this.db = opts.db;
    this.repo = new EntityRepo(opts.db);
    this.now = opts.now ?? (() => new Date());
    this.random = opts.random;
    this.assetsDir = opts.assetsDir;
    this.assetUrlBase = opts.assetUrlBase ?? '/fleet/v1/assets';
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  id(prefix: string): string {
    return makeId(prefix, this.random);
  }

  /** Invalida cachés en memoria y, opcionalmente, los bundles de las máquinas indicadas (todas si se omite). */
  invalidate(machineIds?: Id[]): void {
    this.sourceCache = undefined;
    this.indexCache = undefined;
    invalidateBundles(this.db, machineIds);
  }

  /** Índice de jerarquía construido desde la base; se cachea hasta la siguiente mutación. */
  index(): HierarchyIndex {
    if (!this.indexCache) {
      this.indexCache = buildHierarchyIndex({
        organizations: this.repo.list('organizations'),
        franchises: this.repo.list('franchises'),
        regions: this.repo.list('regions'),
        locations: this.repo.list('locations'),
        machines: this.repo.list('machines'),
      });
    }
    return this.indexCache;
  }

  /** Fuente completa para materializar bundles, leída de `entities`. */
  source(): BundleSource {
    if (!this.sourceCache) {
      const source: Record<string, unknown[]> = {};
      for (const type of SOURCE_TYPES) source[type] = this.repo.list(type as EntityType);
      this.sourceCache = source as unknown as BundleSource;
    }
    return this.sourceCache;
  }

  /** Bundle de la máquina: de caché si existe; si no, materializado y guardado. */
  bundle(machineId: Id): ConfigBundle {
    const cached = getCachedBundle<ConfigBundle>(this.db, machineId);
    if (cached) return cached;
    const now = this.now();
    const bundle = materializeBundle(this.source(), machineId, { now, assetUrlBase: this.assetUrlBase });
    putCachedBundle(this.db, machineId, bundle.version, bundle, bundle.generatedAt);
    return bundle;
  }

  /** KioskBundle: bundle + disponibilidad calculada con el último heartbeat + base de activos. */
  kioskBundle(machineId: Id, bundle?: ConfigBundle): KioskBundle {
    const machine = this.repo.get<Machine>('machines', machineId);
    if (!machine) throw notFound('machine', machineId);
    const base = bundle ?? this.bundle(machineId);
    const heartbeat = getHeartbeat(this.db, machineId);
    const availability = computeKioskAvailability(base, {
      machine: heartbeat ? { ...machine, capabilities: heartbeat.capabilities } : machine,
      printers: heartbeat?.printers ?? [],
      maintenance: heartbeat?.maintenance.on ?? machine.status === 'maintenance',
      now: this.now(),
    });
    return { ...base, availability, assetBaseUrl: this.assetUrlBase };
  }

  readAsset(hash: string): Buffer | undefined {
    if (!/^[a-f0-9]{16,128}$/i.test(hash)) return undefined;
    const path = join(this.assetsDir, hash);
    if (!existsSync(path)) return undefined;
    return readFileSync(path);
  }

  /** Escribe una entrada de auditoría (toda mutación pasa por aquí). */
  audit(input: {
    actor: Actor;
    action: string;
    entityType: string;
    entityId?: Id;
    scope?: Scope;
    before?: unknown;
    after?: unknown;
    origin?: AuditEntry['origin'];
    reason?: string;
    organizationId?: Id;
  }): AuditEntry {
    const entry: AuditEntry = {
      id: this.id('aud'),
      at: this.nowIso(),
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.before !== undefined ? { before: input.before as AuditEntry['before'] } : {}),
      ...(input.after !== undefined ? { after: input.after as AuditEntry['after'] } : {}),
      origin: input.origin ?? 'admin',
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    };
    putAuditEntry(this.db, entry, input.organizationId);
    return entry;
  }
}
