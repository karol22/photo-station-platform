import type { Timestamp } from '@psp/contracts';

/** Reloj inyectable. La lógica de este paquete nunca llama a `Date.now()` por su cuenta. */
export type Clock = () => Date;

/** Fábrica de identificadores inyectable. Nada de `Math.random()` dentro del paquete. */
export type IdFactory = () => string;

/** Dependencias comunes a todos los adaptadores mock. */
export interface IntegrationDeps {
  clock: Clock;
  idFactory: IdFactory;
}

/** Reloj manual: sólo avanza cuando se le pide. Sirve para pruebas y simulaciones. */
export type ManualClock = Clock & {
  advance(ms: number): Date;
  set(now: Date | string): Date;
  now(): Date;
};

export function manualClock(start: Date | string): ManualClock {
  let current = new Date(start).getTime();
  const clock = (() => new Date(current)) as ManualClock;
  clock.advance = (ms) => {
    current += ms;
    return clock();
  };
  clock.set = (now) => {
    current = new Date(now).getTime();
    return clock();
  };
  clock.now = () => clock();
  return clock;
}

/** Ids secuenciales legibles (`pay_000001`, `pay_000002`, …), deterministas para pruebas. */
export function sequentialIdFactory(prefix: string, start = 1): IdFactory {
  let next = start;
  return () => `${prefix}${String(next++).padStart(6, '0')}`;
}

/** Marca de tiempo ISO 8601 con zona `Z`, como exige `Timestamp` de contracts. */
export function toTimestamp(date: Date): Timestamp {
  return date.toISOString();
}
