import type { Id, JsonValue, Timestamp } from '@psp/contracts';

/** Evento de negocio hacia un CRM externo (requisito 47). Nunca lleva fotografías ni datos sensibles. */
export interface CrmEvent {
  type: string;
  at: Timestamp;
  sessionId?: Id;
  machineId?: Id;
  organizationId?: Id;
  franchiseId?: Id;
  properties?: Record<string, JsonValue>;
  /** Repetir la misma clave no duplica el evento. */
  idempotencyKey?: string;
}

export interface CrmProvider {
  readonly provider: string;
  track(event: CrmEvent): Promise<void>;
}
