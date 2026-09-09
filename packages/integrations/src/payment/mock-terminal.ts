import type { Id, PaymentIntent } from '@psp/contracts';
import { Money as MoneySchema } from '@psp/contracts';
import { IntegrationError, InvalidTransitionError, NotFoundError, ValidationError } from '../errors';
import type { Clock, IdFactory, IntegrationDeps } from '../support';
import { toTimestamp } from '../support';
import type { PaymentOutcome, PaymentTerminalStatus } from '../types';
import { paymentMessage } from './messages';
import type { PaymentIntentInput, PaymentTerminal } from './port';
import {
  canTransitionPayment,
  isActivePaymentState,
  nextPaymentState,
  type PaymentEvent,
} from './state-machine';

/** Resultado que el mock aplica solo tras `autoDelayMs` (o en el siguiente `tick`). */
export type AutoOutcome = 'none' | 'approve' | 'decline';

export interface MockPaymentTerminalOptions extends IntegrationDeps {
  autoOutcome?: AutoOutcome;
  /** Con valor, el resultado automático usa `setTimeout`; sin valor, se aplica en `tick()`. */
  autoDelayMs?: number;
  initialStatus?: PaymentTerminalStatus;
}

type Listener = (intent: PaymentIntent) => void;
type TimerHandle = ReturnType<typeof setTimeout>;

const DEVICE_DOWN: readonly PaymentTerminalStatus[] = ['out_of_service', 'offline'];
const AUTO_ELIGIBLE: readonly PaymentIntent['state'][] = ['awaiting', 'initiated'];

/**
 * Terminal de pago simulado y controlable (panel técnico, admin, CLI).
 * - Cada intent nace en `awaiting` con `expiresAt = now + timeoutSec`.
 * - Mientras un intent de la sesión sigue activo, `createIntent` devuelve ese mismo intent (idempotente).
 * - `simulate` aplica la tabla de `state-machine.ts`; `tick(now)` vence intents sin timers reales.
 * - `onUpdate` notifica la creación y cada transición.
 */
export class MockPaymentTerminal implements PaymentTerminal {
  readonly adapter = 'mock';

  readonly #clock: Clock;
  readonly #ids: IdFactory;
  readonly #autoOutcome: AutoOutcome;
  readonly #autoDelayMs: number | undefined;
  readonly #intents = new Map<Id, PaymentIntent>();
  readonly #timeoutSec = new Map<Id, number>();
  readonly #autoDue = new Map<Id, number>();
  readonly #timers = new Map<Id, TimerHandle>();
  readonly #listeners = new Set<Listener>();
  #device: PaymentTerminalStatus;
  #disposed = false;

  constructor(opts: MockPaymentTerminalOptions) {
    this.#clock = opts.clock;
    this.#ids = opts.idFactory;
    this.#autoOutcome = opts.autoOutcome ?? 'none';
    this.#autoDelayMs = opts.autoDelayMs;
    this.#device = opts.initialStatus ?? 'ready';
  }

