import { describe, expect, it } from 'vitest';
import type { Product } from '@psp/contracts';
import { consentRequired, firstWorkingStage, nextScreen, nextStage, paymentRequired, retakesLeft, screenForStage } from './flow';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prd_test',
    organizationId: 'org_test',
    internalName: 'test',
    displayName: { es: 'Producto' },
    category: 'documents',
    kind: 'document',
    description: { es: '' },
    whatYouGet: { es: '' },
    estimatedDurationSec: 120,
    captureCount: 1,
    printCount: 1,
    output: { templateId: 'tpl_sheet', paperSize: '4x6in', copies: 1 },
    editing: { enabled: true, allowedTools: ['brightness'], allowedPresetIds: [] },
    retakes: { max: 2, perPhoto: true, wholeSession: false, keepPreviousForCompare: true },
    autoCapture: true,
    manualCapture: true,
    basePrice: { amount: 8000, currency: 'MXN' },
    hardwareRequirements: [],
    requiredFeatures: [],
    schedule: [],
    timing: {},
    status: 'active',
    priority: 100,
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('flow: siguiente pantalla por producto', () => {
  it('documental de pago: consentimiento no, pago sí, sin selección', () => {
    const p = product();
    const opts = { paymentRequired: true, consentRequired: false };
    expect(firstWorkingStage(p, opts)).toBe('awaiting_payment');
    expect(nextScreen(p, 'awaiting_payment', opts)).toBe('/session/capture');
    expect(nextScreen(p, 'capturing', opts)).toBe('/session/review');
    expect(nextScreen(p, 'reviewing', opts)).toBe('/session/edit');
    expect(nextScreen(p, 'editing', opts)).toBe('/session/compose');
    expect(nextScreen(p, 'composing', opts)).toBe('/session/confirm');
    expect(nextScreen(p, 'confirming', opts)).toBe('/session/print');
    expect(nextScreen(p, 'printing', opts)).toBe('/session/finish');
  });

  it('entretenimiento gratuito con varias fotos elige dentro de la revisión', () => {
    const p = product({ kind: 'entertainment', captureCount: 4, editing: { enabled: false, allowedTools: [], allowedPresetIds: [] } });
    const opts = { paymentRequired: false, consentRequired: true };
    expect(firstWorkingStage(p, opts)).toBe('consent');
    expect(nextScreen(p, 'consent', opts)).toBe('/session/capture');
    // Elegir ya no es una etapa aparte: descartar lo que sobra ES la revisión.
    expect(nextScreen(p, 'reviewing', opts)).toBe('/session/compose');
    // Una sesión guardada en la etapa vieja sigue avanzando a la siguiente que sí está en el plan.
    expect(nextScreen(p, 'selecting', opts)).toBe('/session/compose');
  });

  it('sin impresión salta la etapa de impresión', () => {
    const p = product({ printCount: 0 });
    expect(nextStage(p, 'confirming', { paymentRequired: false, consentRequired: false })).toBe('delivering');
  });

  it('una etapa fuera del plan avanza a la siguiente canónica', () => {
    const p = product();
    expect(nextStage(p, 'consent', { paymentRequired: false, consentRequired: false })).toBe('capturing');
  });

  it('recuperación tras recarga: cada etapa tiene pantalla', () => {
    expect(screenForStage('capturing')).toBe('/session/capture');
    expect(screenForStage('started', { id: 'prd_x' })).toBe('/product/prd_x');
    expect(screenForStage('cancelled')).toBe('/');
    expect(screenForStage('failed')).toBe('/error');
  });
});

describe('flow: pago y consentimiento', () => {
  const bundle = { effective: { values: { 'payment.businessMode': 'paid' } }, prices: [{ productId: 'prd_test', list: { amount: 8000, currency: 'MXN' }, final: { amount: 0, currency: 'MXN' }, provenance: { level: 'platform' as const }, appliedPromotionIds: [] }] };
  it('precio final 0 no cobra aunque el modo sea paid', () => {
    expect(paymentRequired({ product: product(), bundle })).toBe(false);
  });
  it('modo demo no cobra', () => {
    expect(paymentRequired({ product: product(), bundle: { effective: { values: {} }, prices: [] }, status: { demoMode: true } })).toBe(false);
    expect(paymentRequired({ product: product(), bundle: { effective: { values: {} }, prices: [] } })).toBe(true);
  });
  it('consentimiento cuando la retención sale del dispositivo o hay términos', () => {
    const policies = [{ id: 'ret_x', name: { es: 'x' }, mode: 'period' as const, deleteIncomplete: true, appliesToKinds: [], customerText: { es: '' }, leavesDevice: true }];
    expect(consentRequired({ product: product({ retentionPolicyId: 'ret_x' }), bundle: { retentionPolicies: policies, effective: { values: {} } } })).toBe(true);
    expect(consentRequired({ product: product(), bundle: { retentionPolicies: [], effective: { values: {} } } })).toBe(false);
    expect(consentRequired({ product: product({ terms: { es: 'x' } }), bundle: undefined })).toBe(true);
  });
  it('retakes restantes por foto', () => {
    const session = { retakesUsed: 1, captures: [{ id: 'c1', index: 0, takenAt: '', width: 1, height: 1, url: '', selected: false, auto: false, retakeOf: 'c0' }] };
    expect(retakesLeft(product(), session, 0)).toBe(1);
    expect(retakesLeft(product({ retakes: { max: 3, perPhoto: false, wholeSession: true, keepPreviousForCompare: true } }), session)).toBe(2);
  });
});
