/**
 * Ensamble del agente: estado de máquina, servicios, panel técnico, ejecución de comandos y
 * temporizadores (expiración, reaper, heartbeat, vaciado del outbox).
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ConfigBundle,
  FleetCommand,
  JsonValue,
  MachineStatus,
  MaintenanceActionRequest,
  PrintJob,
  SimulateFaultRequest,
  StationStatus,
  TechStatus,
} from '@psp/contracts';
import {
  CONFIG_KEY_INDEX,
  STATION_API_VERSION,
  type ServiceNotice as ServiceNoticeSchema,
  type TechTestKind,
} from '@psp/contracts';
import type { z } from 'zod';
import { localTimeParts, stableHash } from '@psp/domain';
import { assetContent, demoDataset } from '@psp/fixtures';
import {
  ASSET_URL_BASE,
  BundleService,
  KV_LOCAL_OVERRIDES,
  bundleTimezone,
} from './bundle/bundle-service';
import { standaloneBundle } from './bundle/standalone';
import { loadConfig, type AgentConfig } from './config';
import { Hardware } from './hardware/hardware';
import { AiService, DeliveryService, PaymentService } from './sessions/commerce';
import { SessionService } from './sessions/session-service';
import { Store, type TestResult } from './store/store';
import { CloudClient, type FetchLike } from './sync/cloud-client';
import { Heartbeat, type CommandResult } from './sync/heartbeat';
import { Outbox } from './sync/outbox';
import {
  AgentError,
  EventBus,
  badRequest,
  iso,
  notFound,
  realClock,
  realIdFactory,
  type Clock,
  type IdFactory,
} from './support';

export interface AgentOptions {
  config?: Partial<AgentConfig>;
  clock?: Clock;
  ids?: IdFactory;
  /** Ruta de la base; `:memory:` en pruebas. Por defecto `var/station/<machineId>/station.sqlite`. */
  dbPath?: string;
  /** Constructor del bundle standalone; por defecto el dataset demo de `@psp/fixtures` (o el mínimo si falla). */
  fallback?: (machineId: string, now: Date) => ConfigBundle | Promise<ConfigBundle>;
  /** Con `false` no se construye cliente de nube (modo standalone puro). */
  cloud?: boolean;
  fetch?: FetchLike;
  printerStepDelayMs?: number;
  initialPaper?: number;
  releaseStepDelayMs?: number;
}

interface TechToken {
  token: string;
  expiresAt: number;
}

const TECH_TOKEN_TTL_MS = 30 * 60 * 1000;
const KV_IDENTITY = 'identity';
const KV_MACHINE_STATE = 'machine.state';

interface MachineState {
  maintenance: { on: boolean; message?: string };
  outOfService: { on: boolean; message?: string };
  demoMode: boolean;
  override?: MachineStatus;
}

type ServiceNotice = z.infer<typeof ServiceNoticeSchema>;

/**
 * Bundle standalone: el dataset demo de `@psp/fixtures` materializado con `@psp/bundler` cuando ambos
 * están disponibles (el bundler se carga en tiempo de ejecución porque este paquete no lo declara
 * como dependencia); si algo falla, el bundle mínimo de `standalone.ts`.
 */
export async function demoOrMinimalBundle(machineId: string, now: Date): Promise<ConfigBundle> {
  try {
    const specifier = '@psp/bundler';
    const bundler = (await import(specifier)) as {
      materializeBundle: (
        source: unknown,
        machineId: string,
        opts: { now: Date; assetUrlBase: string },
      ) => ConfigBundle;
    };
    return bundler.materializeBundle(demoDataset(), machineId, {
      now,
      assetUrlBase: ASSET_URL_BASE,
    });
  } catch (error) {
    console.error('[station-agent] dataset demo no disponible; se usa el bundle mínimo:', (error as Error).message);
    return standaloneBundle(machineId, { now, assetUrlBase: ASSET_URL_BASE });
  }
}

export class StationAgent {
  readonly config: AgentConfig;
  readonly clock: Clock;
  readonly ids: IdFactory;
  readonly bus = new EventBus();
  readonly store: Store;
  readonly hardware: Hardware;
  readonly bundles: BundleService;
  readonly outbox: Outbox;
  readonly sessions: SessionService;
  readonly payments: PaymentService;
  readonly ai: AiService;
  readonly delivery: DeliveryService;
  readonly heartbeat: Heartbeat;
  readonly cloud: CloudClient | undefined;
  readonly baseDir: string;
  readonly startedAt: Date;
  state: MachineState;
  #techTokens = new Map<string, TechToken>();
  #timers: ReturnType<typeof setInterval>[] = [];
  #heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  #stopped = false;
  readonly #opts: AgentOptions;