  /** Estado del dispositivo; `busy` mientras hay un intent esperando, iniciado o en revisión. */
  status(): PaymentTerminalStatus {
    if (this.#device !== 'ready') return this.#device;
    for (const intent of this.#intents.values()) {
      if (isActivePaymentState(intent.state) && intent.state !== 'device_out_of_service') return 'busy';
    }
    return 'ready';
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    this.#assertLive();
    if (!input.sessionId) throw new ValidationError('sessionId is required');
    if (!MoneySchema.safeParse(input.amount).success || input.amount.amount <= 0) {
      throw new ValidationError('amount must be a positive integer in minor units with a 3-letter currency');
    }
    if (!Number.isFinite(input.timeoutSec) || input.timeoutSec <= 0) {
      throw new ValidationError('timeoutSec must be greater than 0');
    }
    const active = this.#activeFor(input.sessionId);
    if (active) return active;

    const now = this.#clock();
    const at = toTimestamp(now);
    const intent: PaymentIntent = {
      id: this.#ids(),
      sessionId: input.sessionId,
      amount: { ...input.amount },
      state: 'awaiting',
      adapter: this.adapter,
      message: paymentMessage('awaiting'),
      createdAt: at,
      updatedAt: at,
      expiresAt: toTimestamp(new Date(now.getTime() + input.timeoutSec * 1000)),
    };
    this.#intents.set(intent.id, intent);
    this.#timeoutSec.set(intent.id, input.timeoutSec);
    this.#emit(intent);
    if (DEVICE_DOWN.includes(this.#device)) return this.#apply(intent.id, 'device_out');
    this.#armAuto(intent.id, now);
    return this.#require(intent.id);
  }

  /** Cancela el intent; cancelar dos veces es idempotente. Desde `approved` lanza `InvalidTransitionError`. */
  async cancel(intentId: Id): Promise<PaymentIntent> {
    this.#assertLive();
    const intent = this.#require(intentId);
    if (intent.state === 'cancelled') return intent;
    this.#disarmAuto(intentId);
    return this.#apply(intentId, 'cancel');
  }

  /** Vuelve a `awaiting` desde `declined`, `expired` o `cancelled` con un vencimiento nuevo. */
  async retry(intentId: Id): Promise<PaymentIntent> {
    this.#assertLive();
    const now = this.#clock();
    const timeoutSec = this.#timeoutSec.get(intentId) ?? 0;
    this.#apply(intentId, 'retry', {
      ref: undefined,
      expiresAt: toTimestamp(new Date(now.getTime() + timeoutSec * 1000)),
    });
    if (DEVICE_DOWN.includes(this.#device)) return this.#apply(intentId, 'device_out');
    this.#armAuto(intentId, now);
    return this.#require(intentId);
  }

  get(intentId: Id): PaymentIntent | undefined {
    return this.#intents.get(intentId);
  }

  list(): PaymentIntent[] {
    return [...this.#intents.values()];
  }

  onUpdate(cb: Listener): () => void {
    this.#listeners.add(cb);
    return () => {
      this.#listeners.delete(cb);
    };
  }

  async simulate(intentId: Id, outcome: PaymentOutcome): Promise<PaymentIntent> {
    this.#assertLive();
    const intent = this.#require(intentId);
    switch (outcome) {
      case 'approve':
        this.#disarmAuto(intentId);
        if (intent.state === 'awaiting') this.#apply(intentId, 'start');
        return this.#apply(intentId, 'approve');
      case 'decline':
        this.#disarmAuto(intentId);
        return this.#apply(intentId, 'decline');
      case 'cancel':
        return this.cancel(intentId);
      case 'expire':
        this.#disarmAuto(intentId);
        return this.#apply(intentId, 'expire');
      case 'review':
        this.#disarmAuto(intentId);
        return this.#apply(intentId, 'review');
      case 'device_out':
        this.#assertCan(intent, 'device_out');
        this.setDeviceState('out_of_service');
        return this.#require(intentId);
      case 'recover':
        this.#assertCan(intent, 'device_ok');
        this.setDeviceState('ready');
        return this.#require(intentId);
      default:
        throw new ValidationError(`Unknown payment outcome: ${String(outcome)}`);
    }
  }

  /**
   * Cambia el estado del dispositivo y lo propaga: `out_of_service`/`offline` mueven los intents
   * activos a `device_out_of_service` (y cancelan su resultado automático); `ready` los devuelve a `awaiting`.
   */
  setDeviceState(state: PaymentTerminalStatus): void {
    this.#assertLive();
    this.#device = state;
    if (DEVICE_DOWN.includes(state)) {
      for (const intent of [...this.#intents.values()]) {
        if (!canTransitionPayment(intent.state, 'device_out')) continue;
        this.#disarmAuto(intent.id);
        this.#apply(intent.id, 'device_out');
      }
      return;
    }
    if (state === 'ready') {
      for (const intent of [...this.#intents.values()]) {
        if (canTransitionPayment(intent.state, 'device_ok')) this.#apply(intent.id, 'device_ok');
      }
    }
  }

  /** Aplica resultados automáticos vencidos y expira intents con `expiresAt <= now`. Devuelve los que cambian. */
  tick(now: Date = this.#clock()): PaymentIntent[] {
    const t = now.getTime();
    const changed: PaymentIntent[] = [];
    for (const [id, due] of [...this.#autoDue]) {
      if (due > t) continue;
      const next = this.#runAuto(id);
      if (next) changed.push(next);
    }
    for (const intent of [...this.#intents.values()]) {
      if (!intent.expiresAt || Date.parse(intent.expiresAt) > t) continue;
      if (!canTransitionPayment(intent.state, 'expire')) continue;
      this.#disarmAuto(intent.id);
      changed.push(this.#apply(intent.id, 'expire'));
    }
    return changed;
  }

  /** Limpia timers y suscriptores. Los intents quedan para inspección. */
  dispose(): void {
    for (const handle of this.#timers.values()) clearTimeout(handle);
    this.#timers.clear();
    this.#autoDue.clear();
    this.#listeners.clear();
    this.#disposed = true;
  }

  #apply(id: Id, event: PaymentEvent, patch: Partial<PaymentIntent> = {}): PaymentIntent {
    const current = this.#require(id);
    const state = nextPaymentState(current.state, event);
    const next: PaymentIntent = {
      ...current,
      ...patch,
      state,
      message: paymentMessage(state),
      updatedAt: toTimestamp(this.#clock()),
    };
    if (state === 'approved') next.ref = `mock-auth-${id}`;
    this.#intents.set(id, next);
    this.#emit(next);
    return next;
  }

  #armAuto(id: Id, now: Date): void {
    if (this.#autoOutcome === 'none') return;
    const delay = this.#autoDelayMs;
    this.#autoDue.set(id, now.getTime() + (delay ?? 0));
    if (delay === undefined) return;
    const handle = setTimeout(() => {
      try {
        this.#runAuto(id);
      } catch {
        // Un suscriptor lanzó: aquí no hay llamador al que propagar; el estado ya cambió.
      }
    }, delay);
    (handle as { unref?: () => void }).unref?.();
    this.#timers.set(id, handle);
  }

  #disarmAuto(id: Id): void {
    this.#autoDue.delete(id);
    const handle = this.#timers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      this.#timers.delete(id);
    }
  }

  #runAuto(id: Id): PaymentIntent | undefined {
    this.#disarmAuto(id);
    const intent = this.#intents.get(id);
    if (!intent || this.#autoOutcome === 'none' || !AUTO_ELIGIBLE.includes(intent.state)) return undefined;
    if (this.#autoOutcome === 'decline') return this.#apply(id, 'decline');
    if (intent.state === 'awaiting') this.#apply(id, 'start');
    return this.#apply(id, 'approve');
  }

  #activeFor(sessionId: Id): PaymentIntent | undefined {
    for (const intent of this.#intents.values()) {
      if (intent.sessionId === sessionId && isActivePaymentState(intent.state)) return intent;
    }
    return undefined;
  }

  #require(id: Id): PaymentIntent {
    const intent = this.#intents.get(id);
    if (!intent) throw new NotFoundError('payment intent', id);
    return intent;
  }

  #assertCan(intent: PaymentIntent, event: PaymentEvent): void {
    if (!canTransitionPayment(intent.state, event)) throw new InvalidTransitionError(intent.state, event);
  }

  #assertLive(): void {
    if (this.#disposed) throw new IntegrationError('disposed', 'MockPaymentTerminal is disposed');
  }

  #emit(intent: PaymentIntent): void {
    for (const cb of [...this.#listeners]) cb(intent);
  }
}
