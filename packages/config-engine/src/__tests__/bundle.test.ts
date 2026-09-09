import { ConfigBundle } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { buildBundle, bundleDiff, resolveEffectiveConfig } from '../index';
import {
  NOW,
  TZ,
  bundleInput,
  campaign,
  chain,
  feature,
  layer,
  presetVersion,
  product,
  template,
} from './helpers';

const effective = () => resolveEffectiveConfig({ layers: chain(), now: NOW, timezone: TZ });

describe('buildBundle', () => {
  it('produce un bundle válido según contratos con contractsVersion v1', () => {
    const bundle = buildBundle(bundleInput(effective()));
    expect(bundle.contractsVersion).toBe('v1');
    expect(bundle.version).toMatch(/^[0-9a-f]{64}$/);
    const parsed = ConfigBundle.safeParse(bundle);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it('es determinista salvo generatedAt', () => {
    const a = buildBundle(bundleInput(effective(), { generatedAt: '2026-09-09T12:00:00Z' }));
    const b = buildBundle(bundleInput(effective(), { generatedAt: '2026-09-10T08:30:00Z' }));
    expect(a.version).toBe(b.version);
    expect(a.generatedAt).not.toBe(b.generatedAt);
  });

  it('cambia de versión cuando cambia cualquier contenido', () => {
    const base = buildBundle(bundleInput(effective()));
    const otherConfig = resolveEffectiveConfig({
      layers: [...chain(), layer('machine', { 'kiosk.volume': 10 }, { id: 'cfg_extra' })],
      now: NOW,
      timezone: TZ,
    });
    expect(buildBundle(bundleInput(otherConfig)).version).not.toBe(base.version);
    expect(buildBundle(bundleInput(effective(), { products: [] })).version).not.toBe(base.version);
    expect(buildBundle(bundleInput(effective(), { machineId: 'mch_2' })).version).not.toBe(
      base.version,
    );
  });
});

describe('bundleDiff', () => {
  it('no reporta cambios entre bundles iguales', () => {
    const a = buildBundle(bundleInput(effective()));
    const b = buildBundle(bundleInput(effective(), { generatedAt: '2026-09-10T08:30:00Z' }));
    expect(bundleDiff(a, b)).toEqual({
      configKeys: [],
      productsAdded: [],
      productsRemoved: [],
      pricesChanged: [],
      campaignsChanged: [],
      featuresChanged: [],
      templatesChanged: [],
      presetsChanged: [],
      experiencesChanged: [],
      assetsChanged: [],
    });
  });

  it('detecta cambios de configuración, productos, precios, campañas, features, plantillas, presets y activos', () => {
    const a = buildBundle(bundleInput(effective()));
    const changedConfig = resolveEffectiveConfig({
      layers: [...chain(), layer('machine', { 'kiosk.volume': 10 }, { id: 'cfg_extra' })],
      now: NOW,
      timezone: TZ,
    });
    const b = buildBundle(
      bundleInput(changedConfig, {
        products: [product('prd_2', 20000), product('prd_3', 5000)],
        prices: [
          {
            productId: 'prd_2',
            list: { amount: 20000, currency: 'MXN' },
            final: { amount: 18000, currency: 'MXN' },
            appliedPromotionIds: ['pro_1'],
            provenance: { level: 'organization', id: 'org_1' },
          },
        ],
        campaigns: [campaign('cmp_1', { priority: 3 }), campaign('cmp_2')],
        features: [feature('documents.mode', 'locked'), feature('campaigns')],
        templates: [template('tpl_1', 2)],
        presets: a.presets,
        presetVersions: [presetVersion('pst_1', 1), presetVersion('pst_1', 2)],
        assets: [
          {
            assetId: 'ast_1',
            hash: 'b'.repeat(64),
            mime: 'image/png',
            bytes: 12,
            url: '/assets/ast_1',
          },
        ],
      }),
    );
    expect(bundleDiff(a, b)).toEqual({
      configKeys: ['kiosk.volume'],
      productsAdded: ['prd_2', 'prd_3'],
      productsRemoved: ['prd_1'],
      pricesChanged: [],
      campaignsChanged: ['cmp_1', 'cmp_2'],
      featuresChanged: ['campaigns', 'documents.mode'],
      templatesChanged: ['tpl_1'],
      presetsChanged: ['pst_1'],
      experiencesChanged: [],
      assetsChanged: ['ast_1'],
    });
  });

  it('reporta precios cambiados sólo para productos presentes en ambos bundles', () => {
    const a = buildBundle(bundleInput(effective()));
    const b = buildBundle(
      bundleInput(effective(), {
        prices: [
          {
            productId: 'prd_1',
            list: { amount: 15000, currency: 'MXN' },
            final: { amount: 12000, currency: 'MXN' },
            appliedPromotionIds: ['pro_1'],
            provenance: { level: 'organization', id: 'org_1' },
          },
        ],
      }),
    );
    expect(bundleDiff(a, b).pricesChanged).toEqual(['prd_1']);
    expect(bundleDiff(a, b).productsAdded).toEqual([]);
  });

  it('un bloqueo nuevo cuenta como cambio de clave aunque el valor no cambie', () => {
    const a = buildBundle(bundleInput(effective()));
    const locked = resolveEffectiveConfig({
      layers: [
        ...chain(),
        layer(
          'organization',
          {},
          {
            id: 'cfg_lock',
            locks: [{ key: 'branding.publicName', policy: 'mandatory', setBy: 'organization' }],
          },
        ),
      ],
      now: NOW,
      timezone: TZ,
    });
    const b = buildBundle(bundleInput(locked));
    expect(bundleDiff(a, b).configKeys).toEqual(['branding.publicName']);
  });
});
