import { describe, expect, it } from 'vitest';
import { configList, configNumber, resolveAssetUrl } from './assets';

const bundle = {
  assetBaseUrl: 'http://localhost:4100/station/v1/assets/',
  assets: [{ assetId: 'ast_logo', hash: 'abc123', mime: 'image/svg+xml', bytes: 10, url: 'ignored' }],
};

describe('resolución de activos', () => {
  it('construye assetBaseUrl/hash a partir del assetId', () => {
    expect(resolveAssetUrl(bundle, 'ast_logo')).toBe('http://localhost:4100/station/v1/assets/abc123');
  });
  it('devuelve undefined si el activo no está en el manifiesto o no hay bundle', () => {
    expect(resolveAssetUrl(bundle, 'ast_missing')).toBeUndefined();
    expect(resolveAssetUrl(undefined, 'ast_logo')).toBeUndefined();
    expect(resolveAssetUrl(bundle, null)).toBeUndefined();
  });
  it('lee valores efectivos con tipo y respaldo', () => {
    const b = { effective: { values: { 'kiosk.attractRotationSec': 5, 'branding.attractImageAssetIds': ['a', 1, 'b'] } } };
    expect(configNumber(b, 'kiosk.attractRotationSec', 8)).toBe(5);
    expect(configNumber(b, 'timing.idleTimeoutSec', 60)).toBe(60);
    expect(configList(b, 'branding.attractImageAssetIds')).toEqual(['a', 'b']);
  });
});
