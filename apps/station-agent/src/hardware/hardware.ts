/**
 * Hardware simulado: impresoras mock que escriben PNG en disco, cámara (sólo estado; la captura la
 * hace el kiosco), almacenamiento y terminal. Todo estado es alterable desde el panel técnico.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  CapabilityKey,
  ConfigBundle,
  MachineCapabilityState,
  PrinterDefinition,
  PrinterRuntime,
  PrintJob,
} from '@psp/contracts';
import type { Clock } from '../support';

export interface PrintOutcome {
  ok: boolean;
  error?: string;
}

export interface MockPrinterOptions {
  clock: Clock;
  definition: PrinterDefinition;
  paperEstimate?: number;
  /** Retardo entre `preparing` y `printing`, y entre `printing` y `completed`. */
  stepDelayMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

/** Impresora simulada. `print` escribe la composición como PNG y descuenta papel. */
export class MockPrinter {
  readonly definition: PrinterDefinition;
  status: PrinterRuntime['status'] = 'ready';
  paperEstimate: number;
  lastJobAt?: string;
  message?: string;
  readonly stepDelayMs: number;
  readonly #clock: Clock;

  constructor(opts: MockPrinterOptions) {
    this.definition = opts.definition;
    this.paperEstimate = opts.paperEstimate ?? 200;
    this.stepDelayMs = opts.stepDelayMs ?? 150;
    this.#clock = opts.clock;
  }

  get id(): string {
    return this.definition.id;
  }

  runtime(): PrinterRuntime {
    return {
      ...this.definition,
      status: this.status,
      paperEstimate: this.paperEstimate,
      ...(this.lastJobAt !== undefined ? { lastJobAt: this.lastJobAt } : {}),
      ...(this.message !== undefined ? { message: this.message } : {}),
    };
  }

  /** Motivo por el que no puede imprimir ahora, o `undefined` si está lista. */
  blockedReason(): string | undefined {
    switch (this.status) {
      case 'no_paper':
        return 'printer has no paper';
      case 'jam':
        return 'printer has a paper jam';
      case 'offline':
        return 'printer is offline';
      case 'error':
        return this.message ?? 'printer error';
      default:
        return undefined;
    }
  }

  setStatus(status: PrinterRuntime['status'], message?: string): void {
    this.status = status;
    this.message = message;
  }

  paperChanged(qty: number): void {
    this.paperEstimate = Math.max(0, qty);
    if (this.status === 'no_paper') this.setStatus('ready');
  }

  /** Simula la impresión: escribe `png` en `outputPath` y descuenta `job.copies` hojas. */
  async print(
    job: PrintJob,
    png: Uint8Array,
    outputPath: string,
    onStep?: (status: PrintJob['status']) => void,
  ): Promise<PrintOutcome> {
    const blocked = this.blockedReason();
    if (blocked !== undefined) return { ok: false, error: blocked };
    if (this.paperEstimate < job.copies) {
      this.setStatus('no_paper');
      return { ok: false, error: 'printer has no paper' };
    }
    this.status = 'busy';
    try {
      await sleep(this.stepDelayMs);
      onStep?.('printing');
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, png);
      await sleep(this.stepDelayMs);
      this.paperEstimate = Math.max(0, this.paperEstimate - job.copies);
      this.lastJobAt = this.#clock().toISOString();
      this.status = this.paperEstimate === 0 ? 'no_paper' : 'ready';
      return { ok: true };
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : String(error));
      return { ok: false, error: this.message };
    }
  }
}

export interface HardwareOptions {
  clock: Clock;
  printerStepDelayMs?: number;
  initialPaper?: number;
}

/** Estado de hardware de la máquina, derivado del bundle y de las fallas simuladas. */
export class Hardware {
  readonly printers = new Map<string, MockPrinter>();
  camera = { present: true, operational: true };
  storage = { freeMb: 51_200, usedPct: 22.4, low: false };
  cloudForcedOff = false;
  paymentDeviceOut = false;
  #expected: CapabilityKey[] = [];
  readonly #clock: Clock;
  readonly #opts: HardwareOptions;

