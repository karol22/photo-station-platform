/**
 * Cuántas personas son y qué experiencias tienen sentido para ese grupo.
 *
 * Es la regla del paso 2 del recorrido y la comparten la pantalla que hace la pregunta y el
 * catálogo que muestra el resultado, para que nunca digan cosas distintas.
 */
import type { KioskBundle } from '@psp/contracts';
import type { BlobVariant } from '@psp/ui';
import type { ProductView } from './products';

export interface GroupOption {
  key: string;
  min: number;
  /** Sin valor significa "y más". */
  max?: number;
  /** Formas que ilustran el grupo, para entenderlo sin leer. */
  blobs: BlobVariant[];
}

export const GROUP_OPTIONS: GroupOption[] = [
  { key: 'solo', min: 1, max: 1, blobs: [1] },
  { key: 'duo', min: 2, max: 2, blobs: [3, 5] },
  { key: 'squad', min: 3, max: 4, blobs: [2, 4, 6] },
  { key: 'crew', min: 5, blobs: [1, 2, 3, 4, 5, 6] },
];

export function optionForSize(size: number | undefined): GroupOption | undefined {
  if (size === undefined) return undefined;
  return GROUP_OPTIONS.find((o) => size >= o.min && (o.max === undefined || size <= o.max));
}

/** Personas que la experiencia del producto espera, cuando la declara. */
export function expectedPeople(bundle: KioskBundle | undefined, view: ProductView): number | undefined {
  const experience = bundle?.experiences.find((e) => e.id === view.product.experienceId);
  return experience?.poses[0]?.guidance?.expectedPeople;
}

/**
 * Un producto encaja con el grupo cuando su experiencia espera esa cantidad de gente. Los productos
 * sin experiencia declarada sirven para cualquier grupo. Los documentales sólo aparecen para una
 * persona: ese recorrido es individual y tiene reglas propias.
 */
export function fitsGroup(view: ProductView, option: GroupOption, expected: number | undefined): boolean {
  if (view.product.kind === 'document') return option.max === 1;
  if (expected === undefined) return true;
  return expected >= option.min && (option.max === undefined || expected <= option.max);
}

export function viewsForGroup(
  bundle: KioskBundle | undefined,
  views: ProductView[],
  option: GroupOption | undefined,
): ProductView[] {
  if (!option) return views;
  return views.filter((view) => fitsGroup(view, option, expectedPeople(bundle, view)));
}
