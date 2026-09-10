import type {
  ConfigKeyDefinition,
  ConfigLock,
  EffectiveConfig,
  ProvenanceEntry,
} from '@psp/contracts';
import { CONFIG_KEYS } from '@psp/contracts';
import type { RejectedEntry } from './resolve';

export interface ExplainResult {
  value: unknown;
  provenance: ProvenanceEntry;
  lock?: ConfigLock;
  definition?: ConfigKeyDefinition;
  /** false cuando la clave no existe en la configuración efectiva. */
  present: boolean;
  /** Intentos de escribir esta clave que fueron rechazados (para explicar por qué no aplica un override). */
  rejected: RejectedEntry[];
}

const PLATFORM_DEFAULT: ProvenanceEntry = { level: 'platform', isDefault: true };

/**
 * Explica de dónde sale el valor de `key`: valor, procedencia, bloqueo efectivo, definición y
 * escrituras rechazadas. Una clave ausente devuelve `present: false` con `value: undefined`.
 */
export function explainKey(
  effective: EffectiveConfig,
  key: string,
  definitions: ConfigKeyDefinition[] = CONFIG_KEYS,
): ExplainResult {
  const present = Object.prototype.hasOwnProperty.call(effective.values, key);
  const definition = definitions.find((candidate) => candidate.key === key);
  const lock = effective.locks[key];
  const result: ExplainResult = {
    value: present ? effective.values[key] : undefined,
    provenance: effective.provenance[key] ?? PLATFORM_DEFAULT,
    present,
    rejected: effective.rejected.filter((entry) => entry.key === key),
  };
  if (lock !== undefined) result.lock = lock;
  if (definition !== undefined) result.definition = definition;
  return result;
}
