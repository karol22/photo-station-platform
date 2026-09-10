import type { CatalogEntry } from '@psp/contracts';
import { CONFIG_KEYS } from '@psp/contracts';

export const PACKAGE_NAME = '@psp/config-engine';

/** Entradas del catálogo descubrible: el paquete y una entrada por clave de configuración conocida. */
export const CATALOG: CatalogEntry[] = [
  {
    kind: 'package',
    key: PACKAGE_NAME,
    name: 'Motor de configuración heredada',
    description:
      'Resuelve capas por nivel, blueprint y campañas a una configuración efectiva con procedencia, bloqueos y hash; materializa bundles inmutables.',
    package: PACKAGE_NAME,
    status: 'stable',
    docs: 'packages/config-engine/README.md',
  },
  ...CONFIG_KEYS.map((definition): CatalogEntry => ({
    kind: 'configKey',
    key: definition.key,
    name: definition.name.es,
    description: definition.description?.es ?? definition.name.es,
    package: PACKAGE_NAME,
    status: 'stable',
    docs: 'packages/contracts/src/config.ts',
  })),
];
