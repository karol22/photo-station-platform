import { ValidationError } from '../errors';
import type { CrmEvent, CrmProvider } from './port';

/** Acumula eventos en memoria; ideal para pruebas y para el panel técnico. */
export class MockCrmProvider implements CrmProvider {
  readonly provider = 'mock';
  readonly events: CrmEvent[] = [];

  readonly #keys = new Set<string>();

  async track(event: CrmEvent): Promise<void> {
    if (!event.type) throw new ValidationError('event.type is required');
    if (event.idempotencyKey !== undefined) {
      if (this.#keys.has(event.idempotencyKey)) return;
      this.#keys.add(event.idempotencyKey);
    }
    this.events.push({ ...event });
  }

  clear(): void {
    this.events.length = 0;
    this.#keys.clear();
  }
}
