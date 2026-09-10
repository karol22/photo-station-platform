import { describe, expect, it } from 'vitest';
import type { FeatureState } from '@psp/contracts';
import { capabilityMap, checkCapabilities, computeAvailability } from './capabilities';
import { scopeChain } from './hierarchy';
import { FR_BAJIO, FR_NORTE, NOW, ORG, TZ, capability, demoHierarchy, machine, printer, product, scope } from './__tests__/fixtures';

const index = demoHierarchy();
const mch = index.machines.get('mch_n1')!;
const chain = scopeChain(index, scope.machine('mch_n1'));
const enabled = (key: FeatureState['key']): FeatureState => ({ key, mode: 'enabled', source: 'default' });
const baseFeatures: FeatureState[] = [enabled('documents.mode'), enabled('entertainment.mode'), enabled('printing.photo'), enabled('printing.thermal')];

function availability(over: Partial<Parameters<typeof computeAvailability>[0]> = {}) {
  return computeAvailability({
    products: [product('prd_doc')],
    machine: mch,
    features: baseFeatures,
    printers: [printer('prn_1')],
    availabilities: [],
    chain,
    now: NOW,
    timezone: TZ,
    maintenance: false,
    ...over,
  });
}

describe('capabilityMap / checkCapabilities', () => {
  it('separa capacidades ausentes de las fuera de servicio', () => {
    const m = machine('mch_x', { organizationId: ORG, capabilities: [capability('camera.primary'), capability('printer.photo', true, false), capability('audio.output', false)] });
    expect(Object.keys(capabilityMap(m)).sort()).toEqual(['audio.output', 'camera.primary', 'printer.photo']);
    expect(checkCapabilities(['camera.primary', 'printer.photo', 'audio.output', 'payment.terminal', 'camera.primary'], m)).toEqual({
      missing: ['audio.output', 'payment.terminal'],
      notOperational: ['printer.photo'],
    });
  });
});

