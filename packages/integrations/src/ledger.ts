import type { Money, Timestamp } from '@psp/contracts';
import { Id as IdSchema, Money as MoneySchema, Timestamp as TimestampSchema } from '@psp/contracts';
import { ValidationError } from './errors';

/** Una línea de `ops/ledger/paid-calls.jsonl` (formato en `ops/ledger/README.md`). */
export interface PaidCallEntry {
  id: string;
  ts: Timestamp;
  /** `categoría:adaptador`, por ejemplo `ai:mock`. */
  provider: string;
  operation: string;
  /** `sha256:<hex>` del insumo; cambiar el insumo regenera. */
  inputHash: string;
  outputRef?: string;
  cost: Money;
  /** Repetir la misma clave no cobra ni llama. */
  idempotencyKey: string;
  trace?: string;
}

/** Orden fijo de campos en cada línea, igual al README del libro mayor. */
export const PAID_CALL_FIELDS = [
  'id',
  'ts',
  'provider',
  'operation',
  'inputHash',
  'outputRef',
  'cost',
  'idempotencyKey',
  'trace',
] as const;

/** Convención `sessionId:operation:inputHash`. */
export function paidCallIdempotencyKey(sessionId: string, operation: string, inputHash: string): string {
  return `${sessionId}:${operation}:${inputHash}`;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) throw new ValidationError(`paid call '${key}' must be a non-empty string`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ValidationError(`paid call '${key}' must be a string`);
  return value;
}

/** Valida la forma de una entrada; lanza `ValidationError` si falta algo o el tipo no coincide. */
export function validatePaidCallEntry(entry: unknown): PaidCallEntry {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new ValidationError('paid call entry must be an object');
  }
  const record = entry as Record<string, unknown>;
  const id = requireString(record, 'id');
  if (!IdSchema.safeParse(id).success) throw new ValidationError("paid call 'id' is invalid");
  const ts = requireString(record, 'ts');
  if (!TimestampSchema.safeParse(ts).success) throw new ValidationError("paid call 'ts' must be an ISO 8601 timestamp with zone");
  const cost = MoneySchema.safeParse(record['cost']);
  if (!cost.success) throw new ValidationError("paid call 'cost' must be Money in minor units");
  const result: PaidCallEntry = {
    id,
    ts,
    provider: requireString(record, 'provider'),
    operation: requireString(record, 'operation'),
    inputHash: requireString(record, 'inputHash'),
    cost: cost.data,
    idempotencyKey: requireString(record, 'idempotencyKey'),
  };
  const outputRef = optionalString(record, 'outputRef');
  if (outputRef !== undefined) result.outputRef = outputRef;
  const trace = optionalString(record, 'trace');
  if (trace !== undefined) result.trace = trace;
  return result;
}

/** Serializa una entrada como línea JSON (sin salto de línea) con el orden de campos del README. */
export function formatPaidCallLine(entry: PaidCallEntry): string {
  const ordered: Record<string, unknown> = {};
  for (const field of PAID_CALL_FIELDS) {
    const value = entry[field];
    if (value !== undefined) ordered[field] = value;
  }
  return JSON.stringify(ordered);
}

/** Parsea una línea; `undefined` para líneas en blanco. Lanza `ValidationError` si está malformada. */
export function parsePaidCallLine(line: string): PaidCallEntry | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new ValidationError('malformed ledger line: not valid JSON');
  }
  return validatePaidCallEntry(raw);
}

/**
 * Escritor del libro mayor. `write` recibe cada línea sin salto final; quien persiste agrega `\n`.
 * `existing` son las líneas ya presentes en el archivo: sus claves de idempotencia cuentan como registradas.
 */
export class PaidCallLedger {
  readonly #write: (line: string) => void;
  readonly #keys = new Set<string>();

  constructor(write: (line: string) => void, existing: string[] = []) {
    this.#write = write;
    existing.forEach((line, index) => {
      let entry: PaidCallEntry | undefined;
      try {
        entry = parsePaidCallLine(line);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new ValidationError(`ledger line ${index + 1}: ${detail}`);
      }
      if (entry) this.#keys.add(entry.idempotencyKey);
    });
  }

  /** Escribe la entrada y devuelve `true`; `false` (sin escribir) si la clave de idempotencia ya existe. */
  record(entry: PaidCallEntry): boolean {
    const valid = validatePaidCallEntry(entry);
    if (this.#keys.has(valid.idempotencyKey)) return false;
    this.#write(formatPaidCallLine(valid));
    this.#keys.add(valid.idempotencyKey);
    return true;
  }

  has(idempotencyKey: string): boolean {
    return this.#keys.has(idempotencyKey);
  }

  get size(): number {
    return this.#keys.size;
  }
}
