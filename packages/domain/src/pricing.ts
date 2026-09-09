/**
 * Precios y promociones (requisito 10): herencia de reglas por alcance con bloqueos del nivel
 * superior, promociones por ventana/horario/alcance y sobrescrituras de precio de campañas.
 * Dinero siempre en unidades menores enteras.
 */
import type { Campaign, Money, PriceRule, Product, Promotion, ResolvedPrice, Scope } from '@psp/contracts';
import { SCOPE_LEVEL_RANK, sameScope, scopeKey } from './hierarchy';
import { hhmmToMinutes, scheduleMatches, windowMatches } from './time';

function depthOf(scope: Scope, chain: Scope[]): number {
  return chain.findIndex((s) => sameScope(s, scope));
}

function chainHasFranchise(chain: Scope[], franchiseId: string | undefined): boolean {
  return franchiseId === undefined || chain.some((s) => s.level === 'franchise' && s.id === franchiseId);
}

/** Orden determinista: prioridad descendente, luego actualización más reciente, luego id. */
function byPriorityDesc<T extends { priority: number; id: string; updatedAt?: string }>(a: T, b: T): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const ua = a.updatedAt ?? '';
  const ub = b.updatedAt ?? '';
  if (ua !== ub) return ua < ub ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function percentOff(list: Money, percent: number | undefined): Money {
  const clamped = Math.min(100, Math.max(0, percent ?? 0));
  const discount = Math.round((list.amount * clamped) / 100);
  return { amount: Math.max(0, list.amount - discount), currency: list.currency };
}

function promoPriceOf(list: Money, promo: Promotion): Money | undefined {
  if (promo.promoPrice === undefined || promo.promoPrice.currency !== list.currency) return undefined;
  return { amount: Math.max(0, promo.promoPrice.amount), currency: list.currency };
}

/**
 * Aplica una promoción a un precio unitario. `second_print` y `bundle` no cambian el precio
 * unitario (se resuelven al componer el pedido). Tipos por horario/fecha/local/código usan
 * `promoPrice` si existe y, si no, `value` como porcentaje.
 */
export function applyPromotion(list: Money, promo: Promotion): Money {
  switch (promo.type) {
    case 'free':
      return { amount: 0, currency: list.currency };
    case 'fixed_discount':
      return { amount: Math.max(0, list.amount - Math.max(0, Math.round(promo.value ?? 0))), currency: list.currency };
    case 'percent_discount':
      return percentOff(list, promo.value);
    case 'promo_price':
      return promoPriceOf(list, promo) ?? list;
    case 'second_print':
    case 'bundle':
      return list;
    default:
      return promoPriceOf(list, promo) ?? (promo.value !== undefined ? percentOff(list, promo.value) : list);
  }
}

/** Tipos que no se aplican solos al precio unitario: código manual, bundle y segunda impresión. */
const NOT_AUTOMATIC = new Set<Promotion['type']>(['code', 'bundle', 'second_print']);

/** ¿La promoción aplica a este producto, en esta cadena y en este instante? */
export function isPromotionApplicable(promo: Promotion, product: Product, chain: Scope[], now: Date, timezone: string): boolean {
  if (promo.status !== 'active') return false;
  if (NOT_AUTOMATIC.has(promo.type)) return false;
  if (promo.organizationId !== product.organizationId) return false;
  if (!chainHasFranchise(chain, promo.franchiseId)) return false;
  if (depthOf(promo.scope, chain) < 0) return false;
  if (!windowMatches(promo.window, now)) return false;
  if (!scheduleMatches(promo.schedule ?? [], now, timezone)) return false;
  return promo.productIds.length === 0 || promo.productIds.includes(product.id);
}

/**
 * Campaña activa para esta cadena: por fecha local (`scheduled` o `active` dentro de su ventana),
 * de la misma organización, y dirigida a algún alcance de la cadena (sin alcances = toda la organización).
 * Las etiquetas de máquina no se evalúan aquí (requiere la máquina, que no forma parte del insumo).
 */
export function isCampaignActive(campaign: Campaign, product: Product, chain: Scope[], now: Date): boolean {
  if (campaign.status !== 'active' && campaign.status !== 'scheduled') return false;
  if (campaign.organizationId !== product.organizationId) return false;
  if (!chainHasFranchise(chain, campaign.franchiseId)) return false;
  if (!windowMatches({ start: campaign.startsAt, end: campaign.endsAt }, now)) return false;
  const scopes = campaign.targets?.scopes ?? [];
  return scopes.length === 0 || scopes.some((scope) => depthOf(scope, chain) >= 0);
}

/**
 * Resuelve el precio de un producto.
 *
 * 1. Lista: `basePrice` del producto, luego la regla más específica de la cadena (empate por
 *    prioridad). Un bloqueo `mandatory` de un nivel superior descarta las reglas inferiores; con
 *    `range`, una regla inferior fuera del rango se ignora. `lockedBy` señala el bloqueo vigente.
 * 2. `businessMode` distinto de `paid`: final 0 con la lista intacta, sin promociones.
 * 3. Promociones aplicables en orden de prioridad (se acumulan).
 * 4. Sobrescritura de precio de la campaña activa de mayor prioridad: es la última palabra y
 *    reemplaza el resultado de las promociones.
 */