  constructor(opts: AgentOptions = {}) {
    this.#opts = opts;
    this.config = { ...loadConfig(), ...opts.config };
    this.clock = opts.clock ?? realClock;
    this.ids = opts.ids ?? realIdFactory;
    this.startedAt = this.clock();
    this.baseDir = join(this.config.varDir, 'station', this.config.machineId);
    mkdirSync(this.baseDir, { recursive: true });
    this.store = new Store(opts.dbPath ?? join(this.baseDir, 'station.sqlite'));
    this.state = this.store.getKv<MachineState>(KV_MACHINE_STATE) ?? {
      maintenance: { on: false },
      outOfService: { on: false },
      demoMode: false,
    };
    this.hardware = new Hardware({
      clock: this.clock,
      ...(opts.printerStepDelayMs !== undefined
        ? { printerStepDelayMs: opts.printerStepDelayMs }
        : {}),
      ...(opts.initialPaper !== undefined ? { initialPaper: opts.initialPaper } : {}),
    });
    this.cloud =
      opts.cloud === false
        ? undefined
        : new CloudClient({
            baseUrl: this.config.controlPlaneUrl,
            machineId: this.config.machineId,
            machineSecret: this.#identity().secret,
            ...(opts.fetch !== undefined ? { fetch: opts.fetch } : {}),
            forcedOffline: () => this.hardware.cloudForcedOff,
          });
    const fallback = opts.fallback ?? demoOrMinimalBundle;
    this.bundles = new BundleService({
      store: this.store,
      machineId: this.config.machineId,
      clock: this.clock,
      bus: this.bus,
      ...(this.cloud !== undefined ? { cloud: this.cloud } : {}),
      fallback: () => fallback(this.config.machineId, this.clock()),
      onActivate: (bundle) => this.hardware.applyBundle(bundle),
    });
    this.outbox = new Outbox({
      store: this.store,
      clock: this.clock,
      ids: this.ids,
      bus: this.bus,
      machineId: this.config.machineId,
      softwareVersion: this.config.softwareVersion,
      bundleVersion: () => this.#bundleVersion(),
      batchSize: () => this.bundles.value<number>('sync.eventBatchSize', 100),
      ...(this.cloud !== undefined ? { cloud: this.cloud } : {}),
    });
    this.sessions = new SessionService({
      store: this.store,
      bus: this.bus,
      clock: this.clock,
      ids: this.ids,
      machineId: this.config.machineId,
      softwareVersion: this.config.softwareVersion,
      bundles: this.bundles,
      hardware: this.hardware,
      outbox: this.outbox,
      baseDir: this.baseDir,
      paymentStatus: () => this.payments.status(),
      paymentAdapter: () => this.payments.adapter,
      unavailableReason: () => this.unavailableReason(),
      demoMode: () => this.state.demoMode,
      machineStatus: () => this.machineStatus(),
      capabilities: () => this.capabilities(),
    });
    const commerce = {
      store: this.store,
      bus: this.bus,
      clock: this.clock,
      ids: this.ids,
      bundles: this.bundles,
      hardware: this.hardware,
      sessions: this.sessions,
      outbox: this.outbox,
    };
    this.payments = new PaymentService(commerce);
    this.ai = new AiService(commerce);
    this.delivery = new DeliveryService(commerce);
    this.heartbeat = new Heartbeat({
      store: this.store,
      clock: this.clock,
      ids: this.ids,
      bus: this.bus,
      outbox: this.outbox,
      bundles: this.bundles,
      machineId: this.config.machineId,
      softwareVersion: this.config.softwareVersion,
      ...(this.cloud !== undefined ? { cloud: this.cloud } : {}),
      status: () => this.status(),
      execute: (command) => this.executeCommand(command),
      onStatusOverride: (status) => {
        this.state.override = status;
        this.#saveState();
      },
      startedAt: this.startedAt,
    });
  }

  /** Arranque: bundle, recuperación de sesiones, evento de reinicio. No arranca temporizadores. */
  async init(): Promise<this> {
    await this.bundles.init();
    const recovered = this.sessions.recover();
    this.outbox.machineEvent(
      'restart',
      `agent started (${this.bundles.source} bundle ${this.bundles.bundle.version.slice(0, 12)}, ${recovered.length} sessions recovered)`,
    );
    return this;
  }

