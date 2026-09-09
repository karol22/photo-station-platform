import { z } from 'zod';

/** Entrada del catálogo descubrible (`pnpm catalog`). Lo no registrado no existe. */
export const CatalogEntryKind = z.enum([
  'app',
  'package',
  'feature',
  'adapter',
  'port',
  'capability',
  'permission',
  'configKey',
  'command',
  'gate',
  'protocol',
  'editingOp',
  'visionCriterion',
]);
export type CatalogEntryKind = z.infer<typeof CatalogEntryKind>;

export const CatalogEntry = z.object({
  kind: CatalogEntryKind,
  key: z.string(),
  name: z.string(),
  description: z.string(),
  package: z.string(),
  status: z.enum(['stable', 'mock', 'stub', 'planned']).default('stable'),
  docs: z.string().optional(),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;