export function resolvePrice(input: {
  product: Product;
  rules: PriceRule[];
  promotions: Promotion[];
  campaigns: Campaign[];
  chain: Scope[];
  now: Date;
  timezone: string;
  businessMode: string;
}): ResolvedPrice {
  const { product, chain, now, timezone } = input;
  const currency = product.basePrice.currency;
  const organizationScope: Scope = chain.find((s) => s.level === 'organization') ?? { level: 'organization', id: product.organizationId };

  let list: Money = product.basePrice;
  let provenance: Scope = organizationScope;
  let appliedRuleId: string | undefined;
  let mandatoryBy: Scope | undefined;
  let rangeBy: Scope | undefined;
  let minAmount: number | undefined;
  let maxAmount: number | undefined;

  const candidates = input.rules
    .filter(
      (rule) =>
        rule.productId === product.id &&
        rule.price.currency === currency &&
        windowMatches(rule.season, now) &&
        scheduleMatches(rule.schedule ?? [], now, timezone),
    )
    .map((rule) => ({ rule, depth: depthOf(rule.scope, chain) }))
    .filter((entry) => entry.depth >= 0);
  const depths = Array.from(new Set(candidates.map((entry) => entry.depth))).sort((a, b) => a - b);

  for (const depth of depths) {
    const winner = candidates
      .filter((entry) => entry.depth === depth)
      .map((entry) => entry.rule)
      .sort(byPriorityDesc)[0];
    if (winner === undefined) continue;
    if (mandatoryBy !== undefined) continue; // el padre manda: la regla inferior se ignora
    const outOfRange =
      (minAmount !== undefined && winner.price.amount < minAmount) || (maxAmount !== undefined && winner.price.amount > maxAmount);
    if (outOfRange) continue;

    list = winner.price;
    provenance = winner.scope;
    appliedRuleId = winner.id;
    if (winner.lock?.policy === 'mandatory') {
      mandatoryBy = winner.scope;
    } else if (winner.lock?.policy === 'range') {
      rangeBy = winner.scope;
      const min = winner.lock.min?.currency === currency ? winner.lock.min.amount : undefined;
      const max = winner.lock.max?.currency === currency ? winner.lock.max.amount : undefined;
      if (min !== undefined) minAmount = minAmount === undefined ? min : Math.max(minAmount, min);
      if (max !== undefined) maxAmount = maxAmount === undefined ? max : Math.min(maxAmount, max);
    }
  }

  const lockedBy = mandatoryBy ?? rangeBy;
  const base: ResolvedPrice = {
    productId: product.id,
    list,
    final: list,
    appliedPromotionIds: [],
    provenance,
    ...(appliedRuleId !== undefined ? { appliedRuleId } : {}),
    ...(lockedBy !== undefined ? { lockedBy } : {}),
  };

  if (input.businessMode !== 'paid') return { ...base, final: { amount: 0, currency } };

  let final: Money = list;
  const appliedPromotionIds: string[] = [];
  const promotions = input.promotions.filter((promo) => isPromotionApplicable(promo, product, chain, now, timezone)).sort(byPriorityDesc);
  for (const promo of promotions) {
    const next = applyPromotion(final, promo);
    if (next.amount !== final.amount) {
      final = next;
      appliedPromotionIds.push(promo.id);
    }
  }

  const campaign = input.campaigns
    .filter((c) => isCampaignActive(c, product, chain, now) && c.priceOverrides.some((o) => o.productId === product.id))
    .sort(byPriorityDesc)[0];
  const override = campaign?.priceOverrides.find((o) => o.productId === product.id);
  if (override !== undefined && override.price.currency === currency) {
    return { ...base, final: { amount: Math.max(0, override.price.amount), currency }, appliedPromotionIds: [] };
  }

  return { ...base, final, appliedPromotionIds };
}

/**
 * Valida una regla frente a las reglas de niveles superiores del mismo producto.
 * `reason` es un código estable para la UI: `invalid_amount`, `invalid_schedule`, `invalid_season`,
 * `currency_mismatch`, `locked_mandatory:<alcance>`, `below_min:<alcance>`, `above_max:<alcance>`.
 */
export function validatePriceRule(rule: PriceRule, parentRules: PriceRule[]): { ok: boolean; reason?: string } {
  if (!Number.isInteger(rule.price.amount) || rule.price.amount < 0) return { ok: false, reason: 'invalid_amount' };
  for (const schedule of rule.schedule ?? []) {
    if (Number.isNaN(hhmmToMinutes(schedule.from)) || Number.isNaN(hhmmToMinutes(schedule.to))) {
      return { ok: false, reason: 'invalid_schedule' };
    }
  }
  if (rule.season !== undefined) {
    const start = Date.parse(rule.season.start);
    const end = Date.parse(rule.season.end);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) return { ok: false, reason: 'invalid_season' };
  }
  const parents = parentRules.filter(
    (parent) => parent.productId === rule.productId && SCOPE_LEVEL_RANK[parent.scope.level] < SCOPE_LEVEL_RANK[rule.scope.level],
  );
  for (const parent of parents.sort((a, b) => SCOPE_LEVEL_RANK[a.scope.level] - SCOPE_LEVEL_RANK[b.scope.level])) {
    if (parent.price.currency !== rule.price.currency) return { ok: false, reason: 'currency_mismatch' };
    if (parent.lock?.policy === 'mandatory') return { ok: false, reason: `locked_mandatory:${scopeKey(parent.scope)}` };
    if (parent.lock?.policy === 'range') {
      if (parent.lock.min !== undefined && rule.price.amount < parent.lock.min.amount) {
        return { ok: false, reason: `below_min:${scopeKey(parent.scope)}` };
      }
      if (parent.lock.max !== undefined && rule.price.amount > parent.lock.max.amount) {
        return { ok: false, reason: `above_max:${scopeKey(parent.scope)}` };
      }
    }
  }
  return { ok: true };
}