  /** Temporizadores de operación: expiración (5 s), reaper (30 s), pagos (1 s), heartbeat. */
  start(): void {
    const every = (ms: number, fn: () => void): void => {
      const timer = setInterval(() => {
        try {
          fn();
        } catch {
          // Un tick roto no detiene el agente.
        }
      }, ms);
      timer.unref?.();
      this.#timers.push(timer);
    };
    every(5_000, () => this.sessions.expireIdle());
    every(30_000, () => this.sessions.reap());
    every(1_000, () => this.payments.tick(this.clock()));
    this.#scheduleHeartbeat(0);
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    for (const timer of this.#timers) clearInterval(timer);
    if (this.#heartbeatTimer) clearTimeout(this.#heartbeatTimer);
    await this.sessions.waitForPrints();
    this.store.close();
  }

  #scheduleHeartbeat(delayMs: number): void {
    if (!this.cloud || this.#stopped) return;
    this.#heartbeatTimer = setTimeout(async () => {
      await this.heartbeat.run();
      this.#scheduleHeartbeat(Math.max(5, this.heartbeat.intervalSec) * 1000);
    }, delayMs);
    this.#heartbeatTimer.unref?.();
  }

  /* ---------- identidad ---------- */

  #identity(): { machineId: string; secret: string } {
    const existing = this.store.getKv<{ machineId: string; secret: string }>(KV_IDENTITY);
    if (existing) return existing;
    // Secreto derivado de forma determinista: coincide con el que siembra el control-plane para las máquinas demo.
    // En producción lo sustituye el enrolamiento (`POST /fleet/v1/enroll`) o `PSP_STATION_SECRET`.
    const secret = process.env['PSP_STATION_SECRET'] || stableHash(`secret:${this.config.machineId}`);
    const identity = { machineId: this.config.machineId, secret };
    this.store.setKv(KV_IDENTITY, identity, iso(this.clock()));
    try {
      writeFileSync(join(this.baseDir, 'identity.json'), JSON.stringify(identity), { mode: 0o600 });
    } catch {
      // Sin permisos de escritura la identidad vive sólo en la base.
    }
    return identity;
  }

  #bundleVersion(): string | undefined {
    try {
      return this.bundles.bundle.version;
    } catch {
      return undefined;
    }
  }

  #saveState(): void {
    this.store.setKv(KV_MACHINE_STATE, this.state, iso(this.clock()));
  }

  /* ---------- estado ---------- */

  machineStatus(): MachineStatus {
    if (this.state.override !== undefined && this.state.override !== 'active')
      return this.state.override;
    if (this.state.outOfService.on) return 'out_of_service';
    if (this.state.maintenance.on) return 'maintenance';
    if (this.state.demoMode) return 'demo';
    return this.notices().some((notice) => notice.kind !== 'info')
      ? 'active_with_warnings'
      : 'active';
  }

  unavailableReason(): string | undefined {
    if (this.state.outOfService.on)
      return this.state.outOfService.message ?? 'machine is out of service';
    if (this.state.maintenance.on)
      return this.state.maintenance.message ?? 'machine is under maintenance';
    const status = this.machineStatus();
    if (status === 'suspended' || status === 'retired' || status === 'storage')
      return `machine is ${status}`;
    return undefined;
  }

  capabilities() {
    const paymentStatus = this.payments.status();
    return this.hardware.capabilities({
      cloudReachable: this.cloud?.reachable ?? false,
      paymentAdapter: this.payments.adapter,
      paymentOperational: paymentStatus === 'ready' || paymentStatus === 'busy',
    });
  }

  notices(): ServiceNotice[] {
    const notices: ServiceNotice[] = [];
    for (const printer of this.hardware.printers.values()) {
      const blocked = printer.blockedReason();
      if (blocked !== undefined)
        notices.push({
          kind: 'warning',
          code: `printer_${printer.status}`,
          message: {
            es: `Impresora ${printer.definition.name}: ${blocked}`,
            en: `Printer ${printer.definition.name}: ${blocked}`,
          },
        });
      else if (printer.paperEstimate <= 10)
        notices.push({
          kind: 'warning',
          code: 'paper_low',
          message: {
            es: `Quedan ${printer.paperEstimate} hojas`,
            en: `${printer.paperEstimate} sheets left`,
          },
        });
    }
    if (!this.hardware.camera.operational)
      notices.push({
        kind: 'error',
        code: 'camera_off',
        message: { es: 'La cámara no responde', en: 'Camera is not responding' },
      });
    if (this.hardware.storage.low)
      notices.push({
        kind: 'warning',
        code: 'storage_low',
        message: { es: 'Poco espacio de almacenamiento', en: 'Storage is running low' },
      });
    if (this.hardware.paymentDeviceOut)
      notices.push({
        kind: 'warning',
        code: 'payment_device_out',
        message: {
          es: 'Terminal de pago fuera de servicio',
          en: 'Payment terminal out of service',
        },
      });
    if (this.cloud && !this.cloud.reachable)
      notices.push({
        kind: 'info',
        code: 'cloud_unreachable',
        message: {
          es: 'Sin conexión con la nube; la máquina opera de forma autónoma',
          en: 'Cloud unreachable; the machine runs autonomously',
        },
      });
    if (this.state.maintenance.on)
      notices.push({
        kind: 'info',
        code: 'maintenance',
        message: {
          es: this.state.maintenance.message ?? 'En mantenimiento',
          en: this.state.maintenance.message ?? 'Under maintenance',
        },
      });
    return notices;
  }

  status(): StationStatus {
    const bundle = this.bundles.bundle;
    const now = this.clock();
    const timezone = bundleTimezone(bundle);
    const active = this.sessions.active();
    const outbox = this.outbox.summary();
    return {
      apiVersion: STATION_API_VERSION,
      machineId: bundle.machineId,
      machineCode: bundle.machine.code,
      machineName: bundle.machine.name,
      organizationId: bundle.organizationId,
      status: this.machineStatus(),
      cloudReachable: this.cloud?.reachable ?? false,
      ...(this.heartbeat.lastSyncAt !== undefined ? { lastSyncAt: this.heartbeat.lastSyncAt } : {}),
      bundleVersion: bundle.version,
      softwareVersion: this.config.softwareVersion,
      maintenance: this.state.maintenance,
      capabilities: this.capabilities(),
      printers: this.hardware.printerRuntimes(),
      paymentTerminal: { adapter: this.payments.adapter, status: this.payments.status() },
      storage: { freeMb: this.hardware.storage.freeMb, usedPct: this.hardware.storage.usedPct },
      time: { now: iso(now), timezone, localTime: localTimeParts(now, timezone).hhmm },
      ...(active !== undefined ? { activeSessionId: active.id } : {}),
      demoMode: this.state.demoMode,
      notices: this.notices(),
      pendingEvents: outbox.pending,
      release: this.heartbeat.release,
    };
  }

  kioskBundle() {
    return this.bundles.kioskBundle({
      machine: this.bundles.machine({
        status: this.machineStatus(),
        capabilities: this.capabilities(),
      }),
      printers: this.hardware.printerRuntimes(),
      maintenance: this.state.maintenance.on || this.state.outOfService.on,
    });
  }

  /** Bytes de un activo por hash: caché local o, en standalone, el contenido generado por fixtures. */
  async asset(hash: string): Promise<{ bytes: Uint8Array; mime: string }> {
    const entry = this.bundles.bundle.assets.find((asset) => asset.hash === hash);
    if (!entry) throw notFound('asset', hash);
    const cachePath = join(this.baseDir, 'assets', hash);
    if (existsSync(cachePath)) return { bytes: readFileSync(cachePath), mime: entry.mime };
    let content: { bytes: Uint8Array; mime: string } | undefined;
    if (this.cloud && this.bundles.source === 'cloud') {
      try {
        content = await this.cloud.getAsset(hash);
      } catch {
        content = undefined;
      }
    }
    if (!content) {
      try {
        content = assetContent(entry.assetId);
      } catch {
        throw notFound('asset', hash);
      }
    }
    mkdirSync(join(this.baseDir, 'assets'), { recursive: true });
    writeFileSync(cachePath, content.bytes);
    return { bytes: content.bytes, mime: entry.mime };
  }

  /* ---------- panel técnico ---------- */

  techLogin(pin: string): { token: string; expiresAt: string } {
    const configured = this.bundles.value<string>('techPanel.pinHash', '');
    const expected =
      configured.length > 0
        ? configured.toLowerCase()
        : createHash('sha256').update(this.config.techPin).digest('hex');
    const given = createHash('sha256').update(pin).digest('hex');
    if (given !== expected) throw new AgentError(401, 'invalid_pin', 'invalid technician PIN');
    const token = randomBytes(24).toString('hex');
    const expiresAt = this.clock().getTime() + TECH_TOKEN_TTL_MS;
    this.#techTokens.set(token, { token, expiresAt });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  techAuthorized(header: string | undefined): boolean {
    const match = /^Tech\s+(\S+)$/i.exec(header ?? '');
    if (!match) return false;
    const entry = this.#techTokens.get(match[1] ?? '');
    if (!entry) return false;
    if (entry.expiresAt < this.clock().getTime()) {
      this.#techTokens.delete(entry.token);
      return false;
    }
    return true;
  }

  techStatus(): TechStatus {
    const bundle = this.bundles.bundle;
    const values = this.bundles.effectiveValues();
    const summaryKeys = [
      'branding.publicName',
      'kiosk.defaultLocale',
      'payment.businessMode',
      'payment.terminalAdapter',
      'timing.idleTimeoutSec',
      'printing.defaultCopies',
      'sync.heartbeatIntervalSec',
      'privacy.defaultRetentionPolicyId',
    ];
    const effectiveConfigSummary: Record<string, JsonValue> = {};
    for (const key of summaryKeys) effectiveConfigSummary[key] = values[key] ?? null;
    effectiveConfigSummary['bundle.version'] = bundle.version;
    effectiveConfigSummary['bundle.source'] = this.bundles.source;
    return {
      status: this.status(),
      ...(bundle.location
        ? { location: { id: bundle.location.id, name: bundle.location.publicName } }
        : {}),
      organizationName: bundle.organization.name,
      effectiveConfigSummary,
      recentSessions: this.store.recentSessions(10).map((session) => this.sessions.record(session)),
      recentEvents: this.store.recentEvents(30),
      recentTests: this.store.recentTests(10),
      localOverrides: this.bundles.localOverrides(),
      consumables: this.hardware
        .printerRuntimes()
        .map((printer) => ({
          type: printer.consumableType ?? 'photo_paper',
          estimatedRemaining: printer.paperEstimate ?? 0,
          unit: 'prints',
        })),
      outbox: this.outbox.summary(),
    };
  }

  runTest(kind: z.infer<typeof TechTestKind>): TestResult {
    const at = iso(this.clock());
    const printer = this.hardware.printer();
    const blocked = printer?.blockedReason();
    let result: TestResult;
    switch (kind) {
      case 'camera':
      case 'preview':
      case 'capture':
        result = {
          kind,
          ok: this.hardware.camera.present && this.hardware.camera.operational,
          message: this.hardware.camera.operational ? 'camera responds' : 'camera not operational',
          details: { ...this.hardware.camera },
          at,
        };
        break;
      case 'print':
        result = {
          kind,
          ok: printer !== undefined && blocked === undefined,
          message: printer
            ? (blocked ?? `printer ${printer.id} ready, ${printer.paperEstimate} sheets`)
            : 'no printer',
          at,
        };
        break;
      case 'storage':
        result = {
          kind,
          ok: !this.hardware.storage.low,
          message: `${this.hardware.storage.freeMb} MB free`,
          details: { ...this.hardware.storage },
          at,
        };
        break;
      case 'network':
        result = {
          kind,
          ok: this.cloud?.reachable ?? false,
          message: this.cloud
            ? this.cloud.reachable
              ? 'cloud reachable'
              : (this.cloud.lastError ?? 'cloud unreachable')
            : 'standalone mode (no cloud configured)',
          at,
        };
        break;
      case 'demo_session':
      case 'composition':
        result = {
          kind,
          ok: this.bundles.bundle.products.length > 0 && this.bundles.bundle.templates.length > 0,
          message: `${this.bundles.bundle.products.length} products, ${this.bundles.bundle.templates.length} templates`,
          at,
        };
        break;
      default:
        result = { kind, ok: true, message: `${kind} test simulated ok`, at };
    }
    this.store.saveTest(result);
    this.outbox.machineEvent(
      'test_run',
      `test ${kind}: ${result.ok ? 'ok' : 'failed'} (${result.message})`,
      { payload: { kind, ok: result.ok } },
    );
    return result;
  }

  printTest(): PrintJob {
    const printer = this.hardware.printer();
    if (!printer) throw notFound('printer', 'default');
    const blocked = printer.blockedReason();
    if (blocked !== undefined)
      throw new AgentError(409, 'printer_unavailable', `cannot print: ${blocked}`);
    const job: PrintJob = {
      id: this.ids('pj'),
      machineId: this.config.machineId,
      printerId: printer.id,
      copies: 1,
      status: 'preparing',
      attempt: 1,
      idempotencyKey: `test-${this.ids('key')}`,
      isTest: true,
      createdAt: iso(this.clock()),
    };
    this.store.savePrintJob(job);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const outputPath = join(this.baseDir, 'prints', `${job.id}.png`);
    void printer.print(job, png, outputPath).then((outcome) => {
      job.status = outcome.ok ? 'completed' : 'failed';
      if (outcome.ok) {
        job.completedAt = iso(this.clock());
        job.outputPath = outputPath;
      } else job.error = outcome.error ?? 'print failed';
      this.store.savePrintJob(job);
      this.bus.emit({ type: 'print_job', job });
      this.bus.emit({ type: 'printer', printer: printer.runtime() });
      this.outbox.machineEvent(
        outcome.ok ? 'print_completed' : 'print_failed',
        `test print ${job.id} ${job.status}`,
        { payload: { isTest: true } },
      );
    });
    this.bus.emit({ type: 'print_job', job });
    return job;
  }

  maintenance(action: MaintenanceActionRequest): { ok: true; status: StationStatus } {
    switch (action.action) {
      case 'out_of_service':
        this.state.outOfService = {
          on: true,
          ...(action.message !== undefined ? { message: action.message } : {}),
        };
        this.outbox.machineEvent('out_of_service', action.message ?? 'out of service', {
          severity: 'warning',
        });
        this.bus.emit({
          type: 'maintenance',
          on: true,
          ...(action.message !== undefined ? { message: action.message } : {}),
        });
        break;
      case 'back_in_service':
        this.state.outOfService = { on: false };
        this.outbox.machineEvent('back_in_service', 'back in service');
        this.bus.emit({ type: 'maintenance', on: this.state.maintenance.on });
        break;
      case 'maintenance_on':
        this.state.maintenance = {
          on: true,
          ...(action.message !== undefined ? { message: action.message } : {}),
        };
        this.outbox.machineEvent('maintenance_on', action.message ?? 'maintenance on');
        this.bus.emit({
          type: 'maintenance',
          on: true,
          ...(action.message !== undefined ? { message: action.message } : {}),
        });
        break;
      case 'maintenance_off':
        this.state.maintenance = { on: false };
        this.outbox.machineEvent('maintenance_off', 'maintenance off');
        this.bus.emit({ type: 'maintenance', on: false });
        break;
      case 'clear_temp_sessions': {
        const count = this.sessions.clearTemp();
        this.outbox.machineEvent('session_cancelled', `${count} temporary sessions cleared`, {
          payload: { count },
        });
        break;
      }
      case 'paper_changed': {
        const printer = this.hardware.printers.get(action.printerId);
        if (!printer) throw notFound('printer', action.printerId);
        printer.paperChanged(action.qty);
        const at = iso(this.clock());
        this.outbox.machineEvent(
          'consumable_changed',
          `paper changed on ${printer.id}: ${action.qty}`,
          { payload: { printerId: printer.id, qty: action.qty } },
        );
        this.outbox.enqueue({
          type: 'consumable_update',
          payload: {
            id: this.ids('cns'),
            machineId: this.config.machineId,
            type:
              (printer.definition.consumableType as
                | 'photo_paper'
                | 'thermal_paper'
                | 'ink_ribbon'
                | 'cleaning_kit'
                | 'other'
                | undefined) ?? 'photo_paper',
            unit: 'prints',
            installedQty: action.qty,
            estimatedRemaining: printer.paperEstimate,
            changedAt: at,
            changedBy: { type: 'user', name: 'technician' },
            localStock: 0,
            history: [],
          },
        });
        this.bus.emit({ type: 'printer', printer: printer.runtime() });
        break;
      }
      case 'log_maintenance':
        this.outbox.enqueue({
          type: 'maintenance_log',
          payload: {
            id: this.ids('mnt'),
            machineId: this.config.machineId,
            type: ([
              'preventive',
              'repair',
              'paper_change',
              'cleaning',
              'inspection',
              'installation',
              'other',
            ].includes(action.type)
              ? action.type
              : 'other') as 'other',
            performedAt: iso(this.clock()),
            performedBy: { type: 'user', name: 'technician' },
            ...(action.checklistId !== undefined ? { checklistId: action.checklistId } : {}),
            checklistResults: action.results,
            ...(action.notes !== undefined ? { notes: action.notes } : {}),
            consumablesUsed: [],
          },
        });
        this.outbox.machineEvent('maintenance_on', `maintenance logged: ${action.type}`, {
          payload: { type: action.type },
        });
        break;
      case 'open_incident': {
        const id = this.ids('inc');
        const at = iso(this.clock());
        this.outbox.enqueue({
          type: 'incident',
          payload: {
            id,
            code: `INC-${id.slice(-4).toUpperCase()}`,
            machineId: this.config.machineId,
            organizationId: this.bundles.bundle.organizationId,
            severity: action.severity,
            category: ([
              'printer',
              'camera',
              'display',
              'payment',
              'software',
              'connectivity',
              'physical',
              'consumables',
              'lighting',
              'other',
            ].includes(action.category)
              ? action.category
              : 'other') as 'other',
            title: action.title,
            ...(action.description !== undefined ? { description: action.description } : {}),
            evidenceAssetIds: [],
            reportedAt: at,
            reportedBy: { type: 'user', name: 'technician' },
            status: 'open',
            notes: [],
            partsUsed: [],
            source: 'manual',
            createdAt: at,
          },
        });
        this.outbox.machineEvent('incident_opened', `incident ${id}: ${action.title}`, {
          severity: 'warning',
          payload: { incidentId: id, severity: action.severity },
        });
        break;
      }
      case 'close_incident':
        this.outbox.machineEvent(
          'incident_closed',
          `incident ${action.incidentId} closed: ${action.resolution}`,
          { payload: { incidentId: action.incidentId, resolution: action.resolution } },
        );
        break;
      case 'set_demo_mode':
        this.state.demoMode = action.on;
        this.outbox.machineEvent('local_config_changed', `demo mode ${action.on ? 'on' : 'off'}`, {
          payload: { demoMode: action.on },
        });
        break;
      case 'sync_now':
        void this.heartbeat.run();
        break;
    }
    this.#saveState();
    const status = this.status();
    this.bus.emit({ type: 'status', status });
    return { ok: true, status };
  }

  /** Sobrescrituras locales: sólo claves editables a nivel `machine`; cada cambio se audita. */
  patchLocalConfig(values: Record<string, JsonValue>, reason?: string): Record<string, JsonValue> {
    const rejected: string[] = [];
    for (const key of Object.keys(values)) {
      const definition = CONFIG_KEY_INDEX[key];
      if (!definition || !definition.editableAt.includes('machine')) rejected.push(key);
    }
    if (rejected.length > 0)
      throw badRequest(
        'key_not_editable',
        `keys not editable at machine level: ${rejected.join(', ')}`,
        { rejected },
      );
    const before = this.bundles.localOverrides();
    const after = { ...before, ...values };
    for (const key of Object.keys(values)) if (values[key] === null) delete after[key];
    this.store.setKv(KV_LOCAL_OVERRIDES, after, iso(this.clock()));
    this.outbox.enqueue({
      type: 'local_audit',
      payload: {
        id: this.ids('aud'),
        at: iso(this.clock()),
        actor: { type: 'user', name: 'technician' },
        action: 'local_config.patch',
        entityType: 'machine',
        entityId: this.config.machineId,
        scope: { level: 'machine', id: this.config.machineId },
        before,
        after,
        origin: 'station',
        ...(reason !== undefined ? { reason } : {}),
      },
    });
    this.outbox.machineEvent(
      'local_config_changed',
      `local config changed: ${Object.keys(values).join(', ')}`,
      { payload: { keys: Object.keys(values) } },
    );
    this.bus.emit({ type: 'bundle_changed', version: this.bundles.bundle.version });
    return after;
  }

  simulate(fault: SimulateFaultRequest): StationStatus {
    const printer = 'printerId' in fault ? this.hardware.printers.get(fault.printerId) : undefined;
    if ('printerId' in fault && !printer) throw notFound('printer', fault.printerId);
    switch (fault.fault) {
      case 'printer_no_paper':
        printer?.setStatus('no_paper');
        this.outbox.machineEvent(
          'paper_out',
          `printer ${fault.printerId} out of paper (simulated)`,
          { severity: 'warning' },
        );
        break;
      case 'printer_jam':
        printer?.setStatus('jam', 'paper jam (simulated)');
        this.outbox.machineEvent('printer_status', `printer ${fault.printerId} jam (simulated)`, {
          severity: 'error',
        });
        break;
      case 'printer_ok':
        printer?.setStatus('ready');
        if (printer && printer.paperEstimate === 0) printer.paperChanged(50);
        this.outbox.machineEvent('printer_status', `printer ${fault.printerId} ready`);
        break;
      case 'camera_off':
        this.hardware.camera.operational = false;
        this.outbox.machineEvent('camera_error', 'camera off (simulated)', { severity: 'error' });
        break;
      case 'camera_on':
        this.hardware.camera.operational = true;
        break;
      case 'cloud_off':
        this.hardware.cloudForcedOff = true;
        if (this.cloud) this.cloud.reachable = false;
        this.outbox.machineEvent('offline', 'cloud off (simulated)', { severity: 'warning' });
        break;
      case 'cloud_on':
        this.hardware.cloudForcedOff = false;
        void this.heartbeat.run();
        break;
      case 'storage_low':
        this.hardware.setStorageLow(true);
        break;
      case 'storage_ok':
        this.hardware.setStorageLow(false);
        break;
      case 'payment_device_out':
        this.payments.setDeviceOut(true);
        break;
      case 'payment_device_ok':
        this.payments.setDeviceOut(false);
        break;
    }
    if (printer) this.bus.emit({ type: 'printer', printer: printer.runtime() });
    this.outbox.enqueue({ type: 'capability_change', payload: this.capabilities() });
    const status = this.status();
    this.bus.emit({ type: 'status', status });
    return status;
  }

  /* ---------- comandos de la nube ---------- */

  async executeCommand(command: FleetCommand): Promise<CommandResult> {
    switch (command.type) {
      case 'set_maintenance':
        this.maintenance(
          command.on
            ? {
                action: 'maintenance_on',
                ...(command.message !== undefined ? { message: command.message } : {}),
              }
            : { action: 'maintenance_off' },
        );
        return { result: 'ok' };
      case 'set_status':
        this.state.override = command.status;
        this.state.outOfService = {
          on: command.status === 'out_of_service',
          ...(command.reason !== undefined ? { message: command.reason } : {}),
        };
        this.#saveState();
        this.bus.emit({ type: 'status', status: this.status() });
        return { result: 'ok' };
      case 'reload_bundle':
        return {
          result: (await this.bundles.refresh()) ? 'ok' : 'failed',
          message: `bundle ${this.bundles.bundle.version.slice(0, 12)}`,
        };
      case 'apply_release': {
        const state = await this.heartbeat.applyRelease(
          {
            version: command.version,
            rolloutId: command.rolloutId,
            requiresRestart: command.requiresRestart,
          },
          this.#opts.releaseStepDelayMs ?? 200,
        );
        return {
          result: state.status === 'completed' ? 'ok' : 'failed',
          message: `release ${command.version}: ${state.status}`,
        };
      }
      case 'rollback_release':
        this.heartbeat.rollbackRelease(command.toVersion, command.rolloutId);
        return { result: 'ok' };
      case 'pause_release':
        this.heartbeat.pauseRelease();
        return { result: 'ok' };
      case 'restart_app':
        this.outbox.machineEvent('restart', 'restart requested by cloud (no-op in mock)');
        return { result: 'ok', message: 'restart simulated' };
      case 'clear_temp_sessions':
        this.maintenance({ action: 'clear_temp_sessions' });
        return { result: 'ok' };
      case 'run_test': {
        const result = this.runTest(command.kind);
        return { result: result.ok ? 'ok' : 'failed', message: result.message };
      }
      case 'print_test':
        this.printTest();
        return { result: 'ok' };
      case 'sync_now':
        await this.outbox.flush();
        return { result: 'ok' };
      case 'capture_diagnostics':
        this.outbox.enqueue({
          type: 'diagnostics',
          payload: {
            status: JSON.parse(JSON.stringify(this.status())) as JsonValue,
            tests: JSON.parse(JSON.stringify(this.store.recentTests(5))) as JsonValue,
          },
        });
        return { result: 'ok' };
      case 'set_local_config':
        try {
          this.patchLocalConfig(command.values, command.reason);
          return { result: 'ok' };
        } catch (error) {
          return {
            result: 'failed',
            message: error instanceof Error ? error.message : String(error),
          };
        }
      case 'suspend':
        this.state.override = 'suspended';
        this.#saveState();
        this.bus.emit({ type: 'status', status: this.status() });
        return { result: 'ok' };
      case 'resume':
        delete this.state.override;
        this.#saveState();
        this.bus.emit({ type: 'status', status: this.status() });
        return { result: 'ok' };
      default:
        return { result: 'skipped', message: 'unknown command' };
    }
  }
}

export async function createAgent(opts: AgentOptions = {}): Promise<StationAgent> {
  return new StationAgent(opts).init();
}
