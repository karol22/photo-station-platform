import { Campaign, PriceRule, Promotion, type Money } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { scopeChain } from './hierarchy';
import { applyPromotion, resolvePrice, validatePriceRule } from './pricing';
import { AT, FR_BAJIO, FR_NORTE, LOC_N1, NOW, ORG, TZ, demoHierarchy, product, scope } from './__tests__/fixtures';

const index = demoHierarchy();
const chain = scopeChain(index, scope.machine('mch_n1'));
const doc = product('prd_doc');
const mxn = (amount: number): Money => ({ amount, currency: 'MXN' });

function rule(id: string, scopeValue: PriceRule['scope'], amount: number, over: Record<string, unknown> = {}): PriceRule {
  return PriceRule.parse({ id, productId: 'prd_doc', scope: scopeValue, price: mxn(amount), updatedAt: AT, ...over });
}

function promo(id: string, over: Record<string, unknown> = {}): Promotion {
  return Promotion.parse({ id, organizationId: ORG, name: { es: id }, type: 'percent_discount', value: 20, scope: scope.organization(ORG), status: 'active', createdAt: AT, ...over });
}

function resolve(over: Partial<Parameters<typeof resolvePrice>[0]> = {}) {
  return resolvePrice({ product: doc, rules: [], promotions: [], campaigns: [], chain, now: NOW, timezone: TZ, businessMode: 'paid', ...over });
}

describe('resolvePrice: herencia y bloqueos', () => {
  it('sin reglas usa el precio base con procedencia de la organización', () => {
    expect(resolve()).toEqual({ productId: 'prd_doc', list: mxn(8000), final: mxn(8000), appliedPromotionIds: [], provenance: scope.organization(ORG) });
  });

  it('la regla más específica gana: precio heredado con override por máquina', () => {
    const rules = [rule('r_org', scope.organization(ORG), 9000), rule('r_fr', scope.franchise(FR_NORTE), 8500), rule('r_mch', scope.machine('mch_n1'), 6000)];
    expect(resolve({ rules })).toMatchObject({ list: mxn(6000), final: mxn(6000), appliedRuleId: 'r_mch', provenance: scope.machine('mch_n1') });
    expect(resolve({ rules }).lockedBy).toBeUndefined();
    // En otra máquina de la franquicia aplica la regla de franquicia.
    expect(resolvePrice({ product: doc, rules, promotions: [], campaigns: [], chain: scopeChain(index, scope.machine('mch_n2')), now: NOW, timezone: TZ, businessMode: 'paid' })).toMatchObject({ list: mxn(8500), appliedRuleId: 'r_fr' });
    // Reglas de otra franquicia o de otro producto no cuentan.
    expect(resolve({ rules: [rule('r_b', scope.franchise(FR_BAJIO), 100), rule('r_p', scope.machine('mch_n1'), 100, { productId: 'prd_otro' })] }).list).toEqual(mxn(8000));
  });

  it('empate en el mismo nivel: gana la prioridad, luego la más reciente', () => {
    const rules = [rule('r_a', scope.organization(ORG), 7000, { priority: 1 }), rule('r_b', scope.organization(ORG), 7500, { priority: 5 }), rule('r_c', scope.organization(ORG), 7200, { priority: 5, updatedAt: '2026-09-05T00:00:00Z' })];
    expect(resolve({ rules }).appliedRuleId).toBe('r_c');
  });

  it('bloqueo mandatory del padre: la regla de la máquina se ignora', () => {
    const rules = [rule('r_org', scope.organization(ORG), 8000, { lock: { policy: 'mandatory' } }), rule('r_mch', scope.machine('mch_n1'), 6000)];
    expect(resolve({ rules })).toMatchObject({ list: mxn(8000), final: mxn(8000), appliedRuleId: 'r_org', provenance: scope.organization(ORG), lockedBy: scope.organization(ORG) });
  });

  it('bloqueo range: fuera de rango se ignora, dentro aplica y el rango persiste hacia abajo', () => {
    const range = rule('r_org', scope.organization(ORG), 8000, { lock: { policy: 'range', min: mxn(7000), max: mxn(9000) } });
    expect(resolve({ rules: [range, rule('r_mch', scope.machine('mch_n1'), 6000)] })).toMatchObject({ list: mxn(8000), appliedRuleId: 'r_org', lockedBy: scope.organization(ORG) });
    expect(resolve({ rules: [range, rule('r_mch', scope.machine('mch_n1'), 8500)] })).toMatchObject({ list: mxn(8500), appliedRuleId: 'r_mch', lockedBy: scope.organization(ORG) });
    expect(resolve({ rules: [range, rule('r_fr', scope.franchise(FR_NORTE), 7500), rule('r_mch', scope.machine('mch_n1'), 9500)] })).toMatchObject({ list: mxn(7500), appliedRuleId: 'r_fr' });
    // Un mandatory de la franquicia (dentro del rango) bloquea a la máquina.
    const frLock = rule('r_fr', scope.franchise(FR_NORTE), 7500, { lock: { policy: 'mandatory' } });
    expect(resolve({ rules: [range, frLock, rule('r_mch', scope.machine('mch_n1'), 8000)] })).toMatchObject({ list: mxn(7500), lockedBy: scope.franchise(FR_NORTE) });
  });

  it('reglas por horario y temporada sólo aplican cuando coinciden', () => {
    const evening = rule('r_eve', scope.machine('mch_n1'), 7000, { schedule: [{ days: [1, 2, 3, 4, 5], from: '17:00', to: '20:00' }] });
    const morning = rule('r_mor', scope.machine('mch_n1'), 5000, { schedule: [{ days: [1, 2, 3, 4, 5], from: '08:00', to: '12:00' }] });
    const season = rule('r_sea', scope.machine('mch_n1'), 6500, { season: { start: '2026-12-01T00:00:00Z', end: '2026-12-31T00:00:00Z' } });
    expect(resolve({ rules: [evening, morning, season] }).appliedRuleId).toBe('r_eve');
    expect(resolve({ rules: [morning, season] }).appliedRuleId).toBeUndefined();
  });
});

