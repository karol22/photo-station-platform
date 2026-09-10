import { CONFIG_KEY_INDEX, PaymentState as PaymentStateSchema } from '@psp/contracts';
import type { PaymentState } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { InvalidTransitionError } from '../errors';
import type { PaymentTerminalStatus } from '../types';
import {
  ACTIVE_PAYMENT_STATES,
  PAYMENT_EVENTS,
  PAYMENT_TRANSITIONS,
  SETTLED_PAYMENT_STATES,
  TERMINAL_PAYMENT_STATES,
  canTransitionPayment,
  initialPaymentState,
  isActivePaymentState,
  isTerminalPaymentState,
  nextPaymentState,
  paymentAllowsProgress,
  type PaymentEvent,
} from './state-machine';

/** Tabla del requisito 10.3 escrita a mano: la implementación se compara contra ella, no contra sí misma. */
const VALID: Array<[PaymentState, PaymentEvent, PaymentState]> = [
  ['awaiting', 'start', 'initiated'],
  ['awaiting', 'approve', 'approved'],
  ['initiated', 'approve', 'approved'],
  ['awaiting', 'decline', 'declined'],
  ['initiated', 'decline', 'declined'],
  ['awaiting', 'cancel', 'cancelled'],
  ['initiated', 'cancel', 'cancelled'],
  ['awaiting', 'expire', 'expired'],
  ['initiated', 'expire', 'expired'],
  ['awaiting', 'review', 'under_review'],
  ['initiated', 'review', 'under_review'],
  ['under_review', 'approve', 'approved'],
  ['under_review', 'decline', 'declined'],
  ['awaiting', 'device_out', 'device_out_of_service'],
  ['initiated', 'device_out', 'device_out_of_service'],
  ['device_out_of_service', 'device_ok', 'awaiting'],
  ['declined', 'retry', 'awaiting'],
  ['expired', 'retry', 'awaiting'],
  ['cancelled', 'retry', 'awaiting'],
  ['unavailable', 'device_ok', 'awaiting'],
];

describe('nextPaymentState: tabla completa', () => {
  it.each(VALID)('%s + %s → %s', (from, event, to) => {
    expect(nextPaymentState(from, event)).toBe(to);
    expect(canTransitionPayment(from, event)).toBe(true);
  });

  it('rechaza toda combinación fuera de la tabla', () => {
    const allowed = new Set(VALID.map(([from, event]) => `${from}+${event}`));
    let rejected = 0;
    for (const state of PaymentStateSchema.options) {
      for (const event of PAYMENT_EVENTS) {
        if (allowed.has(`${state}+${event}`)) continue;
        expect(() => nextPaymentState(state, event), `${state} + ${event}`).toThrow(InvalidTransitionError);
        expect(canTransitionPayment(state, event)).toBe(false);
        rejected += 1;
      }
    }
    expect(rejected).toBe(PaymentStateSchema.options.length * PAYMENT_EVENTS.length - VALID.length);
  });

  it('la tabla exportada contiene exactamente las transiciones válidas', () => {
    const flattened = Object.entries(PAYMENT_TRANSITIONS).flatMap(([from, events]) =>
      Object.entries(events).map(([event, to]) => `${from}+${event}→${to}`),
    );
    expect(new Set(flattened)).toEqual(new Set(VALID.map(([f, e, t]) => `${f}+${e}→${t}`)));
  });

  it('los estados terminales no tienen salida y los demás sí', () => {
    for (const state of PaymentStateSchema.options) {
      const outgoing = Object.keys(PAYMENT_TRANSITIONS[state]).length;
      expect(isTerminalPaymentState(state), state).toBe(outgoing === 0);
    }
    expect(TERMINAL_PAYMENT_STATES).toEqual(
      expect.arrayContaining(['not_required', 'free', 'demo', 'operator_started', 'approved']),
    );
  });

  it('estados activos y liquidados son disjuntos', () => {
    for (const state of ACTIVE_PAYMENT_STATES) expect(isActivePaymentState(state)).toBe(true);
    for (const state of SETTLED_PAYMENT_STATES) {
      expect(paymentAllowsProgress(state)).toBe(true);
      expect(isActivePaymentState(state)).toBe(false);
    }
    expect(paymentAllowsProgress('declined')).toBe(false);
  });

  it('el error lleva code, from y event; un estado desconocido también lanza', () => {
    expect(() => nextPaymentState('nope' as PaymentState, 'start')).toThrow(InvalidTransitionError);
    let caught: unknown;
    try {
      nextPaymentState('approved', 'start');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidTransitionError);
    const err = caught as InvalidTransitionError;
    expect(err.code).toBe('invalid_transition');
    expect(err.from).toBe('approved');
    expect(err.event).toBe('start');
    expect(err.name).toBe('InvalidTransitionError');
  });
});

describe('initialPaymentState', () => {
  const base = {
    isDemo: false,
    operatorStarted: false,
    terminalStatus: 'ready' as PaymentTerminalStatus,
    amount: { amount: 8000, currency: 'MXN' },
  };
  const MODES: Array<[string, PaymentState]> = [
    ['paid', 'awaiting'],
    ['free_sponsored', 'free'],
    ['demo', 'demo'],
    ['courtesy', 'free'],
    ['included', 'not_required'],
    ['promotional', 'free'],
    ['internal', 'not_required'],
  ];

  it.each(MODES)('modo de negocio %s → %s', (businessMode, expected) => {
    expect(initialPaymentState({ ...base, businessMode })).toBe(expected);
  });

  it('cubre todos los valores de payment.businessMode del contrato', () => {
    const definition = CONFIG_KEY_INDEX['payment.businessMode'];
    expect(definition?.enumValues).toBeDefined();
    expect(new Set(definition?.enumValues)).toEqual(new Set(MODES.map(([mode]) => mode)));
  });

  it('demo tiene prioridad sobre operador, modo y terminal', () => {
    expect(
      initialPaymentState({ ...base, businessMode: 'paid', isDemo: true, operatorStarted: true, terminalStatus: 'not_configured' }),
    ).toBe('demo');
  });

  it('operador tiene prioridad sobre el modo de negocio y el terminal', () => {
    expect(initialPaymentState({ ...base, businessMode: 'internal', operatorStarted: true })).toBe('operator_started');
    expect(initialPaymentState({ ...base, businessMode: 'paid', operatorStarted: true, terminalStatus: 'offline' })).toBe(
      'operator_started',
    );
  });

  it('monto cero en modo de pago → free', () => {
    expect(initialPaymentState({ ...base, businessMode: 'paid', amount: { amount: 0, currency: 'MXN' } })).toBe('free');
  });

  it('terminal not_configured → unavailable', () => {
    expect(initialPaymentState({ ...base, businessMode: 'paid', terminalStatus: 'not_configured' })).toBe('unavailable');
  });

  it.each(['out_of_service', 'offline'] as const)('terminal %s → device_out_of_service', (terminalStatus) => {
    expect(initialPaymentState({ ...base, businessMode: 'paid', terminalStatus })).toBe('device_out_of_service');
  });

  it('terminal busy → awaiting', () => {
    expect(initialPaymentState({ ...base, businessMode: 'paid', terminalStatus: 'busy' })).toBe('awaiting');
  });
});
