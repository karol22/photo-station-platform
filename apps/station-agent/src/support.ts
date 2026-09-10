/**
 * Apoyo transversal: reloj e ids inyectables, errores con código HTTP y bus de eventos SSE.
 * Nada aquí lee `Date.now()` ni genera aleatoriedad por su cuenta salvo en las fábricas reales.
 */
import { randomBytes } from 'node:crypto';
import type { StationEvent } from '@psp/contracts';
import { makeId } from '@psp/domain';

export type Clock = () => Date;
export type IdFactory = (prefix: string) => string;

export const realClock: Clock = () => new Date();
export const realIdFactory: IdFactory = (prefix) =>
  makeId(prefix, () => randomBytes(12).toString('hex'));

/** Reloj manual para pruebas: avanza sólo cuando se le pide. */
export interface ManualClock extends Clock {
  advance(ms: number): Date;
  set(now: Date | string): Date;
}

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
  return clock;
}

/** Ids secuenciales por prefijo (`ses_000001`), deterministas para pruebas. */
export function sequentialIdFactory(start = 1): IdFactory {
  const counters = new Map<string, number>();
  return (prefix) => {
    const next = (counters.get(prefix) ?? start - 1) + 1;
    counters.set(prefix, next);
    return `${prefix}_${String(next).padStart(6, '0')}`;
  };
}

export const iso = (date: Date): string => date.toISOString();

/** Error con código HTTP y `ApiError.code`; el servidor lo serializa tal cual. */
export class AgentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export const notFound = (what: string, id: string): AgentError =>
  new AgentError(404, 'not_found', `${what} not found: ${id}`);
export const conflict = (code: string, message: string): AgentError =>
  new AgentError(409, code, message);
export const badRequest = (code: string, message: string, details?: unknown): AgentError =>
  new AgentError(400, code, message, details);

type Listener = (event: StationEvent) => void;

/** Bus de eventos hacia el kiosco. Cada suscriptor SSE recibe todos los eventos posteriores a su alta. */
export class EventBus {
  readonly #listeners = new Set<Listener>();

  emit(event: StationEvent): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener(event);
      } catch {
        // Un suscriptor roto no detiene al resto.
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  get size(): number {
    return this.#listeners.size;
  }
}

/** Decodifica base64 crudo o data URL a bytes; devuelve además el MIME declarado. */
export function decodeImage(input: string): { bytes: Buffer; mime: string; ext: string } {
  let mime = 'image/png';
  let payload = input.trim();
  const match = /^data:([\w/+.-]+);base64,(.*)$/s.exec(payload);
  if (match) {
    mime = match[1] ?? mime;
    payload = match[2] ?? '';
  }
  const bytes = Buffer.from(payload, 'base64');
  if (bytes.length === 0) throw badRequest('invalid_image', 'image payload is empty or not base64');
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (isPng) mime = 'image/png';
  else if (isJpeg) mime = 'image/jpeg';
  else if (mime !== 'image/png' && mime !== 'image/jpeg')
    throw badRequest('invalid_image', 'only PNG or JPEG images are accepted');
  return { bytes, mime, ext: mime === 'image/jpeg' ? 'jpg' : 'png' };
}