describe('resolvePrice: promociones, modos de negocio y campañas', () => {
  it('promoción por horario (happy hour) sólo dentro del horario', () => {
    const happyHour = promo('pr_hh', { schedule: [{ days: [1, 2, 3, 4, 5], from: '17:00', to: '19:00' }] });
    expect(resolve({ promotions: [happyHour] })).toMatchObject({ list: mxn(8000), final: mxn(6400), appliedPromotionIds: ['pr_hh'] });
    const later = new Date('2026-09-09T02:00:00Z'); // 20:00 hora local
    expect(resolve({ promotions: [happyHour], now: later })).toMatchObject({ final: mxn(8000), appliedPromotionIds: [] });
  });

  it('respeta ventana, alcance, franquicia, productos y estado', () => {
    expect(resolve({ promotions: [promo('p', { window: { start: '2026-10-01T00:00:00Z', end: '2026-10-31T00:00:00Z' } })] }).final).toEqual(mxn(8000));
    expect(resolve({ promotions: [promo('p', { scope: scope.franchise(FR_BAJIO) })] }).final).toEqual(mxn(8000));
    expect(resolve({ promotions: [promo('p', { franchiseId: FR_BAJIO })] }).final).toEqual(mxn(8000));
    expect(resolve({ promotions: [promo('p', { productIds: ['prd_otro'] })] }).final).toEqual(mxn(8000));
    expect(resolve({ promotions: [promo('p', { status: 'draft' })] }).final).toEqual(mxn(8000));
    expect(resolve({ promotions: [promo('p', { type: 'code', code: 'HOLA' })] }).final).toEqual(mxn(8000));
    expect(resolve({ promotions: [promo('p', { scope: scope.location(LOC_N1), productIds: ['prd_doc'] })] }).final).toEqual(mxn(6400));
  });

  it('las promociones se acumulan por prioridad y sólo se registran las que cambian el precio', () => {
    const fixed = promo('p_fixed', { type: 'fixed_discount', value: 1000, priority: 10 });
    const percent = promo('p_pct', { type: 'percent_discount', value: 50, priority: 1 });
    const noop = promo('p_noop', { type: 'second_print', value: 50, priority: 100 });
    expect(resolve({ promotions: [percent, fixed, noop] })).toMatchObject({ final: mxn(3500), appliedPromotionIds: ['p_fixed', 'p_pct'] });
    expect(resolve({ promotions: [promo('p_free', { type: 'free' })] })).toMatchObject({ final: mxn(0), appliedPromotionIds: ['p_free'] });
  });

  it('modo de negocio distinto de paid: final 0 con la lista intacta', () => {
    for (const mode of ['free_sponsored', 'demo', 'courtesy', 'included', 'promotional', 'internal']) {
      expect(resolve({ businessMode: mode, promotions: [promo('p')] }), mode).toMatchObject({ list: mxn(8000), final: mxn(0), appliedPromotionIds: [] });
    }
  });

  it('la campaña activa con sobrescritura es la última palabra', () => {
    const campaign = Campaign.parse({
      id: 'cmp_1',
      organizationId: ORG,
      name: { es: 'Regreso a clases' },
      startsAt: '2026-09-01T00:00:00Z',
      endsAt: '2026-09-30T00:00:00Z',
      targets: { scopes: [scope.franchise(FR_NORTE)] },
      priceOverrides: [{ productId: 'prd_doc', price: mxn(5000) }],
      status: 'scheduled',
      createdAt: AT,
    });
    expect(resolve({ campaigns: [campaign], promotions: [promo('p')] })).toMatchObject({ list: mxn(8000), final: mxn(5000), appliedPromotionIds: [] });
    expect(resolve({ campaigns: [{ ...campaign, status: 'cancelled' }] }).final).toEqual(mxn(8000));
    expect(resolve({ campaigns: [{ ...campaign, targets: { scopes: [scope.franchise(FR_BAJIO)], tags: [] } }] }).final).toEqual(mxn(8000));
    expect(resolve({ campaigns: [{ ...campaign, endsAt: '2026-09-08T00:00:00Z' }] }).final).toEqual(mxn(8000));
    const stronger = { ...campaign, id: 'cmp_2', priority: 5, priceOverrides: [{ productId: 'prd_doc', price: mxn(4500) }] };
    expect(resolve({ campaigns: [campaign, stronger] }).final).toEqual(mxn(4500));
  });
});

