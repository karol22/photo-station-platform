import { FEATURE_DEFINITIONS, type EntitlementPlan, type FeatureOverride } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { featureMode, resolveFeatures } from './features';
import { scopeChain } from './hierarchy';
import { AT, FR_BAJIO, FR_NORTE, NOW, ORG, capability, demoHierarchy, machine, scope } from './__tests__/fixtures';

const index = demoHierarchy();
const chainNorte = scopeChain(index, scope.machine('mch_n1'));
const chainBajio = scopeChain(index, scope.machine('mch_b1'));

function override(id: string, key: FeatureOverride['key'], scopeValue: FeatureOverride['scope'], mode: FeatureOverride['mode'], setAt = AT): FeatureOverride {
  return { id, key, scope: scopeValue, mode, setAt };
}

describe('resolveFeatures', () => {
  it('sin insumos devuelve los defaults de cada definición, en orden', () => {
    const states = resolveFeatures({ chain: chainNorte, overrides: [], entitlements: [], plans: [], now: NOW });
    expect(states.map((s) => s.key)).toEqual(FEATURE_DEFINITIONS.map((f) => f.key));
    for (const state of states) expect(state.source).toBe('default');
    expect(featureMode(states, 'documents.mode')).toBe('enabled');
    expect(featureMode(states, 'ai.experiences')).toBe('coming_soon');
    expect(featureMode([], 'payments.qr')).toBe('coming_soon');
  });

  it('escenario I: una función habilitada sólo para una franquicia piloto', () => {
    const overrides = [override('fo_1', 'analytics.advanced', scope.platform(), 'hidden'), override('fo_2', 'analytics.advanced', scope.franchise(FR_NORTE), 'enabled', '2026-09-02T00:00:00Z')];
    const pilot = resolveFeatures({ chain: chainNorte, overrides, entitlements: [], plans: [], now: NOW });
    const other = resolveFeatures({ chain: chainBajio, overrides, entitlements: [], plans: [], now: NOW });
    expect(pilot.find((s) => s.key === 'analytics.advanced')).toEqual({ key: 'analytics.advanced', mode: 'enabled', source: scope.franchise(FR_NORTE) });
    expect(other.find((s) => s.key === 'analytics.advanced')).toEqual({ key: 'analytics.advanced', mode: 'hidden', source: scope.platform() });
    // Otra máquina de la misma franquicia también la recibe.
    const sibling = resolveFeatures({ chain: scopeChain(index, scope.machine('mch_n3')), overrides, entitlements: [], plans: [], now: NOW });
    expect(featureMode(sibling, 'analytics.advanced')).toBe('enabled');
  });

  it('el override más específico gana; un nivel fuera de appliesTo se ignora', () => {
    const overrides = [
      override('a', 'kiosk.demoMode', scope.organization(ORG), 'hidden'),
      override('b', 'kiosk.demoMode', scope.machine('mch_n1'), 'enabled', '2026-08-01T00:00:00Z'),
      // kiosk.demoMode no aplica a nivel ubicación.
      override('c', 'kiosk.demoMode', scope.location('loc_norte_1'), 'locked'),
      override('d', 'kiosk.demoMode', scope.franchise(FR_BAJIO), 'enabled'),
    ];
    const states = resolveFeatures({ chain: chainNorte, overrides, entitlements: [], plans: [], now: NOW });
    expect(states.find((s) => s.key === 'kiosk.demoMode')).toMatchObject({ mode: 'enabled', source: scope.machine('mch_n1') });
    const n2 = resolveFeatures({ chain: scopeChain(index, scope.machine('mch_n2')), overrides, entitlements: [], plans: [], now: NOW });
    expect(n2.find((s) => s.key === 'kiosk.demoMode')).toMatchObject({ mode: 'hidden', source: scope.organization(ORG) });
  });

  it('el plan del entitlement vigente bloquea lo que no incluye; un override lo puede abrir', () => {
    const plans: EntitlementPlan[] = [
      { id: 'plan_basic', key: 'basic', name: { es: 'Básico', en: 'Basic' }, features: ['documents.mode', 'editing.local', 'printing.photo'], limits: {} },
      { id: 'plan_pro', key: 'pro', name: { es: 'Pro' }, features: FEATURE_DEFINITIONS.map((f) => f.key), limits: {} },
    ];
    const entitlements = [
      { id: 'ent_org', scope: scope.organization(ORG), planId: 'plan_pro', startsAt: AT },
      { id: 'ent_fr', scope: scope.franchise(FR_NORTE), planId: 'plan_basic', startsAt: AT },
      { id: 'ent_old', scope: scope.franchise(FR_NORTE), planId: 'plan_pro', startsAt: '2025-01-01T00:00:00Z', endsAt: '2026-01-01T00:00:00Z' },
    ];
    const norte = resolveFeatures({ chain: chainNorte, overrides: [], entitlements, plans, now: NOW });
    expect(norte.find((s) => s.key === 'entertainment.mode')).toMatchObject({ mode: 'locked', source: 'plan', reason: { es: 'No incluida en el plan «Básico»', en: 'Not included in plan "Basic"' } });
    expect(featureMode(norte, 'documents.mode')).toBe('enabled');
    const bajio = resolveFeatures({ chain: chainBajio, overrides: [], entitlements, plans, now: NOW });
    expect(featureMode(bajio, 'entertainment.mode')).toBe('enabled');
    const opened = resolveFeatures({ chain: chainNorte, overrides: [override('fo', 'entertainment.mode', scope.franchise(FR_NORTE), 'enabled')], entitlements, plans, now: NOW });
    expect(featureMode(opened, 'entertainment.mode')).toBe('enabled');
  });

  it('una dependencia no habilitada oculta a sus dependientes en cadena', () => {
    const states = resolveFeatures({ chain: chainNorte, overrides: [override('x', 'documents.mode', scope.organization(ORG), 'locked')], entitlements: [], plans: [], now: NOW });
    expect(states.find((s) => s.key === 'documents.autoCapture')).toMatchObject({ mode: 'hidden', source: scope.organization(ORG), reason: { es: 'Requiere «Modo documentos»' } });
    expect(featureMode(states, 'documents.advancedValidation')).toBe('hidden');
    const noLocal = resolveFeatures({ chain: chainNorte, overrides: [override('y', 'editing.local', scope.organization(ORG), 'hidden')], entitlements: [], plans: [], now: NOW });
    expect(featureMode(noLocal, 'editing.creative')).toBe('hidden');
  });

  it('con máquina, las capacidades ausentes ocultan la función', () => {
    const thermalOnly = machine('mch_t', { organizationId: ORG, capabilities: [capability('camera.primary'), capability('display.touch'), capability('printer.thermal')] });
    const states = resolveFeatures({ chain: chainNorte, overrides: [], entitlements: [], plans: [], machine: thermalOnly, now: NOW });
    expect(states.find((s) => s.key === 'printing.photo')).toMatchObject({ mode: 'hidden', source: 'capability', reason: { es: 'Falta hardware: printer.photo' } });
    expect(featureMode(states, 'printing.thermal')).toBe('enabled');
    expect(featureMode(states, 'payments.terminal')).toBe('hidden');
    // Capacidad presente pero fuera de servicio no oculta: es temporal.
    const broken = machine('mch_b', { organizationId: ORG, capabilities: [capability('camera.primary', true, false), capability('printer.photo')] });
    expect(featureMode(resolveFeatures({ chain: chainNorte, overrides: [], entitlements: [], plans: [], machine: broken, now: NOW }), 'documents.mode')).toBe('enabled');
  });
});