describe('computeAvailability', () => {
  it('un producto activo con todo en orden está disponible', () => {
    expect(availability()).toEqual([{ productId: 'prd_doc', available: true, presentation: 'show', reasons: [] }]);
  });

  it('impresora sin papel: se muestra como no disponible temporalmente (escenario F)', () => {
    expect(availability({ printers: [printer('prn_1', { status: 'no_paper' })] })[0]).toEqual({ productId: 'prd_doc', available: false, presentation: 'show', reasons: ['no_paper'] });
    expect(availability({ printers: [printer('prn_1', { paperEstimate: 0 })] })[0]?.reasons).toEqual(['no_paper']);
    expect(availability({ printers: [printer('prn_1', { status: 'jam' })] })[0]?.reasons).toEqual(['printer_unavailable']);
    expect(availability({ printers: [] })[0]?.reasons).toEqual(['printer_unavailable']);
    // Impresora térmica no sirve para un producto fotográfico 4x6.
    expect(availability({ printers: [printer('prn_t', { type: 'thermal', paperSizes: ['58mm-thermal'] })] })[0]?.reasons).toEqual(['printer_unavailable']);
    // Con una impresora compatible lista, otra atascada no estorba.
    expect(availability({ printers: [printer('prn_1', { status: 'jam' }), printer('prn_2')] })[0]?.available).toBe(true);
    // Un producto sin impresión ignora impresoras.
    expect(availability({ products: [product('prd_digital', { printCount: 0 })], printers: [] })[0]?.available).toBe(true);
  });

  it('feature próximamente / bloqueada / oculta define la presentación', () => {
    const ai = product('prd_ai', { kind: 'ai', category: 'ai_future', printCount: 0 });
    expect(availability({ products: [ai], features: [{ key: 'ai.experiences', mode: 'coming_soon', source: 'default' }] })[0]).toEqual({
      productId: 'prd_ai',
      available: false,
      presentation: 'coming_soon',
      reasons: ['feature_coming_soon'],
    });
    // Sin estado explícito aplica el default de la definición (ai.experiences: coming_soon).
    expect(availability({ products: [ai], features: [] })[0]?.presentation).toBe('coming_soon');
    const strip = product('prd_strip', { kind: 'entertainment', category: 'photo_strip', captureCount: 4, requiredFeatures: ['editing.creative'] });
    expect(availability({ products: [strip], features: [...baseFeatures, { key: 'editing.creative', mode: 'locked', source: 'plan' }] })[0]).toMatchObject({ presentation: 'locked', reasons: ['feature_locked'] });
    expect(availability({ products: [strip], features: [...baseFeatures, { key: 'editing.creative', mode: 'hidden', source: 'plan' }] })[0]).toMatchObject({ presentation: 'hidden', reasons: ['feature_hidden'] });
    // Oculto gana sobre bloqueado.
    expect(availability({ products: [strip], features: [{ key: 'entertainment.mode', mode: 'hidden', source: 'default' }, { key: 'editing.creative', mode: 'locked', source: 'plan' }] })[0]?.presentation).toBe('hidden');
  });

  it('faltan capacidades de hardware → oculto; fuera de servicio → se muestra', () => {
    const doc = product('prd_doc', { hardwareRequirements: ['printer.photo', 'lighting.controllable'] });
    expect(availability({ products: [doc] })[0]).toMatchObject({ presentation: 'hidden', reasons: ['missing_capability'] });
    const broken = machine('mch_broken', { organizationId: ORG, capabilities: [capability('camera.primary', true, false), capability('printer.photo')] });
    expect(availability({ products: [product('prd_doc', { hardwareRequirements: ['camera.primary'] })], machine: broken })[0]).toMatchObject({
      available: false,
      presentation: 'show',
      reasons: ['capability_not_operational'],
    });
  });

  it('mantenimiento, horario, ventana, estado y disponibilidad por alcance', () => {
    expect(availability({ maintenance: true })[0]).toMatchObject({ presentation: 'show', reasons: ['maintenance'] });
    // NOW es martes 18:00 hora local.
    expect(availability({ products: [product('prd_doc', { schedule: [{ days: [2], from: '09:00', to: '17:00' }] })] })[0]).toMatchObject({ presentation: 'show', reasons: ['out_of_schedule'] });
    expect(availability({ products: [product('prd_doc', { schedule: [{ days: [2], from: '09:00', to: '19:00' }] })] })[0]?.available).toBe(true);
    expect(availability({ products: [product('prd_doc', { endsAt: '2026-09-01T00:00:00Z' })] })[0]).toMatchObject({ presentation: 'hidden', reasons: ['out_of_window'] });
    expect(availability({ products: [product('prd_doc', { status: 'inactive' })] })[0]).toMatchObject({ presentation: 'hidden', reasons: ['inactive'] });
    expect(availability({ products: [product('prd_doc', { organizationId: 'org_other' })] })[0]?.reasons).toEqual(['not_available_here']);
    const at = '2026-09-01T00:00:00Z';
    const disabledForFranchise = { id: 'pa_1', productId: 'prd_doc', scope: scope.franchise(FR_NORTE), enabled: false, updatedAt: at };
    expect(availability({ availabilities: [disabledForFranchise] })[0]).toMatchObject({ presentation: 'hidden', reasons: ['not_available_here'] });
    // La máquina, más específica, vuelve a habilitarlo; una entrada temporal vencida se ignora.
    const enabledForMachine = { id: 'pa_2', productId: 'prd_doc', scope: scope.machine('mch_n1'), enabled: true, updatedAt: at };
    expect(availability({ availabilities: [disabledForFranchise, enabledForMachine] })[0]?.available).toBe(true);
    const expired = { ...enabledForMachine, temporaryUntil: '2026-09-02T00:00:00Z' };
    expect(availability({ availabilities: [disabledForFranchise, expired] })[0]?.available).toBe(false);
    // Otra franquicia no afecta.
    expect(availability({ availabilities: [{ ...disabledForFranchise, scope: scope.franchise(FR_BAJIO) }] })[0]?.available).toBe(true);
  });
});
