/**
 * Outbox idempotente (ADR-004): cada `FleetEvent` recibe id y `sequence` creciente, se persiste y
 * se envía en lotes a `POST /fleet/v1/events`. También registra `MachineEvent` locales.
 */
import type { FleetEvent, MachineEvent, MachineEventType } from '@psp/contracts';
import type { Store } from '../store/store';
import type { Clock, EventBus, IdFactory } from '../support';
import { iso } from '../support';
import type { CloudClient } from './cloud-client';

type EventBaseKeys = 'id' | 'machineId' | 'at' | 'sequence' | 'softwareVersion' | 'bundleVersion';
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type FleetEventInput = DistributiveOmit<FleetEvent, EventBaseKeys>;

export interface OutboxOptions {
  store: Store;
  clock: Clock;
  ids: IdFactory;
  bus: EventBus;
  machineId: string;
  softwareVersion: string;
  bundleVersion: () => string | undefined;
  batchSize: () => number;
  cloud?: CloudClient;
}

export class Outbox {
  readonly #o: OutboxOptions;
  #flushing = false;

  constructor(opts: OutboxOptions) {
    this.#o = opts;
  }

  enqueue(input: FleetEventInput): FleetEvent {
    const now = this.#o.clock();
    const bundleVersion = this.#o.bundleVersion();
    const event = {
      id: this.#o.ids('evt'),
      machineId: this.#o.machineId,
      at: iso(now),
      sequence: this.#o.store.nextSequence(),
      softwareVersion: this.#o.softwareVersion,
      ...(bundleVersion !== undefined ? { bundleVersion } : {}),
      ...input,
    } as FleetEvent;
    this.#o.store.enqueue(event, iso(now));
    return event;
  }

  /** Registra un `MachineEvent`: tabla local, outbox y SSE. */
  machineEvent(
    type: MachineEventType,
    message: string,
    opts: {
      severity?: MachineEvent['severity'];
      payload?: MachineEvent['payload'];
      sessionId?: string;
    } = {},
  ): MachineEvent {
    const event: MachineEvent = {
      id: this.#o.ids('mev'),
      machineId: this.#o.machineId,
      at: iso(this.#o.clock()),
      type,
      severity: opts.severity ?? 'info',
      message,
      ...(opts.payload !== undefined ? { payload: opts.payload } : {}),
      ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}),
    };
    this.#o.store.saveEvent(event);
    this.enqueue({ type: 'machine_event', payload: event });
    this.#o.bus.emit({ type: 'machine_event', event });
    return event;
  }

  summary(): { pending: number; oldestAt?: string } {
    return this.#o.store.outboxSummary();
  }

  /** Envía lotes pendientes hasta vaciar el outbox o fallar. Devuelve `true` si la nube aceptó todo. */
  async flush(): Promise<boolean> {
    const cloud = this.#o.cloud;
    if (!cloud || this.#flushing) return false;
    this.#flushing = true;
    try {
      for (;;) {
        const pending = this.#o.store.pendingOutbox(
          Math.max(1, Math.min(1000, this.#o.batchSize())),
        );
        if (pending.length === 0) return true;
        const response = await cloud.postEvents({
          machineId: this.#o.machineId,
          events: pending.map((row) => row.event),
        });
        const delivered = [
          ...response.accepted,
          ...response.duplicates,
          ...response.rejected.map((rejected) => rejected.id),
        ];
        this.#o.store.markDelivered(delivered, iso(this.#o.clock()));
        if (delivered.length === 0) return false;
      }
    } catch {
      return false;
    } finally {
      this.#flushing = false;
    }
  }
}
