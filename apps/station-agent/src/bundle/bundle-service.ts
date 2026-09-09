/**
 * Bundle activo de la máquina (ADR-007): intenta la nube, cae al bundle cacheado y, si no hay
 * ninguno, construye uno standalone. Guarda activo y anterior en `kv`; cambiar de bundle es atómico.
 */
import type {
  ConfigBundle,
  JsonValue,
  KioskBundle,
  Machine,
  PrinterRuntime,
  ProductAvailabilityState,
  Scope,
} from '@psp/contracts';
import { ConfigBundle as ConfigBundleSchema, Machine as MachineSchema } from '@psp/contracts';
import { computeAvailability } from '@psp/domain';
import type { Store } from '../store/store';
import type { Clock, EventBus } from '../support';
import type { CloudClient } from '../sync/cloud-client';

export const ASSET_URL_BASE = '/station/v1/assets';

/** Cadena mínima reconstruida desde el bundle (misma regla que `@psp/bundler`). */
export function bundleChain(bundle: ConfigBundle): Scope[] {
  const chain: Scope[] = [
    { level: 'platform' },
    { level: 'organization', id: bundle.organizationId },
  ];
  if (bundle.location) chain.push({ level: 'location', id: bundle.location.id });
  chain.push({ level: 'machine', id: bundle.machineId });
  return chain;
}

export function bundleTimezone(bundle: ConfigBundle): string {
  return bundle.machine.timezone ?? bundle.location?.timezone ?? bundle.organization.timezone;
}

export interface KioskRuntime {
  machine: Machine;
  printers: PrinterRuntime[];
  maintenance: boolean;
  now: Date;
}

/** Disponibilidad de productos para el kiosco con el estado real de la máquina. */
export function computeKioskAvailability(
  bundle: ConfigBundle,
  runtime: KioskRuntime,
): ProductAvailabilityState[] {
  return computeAvailability({
    products: bundle.products,
    machine: runtime.machine,
    features: bundle.features,
    printers: runtime.printers,
    availabilities: [],
    chain: bundleChain(bundle),
    now: runtime.now,
    timezone: bundleTimezone(bundle),
    maintenance: runtime.maintenance,
  });
}
const KV_ACTIVE = 'bundle.active';
const KV_PREVIOUS = 'bundle.previous';
export const KV_LOCAL_OVERRIDES = 'config.localOverrides';

export interface BundleServiceOptions {
  store: Store;
  machineId: string;
  clock: Clock;
  bus: EventBus;
  cloud?: CloudClient;
  /** Constructor del bundle standalone (dataset demo o mínimo). */
  fallback: () => ConfigBundle | Promise<ConfigBundle>;
  onActivate?: (bundle: ConfigBundle) => void;
}

export class BundleService {
  #active: ConfigBundle | undefined;
  #source: 'cloud' | 'cache' | 'standalone' = 'standalone';
  readonly #opts: BundleServiceOptions;

  constructor(opts: BundleServiceOptions) {
    this.#opts = opts;
  }

  get bundle(): ConfigBundle {
    if (!this.#active) throw new Error('bundle not initialized');
    return this.#active;
  }

  get source(): 'cloud' | 'cache' | 'standalone' {
    return this.#source;
  }

  /** Arranque: nube → caché → standalone. Nunca lanza por falta de nube. */
  async init(): Promise<void> {
    const cached = this.#opts.store.getKv<ConfigBundle>(KV_ACTIVE);
    const parsed = cached ? ConfigBundleSchema.safeParse(cached) : undefined;
    if (parsed?.success) {
      this.#active = parsed.data;
      this.#source = 'cache';
      this.#opts.onActivate?.(parsed.data);
    }
    await this.refresh();
    // Sin nube, o nube que responde `unchanged` sin que haya bundle: standalone.
    if (!this.#active) this.activate(await this.#opts.fallback(), 'standalone');
  }

  /** Pide a la nube la versión actual; activa la nueva si llega. Devuelve `true` si hubo respuesta válida. */
  async refresh(): Promise<boolean> {
    const cloud = this.#opts.cloud;
    if (!cloud) return false;
    try {
      const response = await cloud.getBundle(this.#active?.version);
      if (response.kind === 'bundle') this.activate(response.bundle, 'cloud');
      else this.#source = this.#active ? 'cloud' : this.#source;
      return true;
    } catch {
      return false;
    }
  }

  activate(bundle: ConfigBundle, source: 'cloud' | 'cache' | 'standalone'): void {
    const now = this.#opts.clock().toISOString();
    const changed = bundle.version !== this.#active?.version;
    this.#opts.store.transaction(() => {
      if (this.#active && changed) this.#opts.store.setKv(KV_PREVIOUS, this.#active, now);
      this.#opts.store.setKv(KV_ACTIVE, bundle, now);
    });
    this.#active = bundle;
    this.#source = source;
    this.#opts.onActivate?.(bundle);
    if (changed) this.#opts.bus.emit({ type: 'bundle_changed', version: bundle.version });
  }

  localOverrides(): Record<string, JsonValue> {
    return this.#opts.store.getKv<Record<string, JsonValue>>(KV_LOCAL_OVERRIDES) ?? {};
  }

  /** Valores efectivos: los del bundle con las sobrescrituras locales del panel técnico encima. */
  effectiveValues(): Record<string, JsonValue> {
    return { ...this.bundle.effective.values, ...this.localOverrides() };
  }

  value<T extends JsonValue>(key: string, fallback: T): T {
    const value = this.effectiveValues()[key];
    return (value === undefined || value === null ? fallback : (value as T)) as T;
  }

  /** `Machine` reconstruida desde el bundle para las funciones de dominio que la exigen. */
  machine(input: { status: Machine['status']; capabilities: Machine['capabilities'] }): Machine {
    const bundle = this.bundle;
    return MachineSchema.parse({
      ...bundle.machine,
      organizationId: bundle.organizationId,
      hardwareProfileId: bundle.hardwareProfile.id,
      ...(bundle.location ? { locationId: bundle.location.id } : {}),
      status: input.status,
      capabilities: input.capabilities,
      bundleVersion: bundle.version,
      createdAt: bundle.generatedAt,
    });
  }

  kioskBundle(runtime: {
    machine: Machine;
    printers: PrinterRuntime[];
    maintenance: boolean;
  }): KioskBundle {
    const bundle = this.bundle;
    const effective = { ...bundle.effective, values: this.effectiveValues() };
    return {
      ...bundle,
      effective,
      availability: computeKioskAvailability(bundle, { ...runtime, now: this.#opts.clock() }),
      assetBaseUrl: ASSET_URL_BASE,
    };
  }
}
