import { CONFIG_KEYS, CatalogEntry } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { CATALOG, PACKAGE_NAME } from '../index';

describe('CATALOG', () => {
  it('registra el paquete y una entrada configKey por cada clave conocida', () => {
    expect(CATALOG.filter((entry) => entry.kind === 'package')).toHaveLength(1);
    const keys = CATALOG.filter((entry) => entry.kind === 'configKey').map((entry) => entry.key);
    expect(keys).toEqual(CONFIG_KEYS.map((definition) => definition.key));
    expect(new Set(CATALOG.map((entry) => `${entry.kind}:${entry.key}`)).size).toBe(CATALOG.length);
  });

  it('cada entrada cumple el contrato y tiene nombre y descripción en español', () => {
    for (const entry of CATALOG) {
      expect(CatalogEntry.safeParse(entry).success, entry.key).toBe(true);
      expect(entry.package).toBe(PACKAGE_NAME);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});