describe('applyPromotion', () => {
  it('aplica cada tipo sobre unidades menores sin bajar de cero', () => {
    const list = mxn(8000);
    expect(applyPromotion(list, promo('a', { type: 'fixed_discount', value: 9000 }))).toEqual(mxn(0));
    expect(applyPromotion(list, promo('b', { type: 'percent_discount', value: 12.5 }))).toEqual(mxn(7000));
    expect(applyPromotion(list, promo('c', { type: 'promo_price', promoPrice: mxn(4990) }))).toEqual(mxn(4990));
    expect(applyPromotion(list, promo('c2', { type: 'promo_price', promoPrice: { amount: 10, currency: 'USD' } }))).toEqual(list);
    expect(applyPromotion(list, promo('d', { type: 'free' }))).toEqual(mxn(0));
    expect(applyPromotion(list, promo('e', { type: 'bundle', value: 50 }))).toEqual(list);
    expect(applyPromotion(list, promo('f', { type: 'schedule', value: 25 }))).toEqual(mxn(6000));
    expect(applyPromotion(list, promo('g', { type: 'date', promoPrice: mxn(100) }))).toEqual(mxn(100));
    expect(applyPromotion(list, promo('h', { type: 'local', value: undefined }))).toEqual(list);
  });
});

describe('validatePriceRule', () => {
  const org = rule('r_org', scope.organization(ORG), 8000, { lock: { policy: 'range', min: mxn(7000), max: mxn(9000) } });
  it('respeta los bloqueos del padre y valida la propia regla', () => {
    expect(validatePriceRule(rule('r', scope.franchise(FR_NORTE), 7500), [org])).toEqual({ ok: true });
    expect(validatePriceRule(rule('r', scope.franchise(FR_NORTE), 6000), [org])).toEqual({ ok: false, reason: `below_min:organization:${ORG}` });
    expect(validatePriceRule(rule('r', scope.machine('mch_n1'), 9500), [org])).toEqual({ ok: false, reason: `above_max:organization:${ORG}` });
    const mandatory = rule('r_fr', scope.franchise(FR_NORTE), 7500, { lock: { policy: 'mandatory' } });
    expect(validatePriceRule(rule('r', scope.machine('mch_n1'), 7500), [org, mandatory])).toEqual({ ok: false, reason: `locked_mandatory:franchise:${FR_NORTE}` });
    // Una regla del mismo nivel o inferior no es padre.
    expect(validatePriceRule(rule('r', scope.franchise(FR_NORTE), 7500), [mandatory, rule('r_m', scope.machine('mch_n1'), 1, { lock: { policy: 'mandatory' } })])).toEqual({ ok: true });
    expect(validatePriceRule(rule('r', scope.machine('mch_n1'), -1), [])).toEqual({ ok: false, reason: 'invalid_amount' });
    expect(validatePriceRule(rule('r', scope.machine('mch_n1'), 100, { schedule: [{ days: [1], from: '25:00', to: '10:00' }] }), [])).toEqual({ ok: false, reason: 'invalid_schedule' });
    expect(validatePriceRule(rule('r', scope.machine('mch_n1'), 100, { season: { start: '2026-12-31T00:00:00Z', end: '2026-12-01T00:00:00Z' } }), [])).toEqual({ ok: false, reason: 'invalid_season' });
    expect(validatePriceRule(rule('r', scope.machine('mch_n1'), 100, { price: { amount: 100, currency: 'USD' } }), [org])).toEqual({ ok: false, reason: 'currency_mismatch' });
  });
});
