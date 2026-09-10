/**
 * Enlace efímero de cliente (ADR-011) dentro de la máquina.
 *
 * El cliente no crea cuenta ni escribe contraseñas: la cabina muestra un QR de un solo uso, o lee
 * el cupón que el cliente acerca a la cámara. El enlace rota mientras está en pantalla, caduca solo
 * y se borra con la sesión, así la persona que entra después nunca hereda nada.
 */
import type { CustomerHandoff, HandoffMethod, HandoffPurpose } from '@psp/contracts';
import { CreateHandoffRequest, SimulateHandoffRequest } from '@psp/contracts';
import { createHandoff, featureMode, resolveHandoff, selectHandoffMethod, tickHandoff, type HandoffPolicy } from '@psp/domain';
import type { z } from 'zod';
import type { BundleService } from '../bundle/bundle-service';
import type { Hardware } from '../hardware/hardware';
import type { Outbox } from '../sync/outbox';
import { conflict, iso, notFound, type Clock, type EventBus, type IdFactory } from '../support';
import type { SessionService } from './session-service';

export interface HandoffOptions {
  bus: EventBus;
  clock: Clock;
  ids: IdFactory;
  bundles: BundleService;
  hardware: Hardware;
  sessions: SessionService;
  outbox: Outbox;
  machineId: string;
}

export class HandoffService {
  readonly #o: HandoffOptions;

  constructor(opts: HandoffOptions) {
    this.#o = opts;
  }

  get policy(): HandoffPolicy {
    return {
      ttlSec: this.#o.bundles.value<number>('customer.handoffTtlSec', 180),
      rotateSec: this.#o.bundles.value<number>('customer.handoffRotateSec', 30),
      baseUrl: this.#o.bundles.value<string>('customer.handoffBaseUrl', 'https://psp.local/e'),
    };
  }

  /** `hidden` mientras la función no esté habilitada para esta máquina: el recorrido sigue anónimo. */
  get mode(): ReturnType<typeof featureMode> {
    return featureMode(this.#o.bundles.bundle.features, 'customer.handoff');
  }

  /** Métodos que esta máquina puede ofrecer, en orden de preferencia configurado. */
  get methods(): HandoffMethod[] {
    const preferred = this.#o.bundles.value<string[]>('customer.handoffMethods', ['display_qr']);
    return preferred.filter((m): m is HandoffMethod =>
      ['display_qr', 'scan_qr', 'nfc_tap', 'short_code', 'none'].includes(m),
    );
  }

  create(request: z.infer<typeof CreateHandoffRequest>): CustomerHandoff {
    const parsed = CreateHandoffRequest.parse(request);
    const session = this.#o.sessions.require(parsed.sessionId);
    const now = this.#o.clock();
    const mode = this.mode;
    if (mode !== 'enabled') {
      // No se ofrece: la UI lo muestra como no disponible o próximamente, nunca como error.
      return {
        id: this.#o.ids('hnd'),
        sessionId: session.id,
        method: 'none',
        purpose: parsed.purpose,
        state: mode === 'coming_soon' ? 'coming_soon' : 'unavailable',
        createdAt: iso(now),
        updatedAt: iso(now),
        expiresAt: iso(now),
      };
    }
    const hardware = this.#o.hardware;
    const method = selectHandoffMethod({
      preferred: this.methods,
      ...(parsed.method !== undefined ? { requested: parsed.method } : {}),
      hasCamera: hardware.camera.present && hardware.camera.operational,
      // El lector sin contacto se representa con el terminal de pago del perfil de hardware.
      hasNfc: !hardware.paymentDeviceOut && this.#o.bundles.value<string>('payment.terminalAdapter', 'none') !== 'none',
    });
    const handoff = createHandoff({
      id: this.#o.ids('hnd'),
      sessionId: session.id,
      method,
      purpose: parsed.purpose,
      policy: this.policy,
      now,
      salt: this.#o.machineId,
    });
    this.#attach(handoff);
    return handoff;
  }

  get(handoffId: string): CustomerHandoff | undefined {
    for (const session of this.#o.sessions.all()) {
      const found = session.handoffs.find((h) => h.id === handoffId);
      if (found) return found;
    }
    return undefined;
  }

  /** Resultado simulado del lado del cliente: escaneo, enlace, caducidad, cancelación o fallo. */
  simulate(request: z.infer<typeof SimulateHandoffRequest>): CustomerHandoff {
    const parsed = SimulateHandoffRequest.parse(request);
    const current = this.get(parsed.handoffId);
    if (!current) throw notFound('handoff', parsed.handoffId);
    if (current.state === 'unavailable' || current.state === 'coming_soon')
      throw conflict('handoff_unavailable', 'handoff is not offered on this machine');
    const next = resolveHandoff(current, parsed.outcome, this.#o.clock(), parsed.reference);
    this.#attach(next);
    return next;
  }

  cancel(handoffId: string): CustomerHandoff | undefined {
    const current = this.get(handoffId);
    if (!current) return undefined;
    const next = resolveHandoff(current, 'cancel', this.#o.clock());
    this.#attach(next);
    return next;
  }

  /** Rota los tokens en pantalla y caduca los vencidos. Lo llama el temporizador del agente. */
  tick(now: Date = this.#o.clock()): void {
    const policy = this.policy;
    for (const session of this.#o.sessions.all()) {
      for (const handoff of session.handoffs) {
        const next = tickHandoff(handoff, now, policy, this.#o.machineId);
        if (next !== handoff) this.#attach(next);
      }
    }
  }

  #attach(handoff: CustomerHandoff): void {
    this.#o.sessions.attachHandoff(handoff);
    this.#o.bus.emit({ type: 'handoff', handoff });
  }
}
