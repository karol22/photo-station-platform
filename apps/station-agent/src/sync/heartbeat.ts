/**
 * Heartbeat (ADR-004): envía el estado real y ejecuta los comandos de la respuesta una sola vez
 * (inbox por id), confirmando cada uno con `command_ack` en el outbox. También simula releases.
 */
import type {
  FleetCommand,
  HeartbeatRequest,
  HeartbeatResponse,
  MachineReleaseState,
  StationStatus,
} from '@psp/contracts';
import { localTimeParts, nextReleaseStatus } from '@psp/domain';
import type { BundleService } from '../bundle/bundle-service';
import type { Store } from '../store/store';
import type { Clock, EventBus, IdFactory } from '../support';
import { iso } from '../support';
import type { CloudClient } from './cloud-client';
import type { Outbox } from './outbox';

export type CommandResult = { result: 'ok' | 'failed' | 'expired' | 'skipped'; message?: string };
export type CommandExecutor = (command: FleetCommand) => Promise<CommandResult>;

export interface HeartbeatOptions {
  store: Store;
  clock: Clock;
  ids: IdFactory;
  bus: EventBus;
  outbox: Outbox;
  bundles: BundleService;
  machineId: string;
  softwareVersion: string;
  cloud?: CloudClient;
  status: () => StationStatus;
  execute: CommandExecutor;
  onStatusOverride: (status: StationStatus['status']) => void;
  startedAt: Date;
}

const KV_RELEASE = 'release.state';
const CONSUMABLE_TYPES = [
  'photo_paper',
  'thermal_paper',
  'ink_ribbon',
  'cleaning_kit',
  'other',
] as const;
type ConsumableType = (typeof CONSUMABLE_TYPES)[number];

function consumableType(value: string | undefined): ConsumableType {
  return (CONSUMABLE_TYPES as readonly string[]).includes(value ?? '')
    ? (value as ConsumableType)
    : 'photo_paper';
}

export class Heartbeat {
  readonly #o: HeartbeatOptions;
  intervalSec: number;
  lastSyncAt: string | undefined;
  #release: MachineReleaseState;
  #running = false;

