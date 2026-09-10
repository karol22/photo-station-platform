import { ValidationError } from '../errors';
import type { IntegrationDeps } from '../support';
import type { DeliveryChannelKey } from '../types';
import { MockDeliveryChannel } from './mock-channel';
import type { DeliveryAdapterKey, DeliveryChannel } from './port';
import { ComingSoonDeliveryChannel, NotAvailableDeliveryChannel } from './stubs';

export function createDeliveryChannel(
  adapter: DeliveryAdapterKey,
  channel: DeliveryChannelKey,
  deps: IntegrationDeps,
): DeliveryChannel {
  const opts = { channel, clock: deps.clock, idFactory: deps.idFactory };
  switch (adapter) {
    case 'mock':
      return new MockDeliveryChannel(opts);
    case 'coming_soon':
      return new ComingSoonDeliveryChannel(opts);
    case 'none':
      return new NotAvailableDeliveryChannel(opts);
    default:
      throw new ValidationError(`Unknown delivery adapter: ${String(adapter)}`);
  }
}
