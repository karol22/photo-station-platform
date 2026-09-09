import type { CatalogEntry } from '@psp/contracts';

export const PACKAGE_NAME = '@psp/bundler';

export const CATALOG: CatalogEntry[] = [
  {
    kind: 'package',
    key: PACKAGE_NAME,
    name: 'Materializador de bundles',
    description:
      'Construye el ConfigBundle inmutable de una máquina: cadena de alcance, capas y campañas, configuración efectiva, features, catálogo con precios, presets, plantillas y manifiesto de activos.',
    package: PACKAGE_NAME,
    status: 'stable',
    docs: 'packages/bundler/README.md',
  },
];
