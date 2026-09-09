import type { CatalogEntry } from '@psp/contracts';
import { ALL_GATES } from './gates';

export { ALL_GATES } from './gates';
export type { Gate, GateContext, GateMode, GateResult } from './types';

/** Entradas de catálogo de las compuertas (las agrega el CLI; evita el ciclo catalog ↔ gates). */
export const GATE_CATALOG: CatalogEntry[] = ALL_GATES.map((g) => ({
  kind: 'gate',
  key: g.key,
  name: g.name,
  description: g.description,
  package: '@psp/gates',
  status: 'stable',
  docs: 'AGENTS.md#3',
}));