  constructor(opts: HeartbeatOptions) {
    this.#o = opts;
    this.intervalSec = 30;
    const now = iso(opts.clock());
    this.#release = opts.store.getKv<MachineReleaseState>(KV_RELEASE) ?? {
      machineId: opts.machineId,
      currentVersion: opts.softwareVersion,
      status: 'up_to_date',
      requiresRestart: false,
      updatedAt: now,
    };
  }

  get release(): MachineReleaseState {
    return this.#release;
  }

  buildRequest(status: StationStatus = this.#o.status()): HeartbeatRequest {
    const now = this.#o.clock();
    const { machineId: _m, updatedAt: _u, ...release } = this.#release;
    return {
      machineId: this.#o.machineId,
      at: iso(now),
      localTime: localTimeParts(now, status.time.timezone).hhmm,
      timezone: status.time.timezone,
      softwareVersion: this.#o.softwareVersion,
      ...(status.bundleVersion !== undefined ? { bundleVersion: status.bundleVersion } : {}),
      status: status.status,
      capabilities: status.capabilities,
      printers: status.printers,
      consumables: status.printers.map((printer) => ({
        type: consumableType(printer.consumableType),
        estimatedRemaining: printer.paperEstimate ?? 0,
        unit: 'prints',
      })),
      health: {
        diskFreeMb: status.storage.freeMb,
        storagePct: status.storage.usedPct,
        uptimeSec: Math.max(0, Math.floor((now.getTime() - this.#o.startedAt.getTime()) / 1000)),
        cloudReachable: status.cloudReachable,
      },
      release,
      ...(status.activeSessionId !== undefined ? { activeSessionId: status.activeSessionId } : {}),
      pendingEvents: status.pendingEvents,
      maintenance: status.maintenance,
    };
  }

  /** Un latido completo: envía, aplica la respuesta y vacía el outbox. Nunca lanza. */
  async run(): Promise<HeartbeatResponse | undefined> {
    const cloud = this.#o.cloud;
    if (!cloud || this.#running) return undefined;
    this.#running = true;
    try {
      this.intervalSec = this.#o.bundles.value<number>(
        'sync.heartbeatIntervalSec',
        this.intervalSec,
      );
      const response = await cloud.postHeartbeat(this.buildRequest());
      this.lastSyncAt = iso(this.#o.clock());
      await this.apply(response);
      await this.#o.outbox.flush();
      return response;
    } catch {
      return undefined;
    } finally {
      this.#running = false;
    }
  }

  async apply(response: HeartbeatResponse): Promise<void> {
    if (response.heartbeatIntervalSec > 0) this.intervalSec = response.heartbeatIntervalSec;
    if (
      response.bundleVersion !== undefined &&
      response.bundleVersion !== this.#o.bundles.bundle.version
    )
      await this.#o.bundles.refresh();
    if (response.statusOverride !== undefined) this.#o.onStatusOverride(response.statusOverride);
    if (
      response.releaseTarget &&
      response.releaseTarget.version !== this.#release.currentVersion &&
      this.#release.status !== 'downloading' &&
      this.#release.status !== 'installing'
    ) {
      void this.applyRelease({
        version: response.releaseTarget.version,
        rolloutId: response.releaseTarget.rolloutId,
        requiresRestart: response.releaseTarget.requiresRestart,
      });
    }
    const commands = [...response.commands].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
    for (const command of commands) await this.handleCommand(command);
  }

  async handleCommand(command: FleetCommand): Promise<CommandResult> {
    const now = this.#o.clock();
    if (this.#o.store.inboxHas(command.id))
      return { result: 'skipped', message: 'already executed' };
    this.#o.store.inboxReceive(command.id, command, iso(now));
    this.#o.outbox.machineEvent('command_received', `command ${command.type} (${command.id})`, {
      payload: { commandId: command.id, type: command.type },
    });
    let outcome: CommandResult;
    if (command.expiresAt !== undefined && Date.parse(command.expiresAt) < now.getTime())
      outcome = { result: 'expired' };
    else {
      try {
        outcome = await this.#o.execute(command);
      } catch (error) {
        outcome = {
          result: 'failed',
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
    this.#o.store.inboxExecuted(command.id, iso(this.#o.clock()), outcome.result);
    this.#o.outbox.machineEvent('command_executed', `command ${command.type} ${outcome.result}`, {
      payload: { commandId: command.id, result: outcome.result },
    });
    this.#o.outbox.enqueue({
      type: 'command_ack',
      payload: {
        commandId: command.id,
        machineId: this.#o.machineId,
        result: outcome.result,
        ...(outcome.message !== undefined ? { message: outcome.message } : {}),
        at: iso(this.#o.clock()),
      },
    });
    this.#o.bus.emit({ type: 'command', command: command.type });
    return outcome;
  }

  /* ---------- releases simuladas (requisito 19.5) ---------- */

  /** pending → downloading → ready → installing → completed, con retardos cortos; cada paso al outbox. */
  async applyRelease(
    target: { version: string; rolloutId: string; requiresRestart: boolean },
    stepDelayMs = 200,
  ): Promise<MachineReleaseState> {
    this.#setRelease({
      ...this.#release,
      targetVersion: target.version,
      rolloutId: target.rolloutId,
      requiresRestart: target.requiresRestart,
      status: nextReleaseStatus(
        this.#release.status === 'up_to_date' ||
          this.#release.status === 'completed' ||
          this.#release.status === 'failed' ||
          this.#release.status === 'rolled_back' ||
          this.#release.status === 'paused'
          ? this.#release.status
          : 'up_to_date',
        'assign',
      ),
    });
    for (const event of ['download', 'ready', 'install', 'complete'] as const) {
      await new Promise((resolve) => setTimeout(resolve, stepDelayMs));
      const status = nextReleaseStatus(this.#release.status, event);
      const patch: Partial<MachineReleaseState> = { status };
      if (status === 'completed') {
        patch.currentVersion = target.version;
        patch.installedAt = iso(this.#o.clock());
        patch.lastResult = {
          ok: true,
          message: `installed ${target.version} (simulated)`,
          at: iso(this.#o.clock()),
        };
      }
      this.#setRelease({ ...this.#release, ...patch });
    }
    return this.#release;
  }

  rollbackRelease(toVersion: string, rolloutId: string): MachineReleaseState {
    const status =
      this.#release.status === 'completed' ||
      this.#release.status === 'failed' ||
      this.#release.status === 'installing'
        ? nextReleaseStatus(this.#release.status, 'rollback')
        : 'rolled_back';
    this.#setRelease({
      ...this.#release,
      status,
      currentVersion: toVersion,
      rolloutId,
      lastResult: {
        ok: true,
        message: `rolled back to ${toVersion} (simulated)`,
        at: iso(this.#o.clock()),
      },
    });
    return this.#release;
  }

  pauseRelease(): MachineReleaseState {
    if (
      this.#release.status === 'pending' ||
      this.#release.status === 'downloading' ||
      this.#release.status === 'ready'
    ) {
      this.#setRelease({
        ...this.#release,
        status: nextReleaseStatus(this.#release.status, 'pause'),
      });
    }
    return this.#release;
  }

  #setRelease(state: MachineReleaseState): void {
    this.#release = { ...state, updatedAt: iso(this.#o.clock()) };
    this.#o.store.setKv(KV_RELEASE, this.#release, this.#release.updatedAt);
    this.#o.outbox.enqueue({ type: 'release_status', payload: this.#release });
    this.#o.outbox.machineEvent(
      'release_status',
      `release ${this.#release.targetVersion ?? this.#release.currentVersion}: ${this.#release.status}`,
      { payload: { status: this.#release.status } },
    );
  }
}
