import { describe, expect, it } from 'vitest';
import { definitionViolation, resolveEffectiveConfig, validateLayer } from '../index';
import { NOW, TZ, chain, layer, lock } from './helpers';

describe('validateLayer', () => {
  it('acepta una capa consistente', () => {
    const result = validateLayer(
      layer('machine', { 'kiosk.screenBrightness': 55, 'custom.theme': 'dark' }),
      chain().slice(0, 5),
    );
    expect(result).toEqual({ ok: true, violations: [] });
  });

  it('reporta editableAt, bloqueos de los padres y rangos', () => {
    const parents = [
      layer(
        'organization',
        {},
        {
          locks: [
            lock('branding.palette.primary', 'mandatory', 'organization'),
            lock('timing.idleTimeoutSec', 'range', 'organization', { min: 30, max: 60 }),
          ],
        },
      ),
    ];
    const result = validateLayer(
      layer('franchise', {
        'branding.palette.primary': '#FF0000',
        'timing.idleTimeoutSec': 120,
        'kiosk.volume': 10,
      }),
      parents,
    );
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { key: 'branding.palette.primary', reason: 'locked_by_organization' },
      { key: 'kiosk.volume', reason: 'not_editable_at_level' },
      { key: 'timing.idleTimeoutSec', reason: 'out_of_range' },
    ]);
  });

  it('valida contra la definición: tipo, enumerado y min/max', () => {
    const result = validateLayer(
      layer('machine', {
        'kiosk.screenBrightness': 500,
        'kiosk.orientation': 'diagonal',
        'kiosk.volume': 'alto',
        'kiosk.locales': ['es', 3],
      }),
      [],
    );
    expect(result.violations).toEqual([
      { key: 'kiosk.locales', reason: 'invalid_type' },
      { key: 'kiosk.orientation', reason: 'not_in_enum' },
      { key: 'kiosk.screenBrightness', reason: 'out_of_definition_range' },
      { key: 'kiosk.volume', reason: 'invalid_type' },
    ]);
    expect(
      definitionViolation(null, {
        key: 'x',
        type: 'asset',
        group: 'branding',
        name: { es: 'x' },
        default: null,
        editableAt: ['machine'],
        sensitive: false,
      }),
    ).toBeUndefined();
  });

  it('reporta bloqueos propios sin efecto o mal formados', () => {
    const parents = [
      layer(
        'organization',
        {},
        { locks: [lock('timing.idleTimeoutSec', 'range', 'organization', { min: 30, max: 60 })] },
      ),
    ];
    const result = validateLayer(
      layer(
        'franchise',
        {},
        {
          locks: [
            lock('timing.idleTimeoutSec', 'editable', 'franchise'),
            lock('timing.idleTimeoutSec', 'range', 'franchise', { min: 35, max: 55 }),
            lock('printing.defaultCopies', 'range', 'franchise'),
            lock('kiosk.volume', 'range', 'franchise', { min: 50, max: 10 }),
          ],
        },
      ),
      parents,
    );
    expect(result.violations).toEqual([
      { key: 'timing.idleTimeoutSec', reason: 'lock_ignored' },
      { key: 'printing.defaultCopies', reason: 'invalid_lock' },
      { key: 'kiosk.volume', reason: 'invalid_lock' },
    ]);
  });

  it('ignora padres de nivel igual o inferior', () => {
    const result = validateLayer(layer('franchise', { 'branding.publicName': 'x' }), [
      layer('franchise', {}, { locks: [lock('branding.publicName', 'mandatory', 'franchise')] }),
      layer('machine', {}, { locks: [lock('branding.publicName', 'mandatory', 'machine')] }),
    ]);
    expect(result.ok).toBe(true);
  });

  it('coincide con lo que rechaza el resolve para la misma capa', () => {
    const parents = [
      layer(
        'organization',
        {},
        { locks: [lock('branding.palette.primary', 'mandatory', 'organization')] },
      ),
      layer(
        'location',
        {},
        { locks: [lock('timing.idleTimeoutSec', 'range', 'location', { min: 30, max: 60 })] },
      ),
    ];
    const machine = layer('machine', {
      'branding.palette.primary': '#FF0000',
      'timing.idleTimeoutSec': 10,
      'kiosk.volume': 30,
      'sync.eventBatchSize': 5,
    });
    const validation = validateLayer(machine, parents);
    const effective = resolveEffectiveConfig({
      layers: [...parents, machine],
      now: NOW,
      timezone: TZ,
    });
    const fromResolve = effective.rejected
      .filter((r) => r.level === 'machine')
      .map(({ key, reason }) => ({ key, reason }));
    expect(validation.violations).toEqual(fromResolve);
  });
});
