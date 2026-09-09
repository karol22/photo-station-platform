import { CONFIG_KEYS, CONFIG_KEY_INDEX, EffectiveConfig } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { explainKey, isCampaignActive, orderCampaigns, resolveEffectiveConfig } from '../index';
import { NOW, TZ, chain, layer, lock, overlay } from './helpers';

const resolve = (
  layers = chain(),
  extra: Partial<Parameters<typeof resolveEffectiveConfig>[0]> = {},
) => resolveEffectiveConfig({ layers, now: NOW, timezone: TZ, ...extra });

describe('herencia', () => {
  it('resuelve seis niveles con la procedencia correcta por clave', () => {
    const effective = resolve();
    expect(EffectiveConfig.safeParse(effective).success).toBe(true);
    expect(effective.values['timing.idleTimeoutSec']).toBe(90);
    expect(effective.provenance['timing.idleTimeoutSec']).toEqual({
      level: 'platform',
      layerId: 'cfg_platform_root',
      isDefault: false,
    });
    expect(effective.provenance['branding.publicName']).toMatchObject({
      level: 'organization',
      entityId: 'org_1',
    });
    expect(effective.provenance['branding.palette.accent']).toMatchObject({
      level: 'franchise',
      entityId: 'fr_1',
    });
    expect(effective.provenance['kiosk.defaultLocale']).toMatchObject({
      level: 'region',
      entityId: 'reg_1',
    });
    expect(effective.provenance['printing.defaultCopies']).toMatchObject({
      level: 'location',
      entityId: 'loc_1',
    });
    expect(effective.provenance['kiosk.screenBrightness']).toMatchObject({
      level: 'machine',
      entityId: 'mch_1',
    });
    expect(effective.values['kiosk.volume']).toBe(CONFIG_KEY_INDEX['kiosk.volume']?.default);
    expect(effective.provenance['kiosk.volume']).toEqual({ level: 'platform', isDefault: true });
    expect(effective.rejected).toEqual([]);
    expect(effective.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('incluye todos los defaults del registro y devuelve las claves ordenadas', () => {
    const effective = resolve([]);
    expect(Object.keys(effective.values)).toEqual(CONFIG_KEYS.map((k) => k.key).sort());
    for (const definition of CONFIG_KEYS) {
      expect(effective.values[definition.key]).toEqual(definition.default);
      expect(effective.provenance[definition.key]?.isDefault).toBe(true);
    }
  });

  it('un override de máquina y luego su retiro vuelve al valor heredado', () => {
    const base = chain();
    const withOverride = resolve([
      ...base.slice(0, 5),
      layer('machine', { 'printing.defaultCopies': 3 }),
    ]);
    expect(withOverride.values['printing.defaultCopies']).toBe(3);
    expect(withOverride.provenance['printing.defaultCopies']?.level).toBe('machine');

    const withoutOverride = resolve([...base.slice(0, 5), layer('machine', {})]);
    expect(withoutOverride.values['printing.defaultCopies']).toBe(2);
    expect(withoutOverride.provenance['printing.defaultCopies']).toMatchObject({
      level: 'location',
      entityId: 'loc_1',
    });
    expect(withoutOverride.hash).not.toBe(withOverride.hash);
  });

  it('a igual nivel, la última capa gana', () => {
    const effective = resolve([
      layer('location', { 'printing.defaultCopies': 2 }, { id: 'cfg_a' }),
      layer('location', { 'printing.defaultCopies': 4 }, { id: 'cfg_b' }),
    ]);
    expect(effective.values['printing.defaultCopies']).toBe(4);
    expect(effective.provenance['printing.defaultCopies']?.layerId).toBe('cfg_b');
  });

  it('acepta claves sin definición con procedencia normal', () => {
    const effective = resolve([layer('machine', { 'custom.kioskTheme': 'dark' })]);
    expect(effective.values['custom.kioskTheme']).toBe('dark');
    expect(effective.provenance['custom.kioskTheme']).toMatchObject({
      level: 'machine',
      entityId: 'mch_1',
    });
  });

  it('el blueprint se aplica entre organización y franquicia con permisos de organización', () => {
    const effective = resolve(
      [
        layer('organization', { 'timing.reviewTimeoutSec': 100, 'timing.captureCountdownSec': 4 }),
        layer('franchise', { 'timing.reviewTimeoutSec': 150 }),
      ],
      {
        blueprint: layer('blueprint', {
          'timing.reviewTimeoutSec': 120,
          'timing.captureCountdownSec': 5,
          'kiosk.screenBrightness': 30,
        }),
      },
    );
    expect(effective.values['timing.reviewTimeoutSec']).toBe(150);
    expect(effective.values['timing.captureCountdownSec']).toBe(5);
    expect(effective.provenance['timing.captureCountdownSec']).toMatchObject({
      level: 'blueprint',
      entityId: 'bp_1',
    });
    expect(effective.rejected).toEqual([
      {
        key: 'kiosk.screenBrightness',
        level: 'blueprint',
        entityId: 'bp_1',
        reason: 'not_editable_at_level',
      },
    ]);
  });
});

describe('bloqueos', () => {
  it('mandatory de organización rechaza el override de franquicia y lo lista en rejected', () => {
    const effective = resolve([
      layer(
        'organization',
        { 'branding.palette.primary': '#112233' },
        { locks: [lock('branding.palette.primary', 'mandatory', 'organization')] },
      ),
      layer('franchise', { 'branding.palette.primary': '#FF0000' }),
    ]);
    expect(effective.values['branding.palette.primary']).toBe('#112233');
    expect(effective.provenance['branding.palette.primary']?.level).toBe('organization');
    expect(effective.rejected).toEqual([
      {
        key: 'branding.palette.primary',
        level: 'franchise',
        entityId: 'fr_1',
        reason: 'locked_by_organization',
      },
    ]);
    expect(effective.locks['branding.palette.primary']).toEqual({
      key: 'branding.palette.primary',
      policy: 'mandatory',
      setBy: 'organization',
      setById: 'org_1',
    });
  });

  it('range acepta dentro y rechaza fuera, con números y con enumerados', () => {
    const effective = resolve([
      layer(
        'organization',
        {},
        {
          locks: [
            lock('timing.idleTimeoutSec', 'range', 'organization', { min: 30, max: 60 }),
            lock('branding.tone', 'range', 'organization', { allowed: ['friendly', 'formal'] }),
          ],
        },
      ),
      layer('franchise', { 'timing.idleTimeoutSec': 45, 'branding.tone': 'formal' }),
      layer('machine', { 'timing.idleTimeoutSec': 120, 'branding.tone': 'playful' }),
    ]);
    expect(effective.values['timing.idleTimeoutSec']).toBe(45);
    expect(effective.values['branding.tone']).toBe('formal');
    expect(effective.rejected).toEqual([
      { key: 'branding.tone', level: 'machine', entityId: 'mch_1', reason: 'out_of_range' },
      { key: 'timing.idleTimeoutSec', level: 'machine', entityId: 'mch_1', reason: 'out_of_range' },
    ]);
  });

  it('range rechaza tipos que no puede validar', () => {
    const effective = resolve([
      layer(
        'organization',
        {},
        { locks: [lock('timing.idleTimeoutSec', 'range', 'organization', { min: 30, max: 60 })] },
      ),
      layer('machine', { 'timing.idleTimeoutSec': '45' }),
    ]);
    expect(effective.rejected[0]?.reason).toBe('out_of_range');
    expect(effective.values['timing.idleTimeoutSec']).toBe(60);
  });

  it('hidden rechaza y la procedencia no pasa a la franquicia', () => {
    const effective = resolve([
      layer(
        'organization',
        { 'techPanel.pinHash': 'hash-org' },
        { locks: [lock('techPanel.pinHash', 'hidden', 'organization')] },
      ),
      layer('franchise', { 'techPanel.pinHash': 'hash-fr' }),
    ]);
    expect(effective.values['techPanel.pinHash']).toBe('hash-org');
    expect(effective.provenance['techPanel.pinHash']?.level).toBe('organization');
    expect(effective.locks['techPanel.pinHash']?.policy).toBe('hidden');
    expect(effective.rejected).toEqual([
      {
        key: 'techPanel.pinHash',
        level: 'franchise',
        entityId: 'fr_1',
        reason: 'locked_by_organization',
      },
    ]);
  });

  it('un bloqueo nunca aplica a su propia capa', () => {
    const effective = resolve([
      layer(
        'organization',
        { 'branding.publicName': 'Propio' },
        { locks: [lock('branding.publicName', 'mandatory', 'organization')] },
      ),
    ]);
    expect(effective.values['branding.publicName']).toBe('Propio');
    expect(effective.rejected).toEqual([]);
  });

  it('un bloqueo inferior no debilita a uno superior: se ignora y se reporta', () => {
    const effective = resolve([
      layer(
        'organization',
        {},
        { locks: [lock('timing.idleTimeoutSec', 'range', 'organization', { min: 30, max: 60 })] },
      ),
      layer(
        'franchise',
        {},
        {
          locks: [
            lock('timing.idleTimeoutSec', 'editable', 'franchise'),
            lock('timing.idleTimeoutSec', 'range', 'franchise', { min: 10, max: 60 }),
          ],
        },
      ),
    ]);
    expect(effective.locks['timing.idleTimeoutSec']).toMatchObject({
      setBy: 'organization',
      range: { min: 30, max: 60 },
    });
    expect(effective.rejected).toEqual([
      {
        key: 'timing.idleTimeoutSec',
        level: 'franchise',
        entityId: 'fr_1',
        reason: 'lock_ignored',
      },
      {
        key: 'timing.idleTimeoutSec',
        level: 'franchise',
        entityId: 'fr_1',
        reason: 'lock_ignored',
      },
    ]);
  });

  it('un bloqueo inferior más estricto sí sustituye al superior', () => {
    const narrower = resolve([
      layer(
        'organization',
        {},
        { locks: [lock('timing.idleTimeoutSec', 'range', 'organization', { min: 30, max: 60 })] },
      ),
      layer(
        'franchise',
        {},
        { locks: [lock('timing.idleTimeoutSec', 'range', 'franchise', { min: 40, max: 50 })] },
      ),
      layer('machine', { 'timing.idleTimeoutSec': 55 }),
    ]);
    expect(narrower.locks['timing.idleTimeoutSec']).toMatchObject({
      setBy: 'franchise',
      range: { min: 40, max: 50 },
    });
    expect(narrower.rejected).toEqual([
      { key: 'timing.idleTimeoutSec', level: 'machine', entityId: 'mch_1', reason: 'out_of_range' },
    ]);

    const stronger = resolve([
      layer(
        'organization',
        {},
        { locks: [lock('timing.idleTimeoutSec', 'range', 'organization', { min: 30, max: 60 })] },
      ),
      layer(
        'franchise',
        { 'timing.idleTimeoutSec': 45 },
        { locks: [lock('timing.idleTimeoutSec', 'mandatory', 'franchise')] },
      ),
      layer('machine', { 'timing.idleTimeoutSec': 50 }),
    ]);
    expect(stronger.values['timing.idleTimeoutSec']).toBe(45);
    expect(stronger.locks['timing.idleTimeoutSec']?.setBy).toBe('franchise');
    expect(stronger.rejected).toEqual([
      {
        key: 'timing.idleTimeoutSec',
        level: 'machine',
        entityId: 'mch_1',
        reason: 'locked_by_franchise',
      },
    ]);
  });

  it('normaliza setBy al nivel de la capa que declara el bloqueo', () => {
    const effective = resolve([
      layer('organization', {}, { locks: [lock('branding.footerText', 'mandatory', 'platform')] }),
      layer('location', { 'branding.footerText': 'x' }),
    ]);
    expect(effective.locks['branding.footerText']).toMatchObject({
      setBy: 'organization',
      setById: 'org_1',
    });
    expect(effective.rejected[0]?.reason).toBe('locked_by_organization');
  });

  it('bloquea también claves sin definición', () => {
    const effective = resolve([
      layer(
        'organization',
        { 'custom.theme': 'light' },
        { locks: [lock('custom.theme', 'mandatory', 'organization')] },
      ),
      layer('machine', { 'custom.theme': 'dark' }),
    ]);
    expect(effective.values['custom.theme']).toBe('light');
    expect(effective.rejected[0]?.reason).toBe('locked_by_organization');
  });
});

describe('editableAt', () => {
  it('kiosk.screenBrightness sólo se edita en máquina', () => {
    const effective = resolve([
      layer('organization', { 'kiosk.screenBrightness': 40 }),
      layer('machine', { 'kiosk.screenBrightness': 60 }),
    ]);
    expect(effective.values['kiosk.screenBrightness']).toBe(60);
    expect(effective.rejected).toEqual([
      {
        key: 'kiosk.screenBrightness',
        level: 'organization',
        entityId: 'org_1',
        reason: 'not_editable_at_level',
      },
    ]);
  });

  it('platform no escribe claves reservadas a la organización', () => {
    const effective = resolve([layer('platform', { 'branding.publicName': 'Plataforma' })]);
    expect(effective.values['branding.publicName']).toBe('');
    expect(effective.rejected[0]).toMatchObject({
      level: 'platform',
      reason: 'not_editable_at_level',
    });
    expect(effective.rejected[0]).not.toHaveProperty('entityId');
  });
});

describe('campañas', () => {
  it('una campaña vigente aplica su overlay; una fuera de fecha no', () => {
    const effective = resolve(chain(), {
      campaigns: [
        overlay('cmp_active', { values: { 'branding.palette.accent': '#AAAAAA' } }),
        overlay('cmp_past', {
          startsAt: '2026-01-01T00:00:00Z',
          endsAt: '2026-02-01T00:00:00Z',
          values: { 'branding.palette.accent': '#BBBBBB', 'branding.footerText': 'pasada' },
        }),
        overlay('cmp_future', {
          startsAt: '2026-12-01T00:00:00Z',
          endsAt: '2026-12-31T00:00:00Z',
          values: { 'branding.footerText': 'futura' },
        }),
      ],
    });
    expect(effective.values['branding.palette.accent']).toBe('#AAAAAA');
    expect(effective.provenance['branding.palette.accent']).toEqual({
      level: 'campaign',
      entityId: 'cmp_active',
      layerId: 'cfg_cmp_active',
      isDefault: false,
    });
    expect(effective.values['branding.footerText']).toBe('');
  });

  it('con dos campañas vigentes gana la de mayor prioridad; a igual prioridad, la que empieza después', () => {
    const byPriority = resolve(chain(), {
      campaigns: [
        overlay('cmp_high', { priority: 5, values: { 'branding.palette.accent': '#HIGH00' } }),
        overlay('cmp_low', { priority: 1, values: { 'branding.palette.accent': '#LOW000' } }),
      ],
    });
    expect(byPriority.values['branding.palette.accent']).toBe('#HIGH00');
    expect(byPriority.provenance['branding.palette.accent']?.entityId).toBe('cmp_high');

    const byStart = resolve(chain(), {
      campaigns: [
        overlay('cmp_b', {
          priority: 1,
          startsAt: '2026-09-05T00:00:00Z',
          values: { 'branding.footerText': 'b' },
        }),
        overlay('cmp_a', {
          priority: 1,
          startsAt: '2026-09-01T00:00:00Z',
          values: { 'branding.footerText': 'a' },
        }),
      ],
    });
    expect(byStart.values['branding.footerText']).toBe('b');
  });

  it('la vigencia es un intervalo semiabierto [startsAt, endsAt) en UTC', () => {
    const window = { startsAt: '2026-09-09T12:00:00Z', endsAt: '2026-09-09T13:00:00Z' };
    expect(isCampaignActive(window, new Date('2026-09-09T12:00:00Z'))).toBe(true);
    expect(isCampaignActive(window, new Date('2026-09-09T12:59:59Z'))).toBe(true);
    expect(isCampaignActive(window, new Date('2026-09-09T13:00:00Z'))).toBe(false);
    expect(
      isCampaignActive(
        { startsAt: '2026-09-09T07:00:00-05:00', endsAt: '2026-09-09T08:00:00-05:00' },
        NOW,
      ),
    ).toBe(true);
  });

  it('orderCampaigns aplica primero la de menor prioridad', () => {
    const ordered = orderCampaigns([
      overlay('cmp_z', { priority: 9 }),
      overlay('cmp_a', { priority: 1 }),
      overlay('cmp_m', { priority: 1 }),
    ]);
    expect(ordered.map((o) => o.campaign.id)).toEqual(['cmp_a', 'cmp_m', 'cmp_z']);
  });

  it('una campaña escribe con permisos de ubicación y respeta los bloqueos superiores', () => {
    const effective = resolve(
      [
        layer(
          'organization',
          { 'branding.palette.primary': '#112233' },
          { locks: [lock('branding.palette.primary', 'mandatory', 'organization')] },
        ),
      ],
      {
        campaigns: [
          overlay('cmp_1', {
            values: { 'branding.palette.primary': '#FF0000', 'kiosk.screenBrightness': 20 },
          }),
        ],
      },
    );
    expect(effective.values['branding.palette.primary']).toBe('#112233');
    expect(effective.rejected).toEqual([
      {
        key: 'branding.palette.primary',
        level: 'campaign',
        entityId: 'cmp_1',
        reason: 'locked_by_organization',
      },
      {
        key: 'kiosk.screenBrightness',
        level: 'campaign',
        entityId: 'cmp_1',
        reason: 'not_editable_at_level',
      },
    ]);
  });
});

describe('hash y determinismo', () => {
  it('el mismo insumo con claves en distinto orden produce el mismo hash', () => {
    const a = resolve([
      layer('organization', { 'branding.publicName': 'A', 'branding.footerText': 'F' }),
    ]);
    const b = resolve([
      layer('organization', { 'branding.footerText': 'F', 'branding.publicName': 'A' }),
    ]);
    expect(a.hash).toBe(b.hash);
    expect(a).toEqual(b);
  });

  it('cambiar un valor o un bloqueo cambia el hash; una escritura rechazada no', () => {
    const base = resolve([layer('organization', { 'branding.publicName': 'A' })]);
    const changed = resolve([layer('organization', { 'branding.publicName': 'B' })]);
    const locked = resolve([
      layer(
        'organization',
        { 'branding.publicName': 'A' },
        { locks: [lock('branding.publicName', 'mandatory', 'organization')] },
      ),
    ]);
    const rejected = resolve([
      layer('organization', { 'branding.publicName': 'A', 'kiosk.screenBrightness': 10 }),
    ]);
    expect(changed.hash).not.toBe(base.hash);
    expect(locked.hash).not.toBe(base.hash);
    expect(rejected.rejected).toHaveLength(1);
    expect(rejected.hash).toBe(base.hash);
  });

  it('rechaza un now inválido', () => {
    expect(() => resolveEffectiveConfig({ layers: [], now: new Date('no'), timezone: TZ })).toThrow(
      RangeError,
    );
  });

  it('permite un registro de definiciones propio', () => {
    const effective = resolveEffectiveConfig({
      layers: [layer('machine', { 'demo.flag': false })],
      definitions: [
        {
          key: 'demo.flag',
          type: 'boolean',
          group: 'kiosk',
          name: { es: 'Bandera' },
          default: true,
          editableAt: ['machine'],
          sensitive: false,
        },
      ],
      now: NOW,
      timezone: TZ,
    });
    expect(Object.keys(effective.values)).toEqual(['demo.flag']);
    expect(effective.values['demo.flag']).toBe(false);
  });
});

describe('explainKey', () => {
  it('explica valor, procedencia, bloqueo, definición y rechazos', () => {
    const effective = resolve([
      layer(
        'organization',
        { 'branding.palette.primary': '#112233' },
        { locks: [lock('branding.palette.primary', 'mandatory', 'organization')] },
      ),
      layer('franchise', { 'branding.palette.primary': '#FF0000' }),
    ]);
    const explained = explainKey(effective, 'branding.palette.primary');
    expect(explained.present).toBe(true);
    expect(explained.value).toBe('#112233');
    expect(explained.provenance).toMatchObject({ level: 'organization', entityId: 'org_1' });
    expect(explained.lock?.policy).toBe('mandatory');
    expect(explained.definition?.key).toBe('branding.palette.primary');
    expect(explained.rejected).toEqual([
      {
        key: 'branding.palette.primary',
        level: 'franchise',
        entityId: 'fr_1',
        reason: 'locked_by_organization',
      },
    ]);
  });

  it('una clave ausente se reporta como no presente', () => {
    const explained = explainKey(resolve([]), 'custom.missing');
    expect(explained).toEqual({
      present: false,
      value: undefined,
      provenance: { level: 'platform', isDefault: true },
      rejected: [],
    });
    expect(explained).not.toHaveProperty('lock');
    expect(explained).not.toHaveProperty('definition');
  });
});
