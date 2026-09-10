/**
 * Pagos, IA y entrega digital: puertos de `@psp/integrations` con adaptadores mock. Nada sale de
 * la máquina; la transformación de IA usa `@psp/imaging` sobre el archivo de la captura.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import type {
  AiJob,
  AiJobRequest,
  ConsentRecord,
  DeliveryRequest,
  PaymentIntent,
} from '@psp/contracts';
import {
  DeliveryRequestRecord as DeliveryRequestRecordSchema,
  TERMINAL_STAGES,
} from '@psp/contracts';
import type { z } from 'zod';
import { featureMode } from '@psp/domain';
import { decodePNG, encodePNG, grayscale, saturation } from '@psp/imaging';
import {
  MockAiProvider,
  MockDeliveryChannel,
  MockPaymentTerminal,
  aiJobMessage,
  createPaymentTerminal,
  initialPaymentState,
  isActivePaymentState,
  isPaymentAdapterKey,
  paymentMessage,
  type PaymentOutcome,
  type PaymentTerminal,
  type PaymentTerminalStatus,
} from '@psp/integrations';
import type { BundleService } from '../bundle/bundle-service';
import type { Hardware } from '../hardware/hardware';
import type { Store } from '../store/store';
import type { Outbox } from '../sync/outbox';
import { conflict, iso, notFound, type Clock, type EventBus, type IdFactory } from '../support';
import type { SessionService } from './session-service';

export interface CommerceOptions {
  store: Store;
  bus: EventBus;
  clock: Clock;
  ids: IdFactory;
  bundles: BundleService;
  hardware: Hardware;
  sessions: SessionService;
  outbox: Outbox;
}

export class PaymentService {
  readonly #o: CommerceOptions;
  #terminal: PaymentTerminal | undefined;
  #adapter = '';
  #unsubscribe: (() => void) | undefined;

  constructor(opts: CommerceOptions) {
    this.#o = opts;
  }

  get adapter(): string {
    return this.terminal.adapter;
  }

  /** Terminal según `payment.terminalAdapter` efectivo; se reconstruye si la clave cambia. */
  get terminal(): PaymentTerminal {
    const key = this.#o.bundles.value<string>('payment.terminalAdapter', 'mock');
    const adapter = isPaymentAdapterKey(key) ? key : 'mock';
    if (!this.#terminal || this.#adapter !== adapter) {
      this.#unsubscribe?.();
      this.#terminal = createPaymentTerminal(adapter, {
        clock: this.#o.clock,
        idFactory: () => this.#o.ids('pay'),
      });
      this.#adapter = adapter;
      this.#unsubscribe = this.#terminal.onUpdate((intent) => this.#onUpdate(intent));
    }
    return this.#terminal;
  }

  status(): PaymentTerminalStatus {
    if (this.#o.hardware.paymentDeviceOut) return 'out_of_service';
    try {
      return this.terminal.status();
    } catch {
      return 'not_configured';
    }
  }

  async createIntent(sessionId: string): Promise<PaymentIntent> {
    const session = this.#o.sessions.require(sessionId);
    if (TERMINAL_STAGES.includes(session.stage))
      throw conflict('session_closed', `session is ${session.stage}`);
    if (session.payment && isActivePaymentState(session.payment.state)) return session.payment;
    const amount = session.commercial.finalPrice ?? session.product.basePrice;
    const state = initialPaymentState({
      businessMode: this.#o.bundles.value<string>('payment.businessMode', 'paid'),
      isDemo: session.isDemo,
      operatorStarted: session.operatorStarted,
      terminalStatus: this.status(),
      amount,
    });
    if (state === 'awaiting') {
      return this.terminal.createIntent({
        sessionId,
        amount,
        timeoutSec: Math.max(1, session.timers.paymentTimeoutSec),
      });
    }
    const at = iso(this.#o.clock());
    const intent: PaymentIntent = {
      id: this.#o.ids('pay'),
      sessionId,
      amount,
      state,
      adapter: this.adapter,
      message: paymentMessage(state),
      createdAt: at,
      updatedAt: at,
    };
    this.#onUpdate(intent);
    return intent;
  }

  get(intentId: string): PaymentIntent | undefined {
    return this.#o.store.getPaymentIntent(intentId);
  }

  async cancel(intentId: string): Promise<PaymentIntent> {
    const intent = this.get(intentId);
    if (!intent) throw notFound('payment intent', intentId);
    if (!this.terminal.get(intentId))
      throw conflict('invalid_transition', `intent in state ${intent.state} cannot be cancelled`);
    return this.terminal.cancel(intentId);
  }

  async simulate(intentId: string, outcome: PaymentOutcome): Promise<PaymentIntent> {
    if (!this.get(intentId)) throw notFound('payment intent', intentId);
    if (!this.terminal.get(intentId))
      throw conflict('invalid_transition', `intent is not managed by the terminal`);
    return this.terminal.simulate(intentId, outcome);
  }

  setDeviceOut(out: boolean): void {
    this.#o.hardware.paymentDeviceOut = out;
    try {
      this.terminal.setDeviceState(out ? 'out_of_service' : 'ready');
    } catch {
      // Adaptadores stub sin dispositivo: el estado vive sólo en `hardware`.
    }
  }

  tick(now: Date): void {
    const terminal = this.#terminal;
    if (terminal instanceof MockPaymentTerminal) terminal.tick(now);
  }

  #onUpdate(intent: PaymentIntent): void {
    this.#o.store.savePaymentIntent(intent);
    this.#o.sessions.attachPayment(intent.sessionId, intent);
    this.#o.bus.emit({ type: 'payment', intent });
    if (intent.state === 'approved' || intent.state === 'declined' || intent.state === 'expired') {
      this.#o.outbox.machineEvent('payment_event', `payment ${intent.id} ${intent.state}`, {
        sessionId: intent.sessionId,
        payload: { state: intent.state, adapter: intent.adapter },
      });
    }
  }
}

