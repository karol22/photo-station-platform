import type { ConfigLevel, ScopeLevel } from '@psp/contracts';

/** Orden de aplicación de capas: cada nivel sobreescribe al anterior. */
export const LEVEL_ORDER: readonly ConfigLevel[] = [
  'platform',
  'organization',
  'blueprint',
  'franchise',
  'region',
  'location',
  'machine',
  'campaign',
];

const RANK: Record<ConfigLevel, number> = {
  platform: 0,
  organization: 1,
  blueprint: 2,
  franchise: 3,
  region: 4,
  location: 5,
  machine: 6,
  campaign: 7,
};

/** Rango de un nivel: menor = más arriba en la jerarquía (platform 0 … campaign 7). */
export function layerRank(level: ConfigLevel): number {
  return RANK[level];
}

/** Orden natural de dos niveles (negativo cuando `a` está por encima de `b`). */
export function compareLevels(a: ConfigLevel, b: ConfigLevel): number {
  return RANK[a] - RANK[b];
}

/**
 * Nivel de alcance equivalente para el chequeo de `editableAt`: el blueprint escribe con los
 * permisos de la organización y una campaña con los de la ubicación.
 */
export function scopeLevelFor(level: ConfigLevel): ScopeLevel {
  switch (level) {
    case 'blueprint':
      return 'organization';
    case 'campaign':
      return 'location';
    default:
      return level;
  }
}