  constructor(opts: HardwareOptions) {
    this.#clock = opts.clock;
    this.#opts = opts;
  }

  /** Sincroniza la lista de impresoras y capacidades esperadas con el bundle activo; conserva estados. */
  applyBundle(bundle: ConfigBundle): void {
    const definitions =
      bundle.machine.printers.length > 0
        ? bundle.machine.printers
        : bundle.hardwareProfile.printers;
    const seen = new Set<string>();
    for (const definition of definitions) {
      seen.add(definition.id);
      if (!this.printers.has(definition.id)) {
        this.printers.set(
          definition.id,
          new MockPrinter({
            clock: this.#clock,
            definition,
            ...(this.#opts.initialPaper !== undefined
              ? { paperEstimate: this.#opts.initialPaper }
              : {}),
            ...(this.#opts.printerStepDelayMs !== undefined
              ? { stepDelayMs: this.#opts.printerStepDelayMs }
              : {}),
          }),
        );
      }
    }
    for (const id of [...this.printers.keys()]) if (!seen.has(id)) this.printers.delete(id);
    this.#expected = bundle.hardwareProfile.expectedCapabilities;
    if (!bundle.hardwareProfile.camera || bundle.hardwareProfile.camera.count === 0)
      this.camera.present = false;
  }

  printerRuntimes(): PrinterRuntime[] {
    return [...this.printers.values()].map((printer) => printer.runtime());
  }

  printer(id?: string): MockPrinter | undefined {
    if (id !== undefined) return this.printers.get(id);
    const sorted = [...this.printers.values()].sort(
      (a, b) => a.definition.priority - b.definition.priority,
    );
    return sorted.find((printer) => printer.blockedReason() === undefined) ?? sorted[0];
  }

  /** Capacidades declaradas por el perfil, con el estado real de cámara, impresoras, nube y terminal. */
  capabilities(input: {
    cloudReachable: boolean;
    paymentAdapter: string;
    paymentOperational: boolean;
  }): MachineCapabilityState[] {
    const at = this.#clock().toISOString();
    const printersOk = [...this.printers.values()].some(
      (printer) => printer.blockedReason() === undefined,
    );
    const photo = [...this.printers.values()].filter(
      (printer) => printer.definition.type === 'photo',
    );
    const thermal = [...this.printers.values()].filter(
      (printer) => printer.definition.type === 'thermal',
    );
    const state = (
      key: CapabilityKey,
      present: boolean,
      operational: boolean,
      detail?: string,
    ): MachineCapabilityState => ({
      key,
      present,
      operational: present && operational,
      ...(detail !== undefined ? { detail } : {}),
      updatedAt: at,
    });
    return this.#expected.map((key) => {
      switch (key) {
        case 'camera.primary':
        case 'camera.secondary':
          return state(key, this.camera.present, this.camera.operational);
        case 'printer.photo':
          return state(
            key,
            photo.length > 0,
            photo.some((printer) => printer.blockedReason() === undefined),
            photo[0]?.id,
          );
        case 'printer.thermal':
          return state(
            key,
            thermal.length > 0,
            thermal.some((printer) => printer.blockedReason() === undefined),
            thermal[0]?.id,
          );
        case 'printer.color':
        case 'printer.bw':
          return state(key, this.printers.size > 0, printersOk);
        case 'payment.terminal':
          return state(
            key,
            input.paymentAdapter !== 'none',
            input.paymentOperational && !this.paymentDeviceOut,
            input.paymentAdapter,
          );
        case 'connectivity.online':
          return state(key, true, input.cloudReachable);
        case 'storage.local':
          return state(key, true, !this.storage.low, `${this.storage.freeMb} MB libres`);
        default:
          return state(key, true, true);
      }
    });
  }

  setStorageLow(low: boolean): void {
    this.storage = low
      ? { freeMb: 512, usedPct: 98.5, low: true }
      : { freeMb: 51_200, usedPct: 22.4, low: false };
  }
}