/** Transformación mock: decodifica PNG, aplica un efecto según la experiencia y vuelve a codificar. */
export async function mockAiTransform(image: Uint8Array, experience: string): Promise<Uint8Array> {
  try {
    const raster = decodePNG(image, { inflate: (data) => new Uint8Array(inflateSync(data)) });
    const out =
      experience === 'artistic' || experience === 'cinematic'
        ? grayscale(raster)
        : saturation(raster, 0.4);
    return encodePNG(out, { deflate: (data) => new Uint8Array(deflateSync(data)) });
  } catch {
    return new Uint8Array(image);
  }
}

export class AiService {
  readonly #o: CommerceOptions;
  readonly provider: MockAiProvider;

  constructor(opts: CommerceOptions) {
    this.#o = opts;
    this.provider = new MockAiProvider({
      clock: opts.clock,
      idFactory: () => opts.ids('aij'),
      transform: mockAiTransform,
      onResult: (job, output) => {
        const dir = opts.sessions.sessionDir(job.sessionId);
        mkdirSync(dir, { recursive: true });
        const name = `ai_${job.id}.png`;
        writeFileSync(join(dir, name), output);
        return `/station/v1/sessions/${job.sessionId}/files/${name}`;
      },
    });
    this.provider.onUpdate((job) => this.#attach(job));
  }

  async submit(request: z.infer<typeof AiJobRequest>): Promise<AiJob> {
    const session = this.#o.sessions.require(request.sessionId);
    if (TERMINAL_STAGES.includes(session.stage))
      throw conflict('session_closed', `session is ${session.stage}`);
    const capture = session.captures.find((candidate) => candidate.id === request.captureId);
    if (!capture) throw notFound('capture', request.captureId);
    const mode = featureMode(this.#o.bundles.bundle.features, 'ai.experiences');
    if (mode !== 'enabled') {
      const at = iso(this.#o.clock());
      const state = mode === 'coming_soon' ? 'coming_soon' : 'disabled';
      const job: AiJob = {
        id: this.#o.ids('aij'),
        sessionId: session.id,
        captureId: capture.id,
        experience: request.experience,
        state,
        provider: 'none',
        message: aiJobMessage(state),
        ...(request.consent !== undefined ? { consent: request.consent } : {}),
        createdAt: at,
        updatedAt: at,
      };
      this.#attach(job);
      return job;
    }
    const consent: ConsentRecord = request.consent ?? {
      kind: 'external_future',
      given: false,
      at: iso(this.#o.clock()),
      textVersion: 'none',
    };
    const image = this.#o.sessions.fileBytes(
      session.id,
      (capture.editedUrl ?? capture.url).split('/').pop() ?? '',
    ).bytes;
    const job = await this.provider.submit({
      sessionId: session.id,
      captureId: capture.id,
      experience: request.experience,
      image: new Uint8Array(image),
      consent,
    });
    await this.provider.tick();
    return this.provider.get(job.id) ?? job;
  }

  get(jobId: string): AiJob | undefined {
    const fromProvider = this.provider.get(jobId);
    if (fromProvider) return fromProvider;
    for (const session of this.#o.store.recentSessions(20)) {
      const job = session.aiJobs.find((candidate) => candidate.id === jobId);
      if (job) return job;
    }
    return undefined;
  }

  #attach(job: AiJob): void {
    const session = this.#o.sessions.get(job.sessionId);
    if (session) {
      const index = session.aiJobs.findIndex((candidate) => candidate.id === job.id);
      if (index >= 0) session.aiJobs[index] = job;
      else session.aiJobs.push(job);
      this.#o.store.saveSession(session);
      this.#o.bus.emit({ type: 'session', session });
    }
    this.#o.bus.emit({ type: 'ai_job', job });
  }
}

export class DeliveryService {
  readonly #o: CommerceOptions;

  constructor(opts: CommerceOptions) {
    this.#o = opts;
  }

  async submit(
    request: z.infer<typeof DeliveryRequest>,
  ): Promise<z.infer<typeof DeliveryRequestRecordSchema>> {
    const session = this.#o.sessions.require(request.sessionId);
    if (TERMINAL_STAGES.includes(session.stage))
      throw conflict('session_closed', `session is ${session.stage}`);
    const mode = featureMode(this.#o.bundles.bundle.features, 'delivery.digital');
    let record: z.infer<typeof DeliveryRequestRecordSchema>;
    if (mode === 'enabled') {
      const channel = new MockDeliveryChannel({
        channel: request.channel,
        clock: this.#o.clock,
        idFactory: () => this.#o.ids('dlv'),
      });
      const sent = await channel.send({
        sessionId: session.id,
        destination: request.destination,
        imageRef: session.composition?.url ?? '',
      });
      channel.tick();
      record = DeliveryRequestRecordSchema.parse(channel.get(sent.id) ?? sent);
    } else {
      record = {
        id: this.#o.ids('dlv'),
        sessionId: session.id,
        channel: request.channel,
        state: mode === 'coming_soon' ? 'coming_soon' : 'not_available',
        createdAt: iso(this.#o.clock()),
      };
    }
    session.deliveries.push(record);
    this.#o.store.saveSession(session);
    this.#o.bus.emit({ type: 'session', session });
    return record;
  }
}

/** Lee los bytes de una captura para pruebas y el panel técnico. */
export function readSessionFile(path: string): Buffer {
  return readFileSync(path);
}
