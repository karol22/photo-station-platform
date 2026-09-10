import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, compareLevels, layerRank, scopeLevelFor } from '../index';

describe('layerRank', () => {
  it('ordena platform < organization < blueprint < franchise < region < location < machine < campaign', () => {
    expect(LEVEL_ORDER.map(layerRank)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(layerRank('blueprint')).toBeGreaterThan(layerRank('organization'));
    expect(layerRank('blueprint')).toBeLessThan(layerRank('franchise'));
    expect(compareLevels('machine', 'campaign')).toBeLessThan(0);
    expect(compareLevels('location', 'location')).toBe(0);
  });

  it('mapea blueprint a organización y campaña a ubicación para editableAt', () => {
    expect(scopeLevelFor('blueprint')).toBe('organization');
    expect(scopeLevelFor('campaign')).toBe('location');
    expect(scopeLevelFor('machine')).toBe('machine');
  });
});
