import type { Money, PaymentState } from '@psp/contracts';
import { InvalidTransitionError } from '../errors';
import type { PaymentTerminalStatus } from '../types';

/** Eventos que mueven un pago de un estado a otro. */
export type PaymentEvent =
  | 'start'
  | 'approve'
  | 'decline'
  | 'cancel'
  | 'expire'
  | 'review'
  | 'device_out'
  | 'device_ok'
  | 'retry';

export const PAYMENT_EVENTS: readonly PaymentEvent[] = [
  'start',
  'approve',
  'decline',
  'cancel',
  'expire',
  'review',
  'device_out',
  'device_ok',
  'retry',
];

type Transitions = Readonly<Partial<Record<PaymentEvent, PaymentState>>>;

/** Salidas comunes de `awaiting` e `initiated`. */
const PENDING: Transitions = {
  approve: 'approved',
  decline: 'declined',
  cancel: 'cancelled',
  expire: 'expired',
  review: 'under_review',
  device_out: 'device_out_of_service',
};

/**
 * Tabla de transiciones (requisito 10.3). Todo lo que no aparece aquí es inválido.
 * La tabla es pura y vive fuera de los adaptadores: cada terminal la usa, nunca la redefine.
 */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentState, Transitions>> = {
  not_required: {},
  awaiting: { start: 'initiated', ...PENDING },
  initiated: { ...PENDING },
  approved: {},
  declined: { retry: 'awaiting' },
  cancelled: { retry: 'awaiting' },
  expired: { retry: 'awaiting' },
  under_review: { approve: 'approved', decline: 'declined' },
  unavailable: { device_ok: 'awaiting' },
  device_out_of_service: { device_ok: 'awaiting' },
  free: {},
  demo: {},
  operator_started: {},
};

/** Estados sin salida: la sesión ya no vuelve a tocar el pago. */
export const TERMINAL_PAYMENT_STATES: readonly PaymentState[] = [
  'not_required',
  'free',
  'demo',
  'operator_started',
  'approved',
];

/** Estados en los que un intent sigue vivo y puede cambiar. */
export const ACTIVE_PAYMENT_STATES: readonly PaymentState[] = [
  'awaiting',
  'initiated',
  'under_review',
  'device_out_of_service',
];

/** Estados que permiten a la sesión avanzar más allá de `awaiting_payment`. */
export const SETTLED_PAYMENT_STATES: readonly PaymentState[] = [
  'approved',
  'not_required',
  'free',
  'demo',
  'operator_started',
];

export function isTerminalPaymentState(state: PaymentState): boolean {
  return TERMINAL_PAYMENT_STATES.includes(state);
}

export function isActivePaymentState(state: PaymentState): boolean {
  return ACTIVE_PAYMENT_STATES.includes(state);
}

export function paymentAllowsProgress(state: PaymentState): boolean {
  return SETTLED_PAYMENT_STATES.includes(state);
}

export function canTransitionPayment(state: PaymentState, event: PaymentEvent): boolean {
  return PAYMENT_TRANSITIONS[state]?.[event] !== undefined;
}

/** Devuelve el siguiente estado o lanza `InvalidTransitionError` si la pareja no está en la tabla. */
export function nextPaymentState(state: PaymentState, event: PaymentEvent): PaymentState {
  const next = PAYMENT_TRANSITIONS[state]?.[event];
  if (next === undefined) throw new InvalidTransitionError(state, event);
  return next;
}

export interface InitialPaymentInput {
  /** Valor de `payment.businessMode` (requisito 42). */
  businessMode: string;
  isDemo: boolean;
  operatorStarted: boolean;
  terminalStatus: PaymentTerminalStatus;
  amount: Money;
}

/** Modos de negocio en los que el pago no forma parte del flujo (requisito 42). */
const NOT_REQUIRED_MODES: readonly string[] = ['internal', 'included'];

/**
 * Estado de pago con el que nace una sesión. Orden de precedencia:
 * demo → operador → modo sin pago → gratuito → estado del terminal → esperando pago.
 */
export function initialPaymentState(input: InitialPaymentInput): PaymentState {
  const { businessMode, isDemo, operatorStarted, terminalStatus, amount } = input;
  if (isDemo || businessMode === 'demo') return 'demo';
  if (operatorStarted) return 'operator_started';
  if (NOT_REQUIRED_MODES.includes(businessMode)) return 'not_required';
  if (businessMode !== 'paid' || amount.amount <= 0) return 'free';
  switch (terminalStatus) {
    case 'not_configured':
      return 'unavailable';
    case 'out_of_service':
    case 'offline':
      return 'device_out_of_service';
    default:
      return 'awaiting';
  }
}
