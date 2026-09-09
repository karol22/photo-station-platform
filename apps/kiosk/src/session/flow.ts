/**
 * Máquina de navegación del kiosco: etapa de sesión ↔ pantalla. Pura, probada en Node.
 * La lista de etapas sale de `stagesForProduct` (@psp/domain); aquí sólo se decide la siguiente
 * y la ruta que la muestra.
 */
import type { KioskBundle, Product, ResolvedPrice, RetentionPolicy, SessionStage, StationSession, StationStatus } from '@psp/contracts';
import { stagesForProduct } from '@psp/domain';

/** Valores efectivos: el bundle real o un recorte en pruebas. */
type ConfigSource = { effective: { values: Record<string, unknown> } };

export const ROUTES = {
  attract: '/',
  group: '/quienes',
  home: '/home',
  product: '/product/:productId',
  consent: '/session/consent',
  payment: '/session/payment',
  capture: '/session/capture',
  review: '/session/review',
  edit: '/session/edit',
  select: '/session/select',
  compose: '/session/compose',
  confirm: '/session/confirm',
  print: '/session/print',
  finish: '/session/finish',
  error: '/error',
  tech: '/tech',
} as const;

export function productRoute(productId: string): string {
  return `/product/${encodeURIComponent(productId)}`;
}

export interface FlowOptions {
  paymentRequired: boolean;
  consentRequired: boolean;
}

/** Pantalla que corresponde a cada etapa (recuperación tras recarga y avance normal). */
export function screenForStage(stage: SessionStage, product?: Pick<Product, 'id'>): string {
  switch (stage) {
    case 'started':
    case 'product_selected':
    case 'configuring':
      return product ? productRoute(product.id) : ROUTES.home;
    case 'consent':
      return ROUTES.consent;
    case 'awaiting_payment':
      return ROUTES.payment;
    case 'capturing':
      return ROUTES.capture;
    case 'reviewing':
      return ROUTES.review;
    case 'editing':
      return ROUTES.edit;
    case 'selecting':
      return ROUTES.select;
    case 'composing':
      return ROUTES.compose;
    case 'confirming':
      return ROUTES.confirm;
    case 'printing':
      return ROUTES.print;
    case 'delivering':
    case 'finishing':
    case 'done':
      return ROUTES.finish;
    case 'failed':
      return ROUTES.error;
    case 'cancelled':
    case 'expired':
    case 'abandoned':
      return ROUTES.attract;
    default:
      return ROUTES.attract;
  }
}

/** Siguiente etapa del producto después de `current`; `undefined` cuando ya no hay más. */
export function nextStage(product: Product, current: SessionStage, opts: FlowOptions): SessionStage | undefined {
  const stages = stagesForProduct(product, opts);
  const index = stages.indexOf(current);
  if (index < 0) {
    // Etapa fuera del plan (p. ej. consentimiento omitido): salta a la primera posterior en orden canónico.
    const order = CANONICAL_ORDER.indexOf(current);
    return stages.find((s) => CANONICAL_ORDER.indexOf(s) > order);
  }
  return stages[index + 1];
}

/** Primera etapa "de trabajo" tras crear la sesión (consentimiento, pago o captura). */
export function firstWorkingStage(product: Product, opts: FlowOptions): SessionStage {
  return nextStage(product, 'configuring', opts) ?? 'capturing';
}

/** Siguiente pantalla a mostrar tras completar `current`. */
export function nextScreen(product: Product, current: SessionStage, opts: FlowOptions): string {
  const stage = nextStage(product, current, opts);
  return stage ? screenForStage(stage, product) : ROUTES.finish;
}

const CANONICAL_ORDER: SessionStage[] = [
  'started', 'product_selected', 'configuring', 'consent', 'awaiting_payment', 'capturing', 'reviewing', 'editing',
  'selecting', 'composing', 'confirming', 'printing', 'delivering', 'finishing', 'done',
];

/** ¿Hay que cobrar? Sólo en modo `paid`, con precio final > 0 y fuera de demo. */
export function paymentRequired(input: {
  product: Pick<Product, 'id' | 'basePrice'>;
  bundle: (ConfigSource & { prices: Array<Pick<ResolvedPrice, 'productId' | 'final'>> }) | undefined;
  status?: Pick<StationStatus, 'demoMode'> | undefined;
  isDemo?: boolean;
}): boolean {
  const mode = input.bundle?.effective.values['payment.businessMode'];
  if (mode !== undefined && mode !== 'paid') return false;
  if (input.status?.demoMode || input.isDemo) return false;
  const price = input.bundle?.prices.find((p) => p.productId === input.product.id);
  const amount = price ? price.final.amount : input.product.basePrice.amount;
  return amount > 0;
}

/**
 * ¿Hace falta pantalla de consentimiento? Cuando el producto trae términos/privacidad propios, la
 * política de retención saca datos del dispositivo, o la experiencia es de IA (requisito 23.2).
 */
export function consentRequired(input: {
  product: Pick<Product, 'kind' | 'terms' | 'privacyNote' | 'retentionPolicyId'>;
  bundle: (ConfigSource & { retentionPolicies: Array<Pick<RetentionPolicy, 'id' | 'leavesDevice'>> }) | undefined;
}): boolean {
  const { product, bundle } = input;
  if (product.kind === 'ai') return true;
  if (product.terms || product.privacyNote) return true;
  const policyId = product.retentionPolicyId ?? bundle?.effective.values['privacy.defaultRetentionPolicyId'];
  const policy = bundle?.retentionPolicies.find((p) => p.id === policyId);
  return policy?.leavesDevice === true;
}

export function flowOptionsFor(input: {
  product: Product;
  bundle: KioskBundle | undefined;
  status: StationStatus | undefined;
  session?: Pick<StationSession, 'isDemo'> | undefined;
}): FlowOptions {
  return {
    paymentRequired: paymentRequired({ product: input.product, bundle: input.bundle, status: input.status, isDemo: input.session?.isDemo ?? false }),
    consentRequired: consentRequired({ product: input.product, bundle: input.bundle }),
  };
}

/** Retakes que quedan para la foto en curso o la sesión, según la política del producto. */
export function retakesLeft(product: Pick<Product, 'retakes'>, session: Pick<StationSession, 'retakesUsed' | 'captures'>, captureIndex?: number): number {
  const { retakes } = product;
  if (retakes.perPhoto && captureIndex !== undefined) {
    const usedForPhoto = session.captures.filter((c) => c.index === captureIndex && c.retakeOf).length;
    return Math.max(0, retakes.max - usedForPhoto);
  }
  return Math.max(0, retakes.max - session.retakesUsed);
}
