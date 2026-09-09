import type { Id } from '@psp/contracts';
import type { DeliveryChannelKey, DeliveryRequestRecord } from '../types';

export interface DeliverySendInput {
  sessionId: Id;
  /** Teléfono (E.164) o correo, según el canal. Nunca se guarda en el registro: sólo enmascarado. */
  destination: string;
  /** Referencia local de la imagen a entregar (ruta o URL del agente). */
  imageRef: string;
}

/** Puerto de entrega digital (requisito 47): WhatsApp, SMS o correo. */
export interface DeliveryChannel {
  readonly channel: DeliveryChannelKey;
  send(input: DeliverySendInput): Promise<DeliveryRequestRecord>;
}

export type DeliveryAdapterKey = 'none' | 'mock' | 'coming_soon';

export const DELIVERY_ADAPTERS: readonly DeliveryAdapterKey[] = ['none', 'mock', 'coming_soon'];
