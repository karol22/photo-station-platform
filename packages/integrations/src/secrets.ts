/**
 * Secretos (docs/operacion/secretos.md). Hoy no hay proveedores reales ni secretos reales;
 * el mecanismo existe para que el primero no se improvise.
 */

/** Ruta del archivo local de secretos (ignorado por git). El agente lo lee y pasa su contenido a `resolveSecret`. */
export const SECRETS_FILE = 'var/secrets.json';

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/**
 * Referencia a un secreto. Ninguna conversión implícita revela el valor: `String()`, plantillas,
 * `JSON.stringify`, `console.log` y `util.inspect` muestran `[secreto:name]`. Sólo `reveal()` lo devuelve.
 */
export class SecretHandle {
  readonly name: string;
  readonly #value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.#value = value;
  }

  /** Único acceso al valor; se usa en el punto de consumo y nunca se registra. */
  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return `[secreto:${this.name}]`;
  }

  toJSON(): string {
    return this.toString();
  }

  [Symbol.toPrimitive](): string {
    return this.toString();
  }

  [INSPECT](): string {
    return this.toString();
  }

  get [Symbol.toStringTag](): string {
    return 'SecretHandle';
  }
}

export interface SecretSources {
  /** Por defecto `process.env` cuando existe `process`. */
  env?: Record<string, string | undefined>;
  /** Contenido ya parseado de `var/secrets.json`. */
  file?: Record<string, string>;
}

function defaultEnv(): Record<string, string | undefined> | undefined {
  return typeof process !== 'undefined' && process.env ? process.env : undefined;
}

/** Busca primero en el entorno y luego en el archivo. Devuelve `undefined` si no hay valor (o está vacío). */
export function resolveSecret(name: string, sources: SecretSources = {}): SecretHandle | undefined {
  const env = sources.env ?? defaultEnv();
  const fromEnv = env?.[name];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return new SecretHandle(name, fromEnv);
  const fromFile = sources.file?.[name];
  if (typeof fromFile === 'string' && fromFile.length > 0) return new SecretHandle(name, fromFile);
  return undefined;
}

/** Parsea el texto de `var/secrets.json`: un objeto plano de cadenas. Lanza si la forma no es esa. */
export function parseSecretsFile(text: string): Record<string, string> {
  const raw: unknown = JSON.parse(text);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('secrets file must contain a flat JSON object');
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') throw new TypeError(`secret '${key}' must be a string`);
    result[key] = value;
  }
  return result;
}
