/**
 * Entrada del catálogo descubrible. La forma es idéntica a `CatalogEntry` de `@psp/contracts`
 * (`registry.ts`); se declara localmente porque `@psp/ui` sólo depende de `react`.
 */
export interface UiCatalogEntry {
  kind: 'package';
  key: string;
  name: string;
  description: string;
  package: string;
  status: 'stable' | 'mock' | 'stub' | 'planned';
  docs?: string;
}

/** Capacidades registrables de este paquete: sólo la entrada `package`. */
export const CATALOG: UiCatalogEntry[] = [
  {
    kind: 'package',
    key: 'ui',
    name: '@psp/ui',
    description:
      'Design system compartido: tokens CSS, tema por branding, componentes táctiles de kiosco y componentes densos de administración.',
    package: '@psp/ui',
    status: 'stable',
    docs: 'packages/ui/README.md',
  },
];
