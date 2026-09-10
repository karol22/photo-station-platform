import type { Clock, IdFactory, IntegrationDeps } from '../support';
import { toTimestamp } from '../support';
import type { DeliveryChannelKey, DeliveryRequestRecord, DeliveryState } from '../types';
import type { DeliveryChannel, DeliverySendInput } from './port';

export interface DeliveryStubOptions extends IntegrationDeps {
  channel: DeliveryChannelKey;
}

abstract class FixedStateDeliveryChannel implements DeliveryChannel {
  readonly channel: DeliveryChannelKey;
  protected abstract readonly state: DeliveryState;

  readonly #clock: Clock;
  readonly #ids: IdFactory;

  constructor(opts: DeliveryStubOptions) {
    this.channel = opts.channel;
    this.#clock = opts.clock;
    this.#ids = opts.idFactory;
  }

  async send(input: DeliverySendInput): Promise<DeliveryRequestRecord> {
    return {
      id: this.#ids(),
      sessionId: input.sessionId,
      channel: this.channel,
      state: this.state,
      createdAt: toTimestamp(this.#clock()),
    };
  }
}

/** Canal anunciado pero sin proveedor: cada petición nace en `coming_soon`. */
export class ComingSoonDeliveryChannel extends FixedStateDeliveryChannel {
  protected readonly state = 'coming_soon';
}

/** Canal no disponible (sin conexión o feature apagada): cada petición nace en `not_available`. */
export class NotAvailableDeliveryChannel extends FixedStateDeliveryChannel {
  protected readonly state = 'not_available';
}
