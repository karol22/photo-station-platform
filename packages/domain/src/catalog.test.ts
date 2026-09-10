import { CatalogEntry, FEATURE_DEFINITIONS, PermissionKey } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';

describe('CATALOG', () => {
  it('registra el paquete, cada permiso y cada feature con entradas válidas', () => {
    for (const entry of CATALOG) expect(CatalogEntry.safeParse(entry).success, entry.key).toBe(true);
    expect(CATALOG.filter((e) => e.kind === 'package').map((e) => e.key)).toEqual(['@psp/domain']);
    const permissions = CATALOG.filter((e) => e.kind === 'permission').map((e) => e.key);
    expect(permissions).toEqual([...PermissionKey.options]);
    const features = CATALOG.filter((e) => e.kind === 'feature').map((e) => e.key);
    expect(features).toEqual(FEATURE_DEFINITIONS.map((f) => f.key));
    const keys = CATALOG.map((e) => `${e.kind}:${e.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(CATALOG.find((e) => e.key === 'ai.experiences')?.status).toBe('planned');
    for (const entry of CATALOG) expect(entry.description.length).toBeGreaterThan(3);
  });
});
