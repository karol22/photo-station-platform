import { describe, expect, it } from 'vitest';
import { CapabilityKey, FeatureKey, PermissionKey, CONFIG_KEYS } from '@psp/contracts';
import { contractsCatalog, dedupe, fullCatalog } from './index';

describe('catálogo', () => {
  it('deriva de los contratos todas las features, capacidades, permisos y claves', () => {
    const c = contractsCatalog();
    const has = (kind: string, key: string) => c.some((e) => e.kind === kind && e.key === key);
    for (const k of FeatureKey.options) expect(has('feature', k)).toBe(true);
    for (const k of CapabilityKey.options) expect(has('capability', k)).toBe(true);
    for (const k of PermissionKey.options) expect(has('permission', k)).toBe(true);
    for (const k of CONFIG_KEYS) expect(has('configKey', k.key)).toBe(true);
  });

  it('deduplica por kind y key conservando la primera', () => {
    const out = dedupe([
      { kind: 'feature', key: 'x', name: 'primera', description: '', package: 'a', status: 'stable' },
      { kind: 'feature', key: 'x', name: 'segunda', description: '', package: 'b', status: 'stable' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('primera');
  });

  it('fullCatalog no falla aunque falte algún paquete', async () => {
    const all = await fullCatalog();
    expect(all.length).toBeGreaterThan(50);
    expect(all.some((e) => e.kind === 'app' && e.key === '@psp/kiosk')).toBe(true);
  });
});
