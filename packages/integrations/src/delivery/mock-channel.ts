import type { Id, Timestamp } from '@psp/contracts';
import type { Clock, IdFactory, IntegrationDeps } from '../support';
import { toTimestamp } from '../support';
import type { DeliveryChannelKey, DeliveryRequestRecord } from '../types';
import { maskDestination, validateDestination, type DestinationFailureReason } from './destination';
import type { DeliveryChannel, DeliverySendInput } from './port';

export type DeliveryFailureReason = DestinationFailureReason | 'missing_image';

/** Registro del contrato más los datos que el mock conserva (sin el destino en claro). */
export interface MockDeliveryRequest extends DeliveryRequestRecord {
  imageRef: string;
  destinationMasked: string;
  updatedAt: Timestamp;
  reason?: DeliveryFailureReason;
}

export interface MockDeliveryChannelOptions extends IntegrationDeps {
  channel: DeliveryChannelKey;
}

/**
 * Canal de entrega simulado: valida el destino, encola (`queued`) y marca `sent_simulated` en `tick()`.
 * Nada sale de la máquina.
 */
export class MockDeliveryChannel implements DeliveryChannel {
  readonly channel: DeliveryChannelKey;

  readonly #clock: Clock;
  readonly #ids: IdFactory;
  readonly #requests = new Map<Id, MockDeliveryRequest>();
  readonly #listeners = new Set<(request: MockDeliveryRequest) => void>();

  constructor(opts: MockDeliveryChannelOptions) {
    this.channel = opts.channel;
    this.#clock = opts.clock;
    this.#ids = opts.idFactory;
  }

  async send(input: DeliverySendInput): Promise<MockDeliveryRequest> {
    const at = toTimestamp(this.#clock());
    const check = validateDestination(this.channel, input.destination);
    const base = {
      id: this.#ids(),
      sessionId: input.sessionId,
      channel: this.channel,
      createdAt: at,
      updatedAt: at,
      imageRef: input.imageRef,
      destinationMasked: maskDestination(input.destination),
    };
    let request: MockDeliveryRequest;
    if (!check.ok) request = { ...base, state: 'failed', reason: check.reason };
    else if (!input.imageRef) request = { ...base, state: 'failed', reason: 'missing_image' };
    else request = { ...base, state: 'queued' };
    this.#requests.set(request.id, request);
    this.#emit(request);
    return request;
  }

  get(id: Id): MockDeliveryRequest | undefined {
    return this.#requests.get(id);
  }

  list(): MockDeliveryRequest[] {
    return [...this.#requests.values()];
  }

  onUpdate(cb: (request: MockDeliveryRequest) => void): () => void {
    this.#listeners.add(cb);
    return () => {
      this.#listeners.delete(cb);
    };
  }

  /** "Envía" todo lo encolado. Devuelve las peticiones que cambian. */
  tick(now: Date = this.#clock()): MockDeliveryRequest[] {
    const changed: MockDeliveryRequest[] = [];
    for (const request of [...this.#requests.values()]) {
      if (request.state !== 'queued') continue;
      const next: MockDeliveryRequest = { ...request, state: 'sent_simulated', updatedAt: toTimestamp(now) };
      this.#requests.set(next.id, next);
      this.#emit(next);
      changed.push(next);
    }
    return changed;
  }

  #emit(request: MockDeliveryRequest): void {
    for (const cb of [...this.#listeners]) cb(request);
  }
}
