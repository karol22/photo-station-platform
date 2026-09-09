/**
 * Ciclo de vida de la sesión (requisito 4.4): creación desde el bundle, transiciones con
 * `canTransition`, capturas y composición como archivos en `var/station/<machineId>/sessions/<id>/`,
 * impresión mock idempotente, expiración por inactividad, cierre con `SessionRecord` al outbox.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Capture,
  ConsentRecord,
  CustomerHandoff,
  CreateSessionRequest,
  MachineCapabilityState,
  MachineStatus,
  PaymentIntent,
  PrintJob,
  RetentionPolicy,
  SessionRecord,
  SessionResult,
  SessionStage,
  StationSession,
  UploadCaptureRequest,
} from '@psp/contracts';
import { TERMINAL_STAGES } from '@psp/contracts';
import type { z } from 'zod';
import type {
  FinishSessionResponse as FinishSessionResponseSchema,
  SaveCompositionRequest,
  SaveEditsRequest,
  PrintRequest,
} from '@psp/contracts';

type FinishSessionResponse = z.infer<typeof FinishSessionResponseSchema>;
import {
  DEFAULT_RETENTION_POLICY,
  canTransition,
  commercialStateFor,
  computeTimers,
  resolveRetentionPolicy,
  retentionDeadline,
  sessionRecordFrom,
  shortCode,
} from '@psp/domain';
import {
  initialPaymentState,
  paymentAllowsProgress,
  type PaymentTerminalStatus,
} from '@psp/integrations';
import { computeKioskAvailability, type BundleService } from '../bundle/bundle-service';
import type { Hardware } from '../hardware/hardware';
import type { Store } from '../store/store';
import type { Outbox } from '../sync/outbox';
import {
  AgentError,
  badRequest,
  conflict,
  decodeImage,
  iso,
  notFound,
  type Clock,
  type EventBus,
  type IdFactory,
} from '../support';

export interface SessionServiceOptions {
  store: Store;
  bus: EventBus;
  clock: Clock;
  ids: IdFactory;
  machineId: string;
  softwareVersion: string;
  bundles: BundleService;
  hardware: Hardware;
  outbox: Outbox;
  /** Raíz de la máquina: `var/station/<machineId>`. */
  baseDir: string;
  paymentStatus: () => PaymentTerminalStatus;
  paymentAdapter: () => string;
  /** ¿La máquina acepta clientes ahora? Devuelve el motivo cuando no. */
  unavailableReason: () => string | undefined;
  demoMode: () => boolean;
  machineStatus: () => MachineStatus;
  capabilities: () => MachineCapabilityState[];
}

const FILES_ROUTE = (sessionId: string, name: string): string =>
  `/station/v1/sessions/${sessionId}/files/${name}`;
const SAFE_NAME = /^[\w.-]+$/;
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export class SessionService {
  readonly #o: SessionServiceOptions;
  readonly #printing = new Map<string, Promise<void>>();

  constructor(opts: SessionServiceOptions) {
    this.#o = opts;
  }

  /* ---------- consultas ---------- */

  get(id: string): StationSession | undefined {
    return this.#o.store.getSession(id);
  }

  require(id: string): StationSession {
    const session = this.get(id);
    if (!session) throw notFound('session', id);
    return session;
  }

  active(): StationSession | undefined {
    return this.#o.store.openSessions()[0];
  }

  sessionDir(sessionId: string): string {
    return join(this.#o.baseDir, 'sessions', sessionId);
  }

  fileBytes(sessionId: string, name: string): { bytes: Buffer; mime: string } {
    if (!SAFE_NAME.test(name)) throw badRequest('invalid_name', 'invalid file name');
    const session = this.require(sessionId);
    if (session.retention.deletedAt !== undefined) throw notFound('file', name);
    const path = join(this.sessionDir(sessionId), name);
    if (!existsSync(path)) throw notFound('file', name);
    const ext = name.split('.').pop() ?? 'png';
    return { bytes: readFileSync(path), mime: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
  }

  /* ---------- creación ---------- */

  create(request: CreateSessionRequest): StationSession {
    const unavailable = this.#o.unavailableReason();
    if (unavailable !== undefined) throw conflict('machine_unavailable', unavailable);
    const current = this.active();
    if (current) throw conflict('session_active', `session ${current.id} is still active`);
    const bundle = this.#o.bundles.bundle;
    const product = bundle.products.find((candidate) => candidate.id === request.productId);
    if (!product) throw notFound('product', request.productId);
    const machine = this.#o.bundles.machine({
      status: this.#o.machineStatus(),
      capabilities: this.#o.capabilities(),
    });
    const availability = computeKioskAvailability(bundle, {
      machine,
      printers: this.#o.hardware.printerRuntimes(),
      maintenance: false,
      now: this.#o.clock(),
    }).find((state) => state.productId === product.id);
    if (availability && !availability.available)
      throw conflict(
        'product_unavailable',
        `product unavailable: ${availability.reasons.join(', ')}`,
      );

    const values = this.#o.bundles.effectiveValues();
    const businessMode = this.#o.bundles.value<string>('payment.businessMode', 'paid');
    const price = bundle.prices.find((candidate) => candidate.productId === product.id);
    const amount = price?.final ?? product.basePrice;
    const isDemo = request.isDemo || this.#o.demoMode();
    const paymentState = initialPaymentState({
      businessMode,
      isDemo,
      operatorStarted: request.operatorStarted,
      terminalStatus: this.#o.paymentStatus(),
      amount,
    });
    const promotionIds = price?.appliedPromotionIds ?? [];
    const policy = resolveRetentionPolicy(bundle.retentionPolicies, product, values);
    const template = bundle.templates.find(
      (candidate) => candidate.id === product.output.templateId,
    );
    const presetVersion =
      product.presetId === undefined
        ? undefined
        : bundle.presetVersions.find((version) => version.presetId === product.presetId);
    const now = this.#o.clock();
    const id = this.#o.ids('ses');
    const defaultCopies = this.#o.bundles.value<number>('printing.defaultCopies', 1);
    const session: StationSession = {
      id,
      code: shortCode(id),
      stage: 'product_selected',
      startedAt: iso(now),
      updatedAt: iso(now),
      locale: request.locale,
      product,
      ...(presetVersion !== undefined ? { presetVersion } : {}),
      templateId: product.output.templateId,
      templateVersion: template?.version ?? 1,
      ...(product.experienceId !== undefined ? { experienceId: product.experienceId } : {}),
      bundleVersion: bundle.version,
      captures: [],
      retakesUsed: 0,
      edits: {},
      editingToolsUsed: [],
      selection: [],
      copies: product.output.copies > 0 ? product.output.copies : defaultCopies,
      printJobs: [],
      commercial: {
        state: commercialStateFor({ businessMode, paymentState, isDemo, promotionIds }),
        listPrice: price?.list ?? product.basePrice,
        finalPrice: amount,
        promotionIds,
        paymentState,
        adapter: this.#o.paymentAdapter(),
      },
      consents: [],
      aiJobs: [],
      deliveries: [],
      handoffs: [],
      timers: computeTimers(values, product, request.accessible),
      retention: { policyId: policy.id, customerText: policy.customerText },
      errors: [],
      isDemo,
      operatorStarted: request.operatorStarted,
    };
    this.#save(session);
    this.#o.outbox.machineEvent(
      'session_started',
      `session ${session.code} started (${product.internalName})`,
      { sessionId: session.id },
    );
    return session;
  }

  /* ---------- transiciones ---------- */

  advance(id: string, to: SessionStage, reason?: string): StationSession {
    const session = this.require(id);
    if (!canTransition(session.stage, to))
      throw conflict('invalid_transition', `cannot move from ${session.stage} to ${to}`);
    if (
      to === 'capturing' &&
      session.stage === 'awaiting_payment' &&
      !paymentAllowsProgress(session.commercial.paymentState)
    ) {
      throw conflict(
        'payment_pending',
        `payment state ${session.commercial.paymentState} does not allow capture`,
      );
    }
    if (TERMINAL_STAGES.includes(to)) return this.#close(session, to, reason);
    session.stage = to;
    this.#touch(session);
    this.#save(session);
    return session;
  }

  recordConsents(id: string, consents: ConsentRecord[]): StationSession {
    const session = this.#open(id);
    for (const consent of consents) {
      const index = session.consents.findIndex((existing) => existing.kind === consent.kind);
      if (index >= 0) session.consents[index] = consent;
      else session.consents.push(consent);
    }
    this.#touch(session);
    this.#save(session);
    return session;
  }

  extend(id: string, extraSec: number): StationSession {
    const session = this.#open(id);
    session.timers = {
      ...session.timers,
      idleTimeoutSec: session.timers.idleTimeoutSec + extraSec,
    };
    this.#touch(session);
    this.#save(session);
    return session;
  }

  cancel(id: string, reason?: string): StationSession {
    const session = this.#open(id);
    return this.#close(session, 'cancelled', reason);
  }

  fail(id: string, code: string, message: string): StationSession {
    const session = this.#open(id);
    session.errors.push({ code, message, at: iso(this.#o.clock()), stage: session.stage });
    return this.#close(session, 'failed', message);
  }

  finish(id: string): FinishSessionResponse {
    let session = this.require(id);
    if (TERMINAL_STAGES.includes(session.stage))
      throw conflict('session_closed', `session is already ${session.stage}`);
    if (session.stage !== 'finishing') {
      if (!canTransition(session.stage, 'finishing'))
        throw conflict('invalid_transition', `cannot finish from ${session.stage}`);
      session.stage = 'finishing';
    }
    session = this.#close(session, 'done');
    const record = this.#lastRecord(session.id) ?? this.record(session);
    return { session, record, retentionNotice: this.policyFor(session).customerText };
  }

  /* ---------- capturas y edición ---------- */

  addCapture(id: string, request: UploadCaptureRequest): Capture {
    const session = this.#open(id);
    if (request.retakeOf !== undefined) {
      if (session.retakesUsed >= session.product.retakes.max)
        throw conflict('retakes_exhausted', `no retakes left (max ${session.product.retakes.max})`);
      if (!session.captures.some((capture) => capture.id === request.retakeOf))
        throw notFound('capture', request.retakeOf);
      session.retakesUsed += 1;
    }
    const image = decodeImage(request.imageBase64);
    const captureId = this.#o.ids('cap');
    const name = `${captureId}.${image.ext}`;
    this.#write(session.id, name, image.bytes);
    const capture: Capture = {
      id: captureId,
      index: request.index,
      takenAt: iso(this.#o.clock()),
      width: request.width,
      height: request.height,
      url: FILES_ROUTE(session.id, name),
      ...(request.retakeOf !== undefined ? { retakeOf: request.retakeOf } : {}),
      selected: false,
      ...(request.analysis !== undefined ? { analysis: request.analysis } : {}),
      auto: request.auto,
    };
    session.captures.push(capture);
    this.#touch(session);
    this.#save(session);
    return capture;
  }

  deleteCapture(id: string, captureId: string): StationSession {
    const session = this.#open(id);
    const capture = session.captures.find((candidate) => candidate.id === captureId);
    if (!capture) throw notFound('capture', captureId);
    session.captures = session.captures.filter((candidate) => candidate.id !== captureId);
    session.selection = session.selection.filter((selected) => selected !== captureId);
    delete session.edits[captureId];
    for (const url of [capture.url, capture.editedUrl])
      if (url)
        rmSync(join(this.sessionDir(session.id), url.split('/').pop() ?? ''), { force: true });
    this.#touch(session);
    this.#save(session);
    return session;
  }

  saveEdits(id: string, request: z.infer<typeof SaveEditsRequest>): StationSession {
    const session = this.#open(id);
    const capture = session.captures.find((candidate) => candidate.id === request.captureId);
    if (!capture) throw notFound('capture', request.captureId);
    session.edits[request.captureId] = request.ops;
    for (const tool of request.toolsUsed)
      if (!session.editingToolsUsed.includes(tool)) session.editingToolsUsed.push(tool);
    if (request.resultBase64 !== undefined) {
      const image = decodeImage(request.resultBase64);
      const name = `edit_${capture.id}.${image.ext}`;
      this.#write(session.id, name, image.bytes);
      capture.editedUrl = FILES_ROUTE(session.id, name);
    }
    this.#touch(session);
    this.#save(session);
    return session;
  }

  setSelection(id: string, captureIds: string[]): StationSession {
    const session = this.#open(id);
    for (const captureId of captureIds)
      if (!session.captures.some((capture) => capture.id === captureId))
        throw notFound('capture', captureId);
    session.selection = [...captureIds];
    for (const capture of session.captures) capture.selected = captureIds.includes(capture.id);
    this.#touch(session);
    this.#save(session);
    return session;
  }

  saveComposition(id: string, request: z.infer<typeof SaveCompositionRequest>): StationSession {
    const session = this.#open(id);
    const image = decodeImage(request.imageBase64);
    const name = `composition.${image.ext}`;
    this.#write(session.id, name, image.bytes);
    session.composition = {
      url: FILES_ROUTE(session.id, name),
      width: request.width,
      height: request.height,
      createdAt: iso(this.#o.clock()),
    };
    if (request.copies !== undefined) session.copies = request.copies;
    this.#touch(session);
    this.#save(session);
    return session;
  }

  /* ---------- impresión ---------- */

  print(id: string, request: z.infer<typeof PrintRequest>): PrintJob {
    const session = this.#open(id);
    const existing = this.#o.store.printJobByKey(session.id, request.idempotencyKey);
    if (existing) return existing;
    if (!session.composition)
      throw conflict('no_composition', 'the session has no composition to print');
    const printer = this.#o.hardware.printer(request.printerId);
    if (!printer) throw notFound('printer', request.printerId ?? 'default');
    const blocked = printer.blockedReason();
    if (blocked !== undefined)
      throw new AgentError(409, 'printer_unavailable', `cannot print: ${blocked}`);
    const job: PrintJob = {
      id: this.#o.ids('pj'),
      sessionId: session.id,
      machineId: this.#o.machineId,
      printerId: printer.id,
      copies: request.copies ?? Math.max(1, session.copies),
      status: 'preparing',
      attempt: 1,
      idempotencyKey: request.idempotencyKey,
      isTest: false,
      createdAt: iso(this.#o.clock()),
    };
    session.printJobs.push(job);
    this.#o.store.savePrintJob(job);
    this.#touch(session);
    this.#save(session);
    this.#o.bus.emit({ type: 'print_job', job });
    this.#o.outbox.machineEvent('print_started', `print job ${job.id} (${job.copies} copies)`, {
      sessionId: session.id,
    });
    this.#run(job);
    return job;
  }

  retryPrint(id: string, jobId: string): PrintJob {
    const session = this.#open(id);
    const job = session.printJobs.find((candidate) => candidate.id === jobId);
    if (!job) throw notFound('print job', jobId);
    if (job.status !== 'failed') throw conflict('job_not_failed', `job is ${job.status}`);
    const printer = this.#o.hardware.printer(job.printerId);
    const blocked = printer?.blockedReason();
    if (!printer || blocked !== undefined)
      throw new AgentError(
        409,
        'printer_unavailable',
        `cannot print: ${blocked ?? 'printer missing'}`,
      );
    job.status = 'retrying';
    job.attempt += 1;
    delete job.error;
    this.#updateJob(session, job);
    this.#run(job);
    return job;
  }

  /** Espera a que terminen las impresiones en curso (pruebas y apagado ordenado). */
  async waitForPrints(): Promise<void> {
    await Promise.all([...this.#printing.values()]);
  }

  #run(job: PrintJob): void {
    const promise = this.#execute(job)
      .catch(() => undefined)
      .finally(() => this.#printing.delete(job.id));
    this.#printing.set(job.id, promise);
  }

  async #execute(job: PrintJob): Promise<void> {
    const sessionId = job.sessionId ?? '';
    const session = this.get(sessionId);
    const printer = this.#o.hardware.printer(job.printerId);
    if (!session?.composition || !printer) return;
    const bytes = readFileSync(
      join(this.sessionDir(session.id), session.composition.url.split('/').pop() ?? ''),
    );
    const outputPath = join(this.#o.baseDir, 'prints', `${job.id}.png`);
    const outcome = await printer.print(job, bytes, outputPath, (status) => {
      const current = this.get(sessionId);
      if (!current) return;
      job.status = status;
      this.#updateJob(current, job);
    });
    const current = this.get(sessionId) ?? session;
    if (outcome.ok) {
      job.status = 'completed';
      job.completedAt = iso(this.#o.clock());
      job.outputPath = outputPath;
      this.#o.outbox.machineEvent('print_completed', `print job ${job.id} completed`, {
        sessionId: session.id,
      });
    } else {
      job.status = 'failed';
      job.error = outcome.error ?? 'print failed';
      current.errors.push({
        code: 'print_failed',
        message: job.error,
        at: iso(this.#o.clock()),
        stage: current.stage,
      });
      this.#o.outbox.machineEvent('print_failed', `print job ${job.id} failed: ${job.error}`, {
        sessionId: session.id,
        severity: 'error',
      });
    }
    this.#updateJob(current, job);
    this.#o.bus.emit({ type: 'printer', printer: printer.runtime() });
    const { outputPath: _omitted, ...payload } = job;
    this.#o.outbox.enqueue({ type: 'print_job', payload });
  }

  #updateJob(session: StationSession, job: PrintJob): void {
    const index = session.printJobs.findIndex((candidate) => candidate.id === job.id);
    if (index >= 0) session.printJobs[index] = { ...job };
    else session.printJobs.push({ ...job });
    this.#o.store.savePrintJob(job);
    this.#save(session);
    this.#o.bus.emit({ type: 'print_job', job: { ...job } });
  }

  /* ---------- pago ---------- */

  /** Sesiones abiertas: las que pueden tener enlaces vivos. */
  all(): StationSession[] {
    return this.#o.store.openSessions();
  }

  /**
   * Guarda un enlace efímero en su sesión. No toca `updatedAt` de la sesión: la rotación del token
   * es automática y no debe contar como actividad del cliente para el temporizador de inactividad.
   */
  attachHandoff(handoff: CustomerHandoff): StationSession | undefined {
    const session = this.get(handoff.sessionId);
    if (!session || TERMINAL_STAGES.includes(session.stage)) return session;
    const index = session.handoffs.findIndex((h) => h.id === handoff.id);
    if (index >= 0) session.handoffs[index] = handoff;
    else session.handoffs.push(handoff);
    this.#save(session);
    return session;
  }

  attachPayment(sessionId: string, intent: PaymentIntent): StationSession | undefined {
    const session = this.get(sessionId);
    if (!session || TERMINAL_STAGES.includes(session.stage)) return session;
    const businessMode = this.#o.bundles.value<string>('payment.businessMode', 'paid');
    session.payment = intent;
    session.commercial = {
      ...session.commercial,
      paymentState: intent.state,
      adapter: intent.adapter,
      ...(intent.ref !== undefined ? { paymentRef: intent.ref } : {}),
      state: commercialStateFor({
        businessMode,
        paymentState: intent.state,
        isDemo: session.isDemo,
        promotionIds: session.commercial.promotionIds,
      }),
    };
    this.#touch(session);
    this.#save(session);
    return session;
  }

  /* ---------- expiración, retención y recuperación ---------- */

  /** Marca `expired` toda sesión abierta sin actividad durante `timers.idleTimeoutSec`. */
  expireIdle(now: Date = this.#o.clock()): StationSession[] {
    const expired: StationSession[] = [];
    for (const session of this.#o.store.openSessions()) {
      if (
        session.stage === 'printing' &&
        session.printJobs.some(
          (job) =>
            job.status === 'preparing' || job.status === 'printing' || job.status === 'retrying',
        )
      )
        continue;
      const idleMs = now.getTime() - Date.parse(session.updatedAt);
      if (idleMs >= session.timers.idleTimeoutSec * 1000)
        expired.push(this.#close(session, 'expired', 'idle timeout'));
    }
    return expired;
  }

  /** Elimina los archivos de las sesiones cuyo plazo venció; el registro queda intacto. */
  reap(now: Date = this.#o.clock()): string[] {
    const reaped: string[] = [];
    for (const session of this.#o.store.sessionsDueForDeletion(iso(now))) {
      this.deleteFiles(session, now);
      reaped.push(session.id);
    }
    return reaped;
  }

  deleteFiles(session: StationSession, now: Date = this.#o.clock()): void {
    rmSync(this.sessionDir(session.id), { recursive: true, force: true });
    session.retention = { ...session.retention, deletedAt: iso(now) };
    this.#o.store.saveSession(session);
  }

  /** Arranque: toda sesión no terminal se cierra como `abandoned` y sus archivos según la política. */
  recover(): StationSession[] {
    const recovered: StationSession[] = [];
    for (const session of this.#o.store.openSessions()) {
      const recoveredFrom: SessionRecord['recoveredFrom'] =
        session.stage === 'printing' ? 'print_failed' : 'app_restart';
      const closed = this.#close(session, 'abandoned', 'recovered on startup', {
        recoveredFrom,
        abandonedAtStage: session.stage,
      });
      if (this.policyFor(closed).deleteIncomplete) this.deleteFiles(closed);
      this.#o.outbox.machineEvent(
        'session_recovered',
        `session ${closed.code} recovered as abandoned from ${session.stage}`,
        { sessionId: closed.id, severity: 'warning' },
      );
      recovered.push(closed);
    }
    return recovered;
  }

  /** Borra archivos de toda sesión no terminal (acción `clear_temp_sessions`) y las cierra como canceladas. */
  clearTemp(): number {
    let count = 0;
    for (const session of this.#o.store.openSessions()) {
      const closed = this.#close(session, 'cancelled', 'cleared by technician');
      this.deleteFiles(closed);
      count += 1;
    }
    return count;
  }

  policyFor(session: StationSession): RetentionPolicy {
    return (
      this.#o.bundles.bundle.retentionPolicies.find(
        (policy) => policy.id === session.retention.policyId,
      ) ?? DEFAULT_RETENTION_POLICY
    );
  }

  record(
    session: StationSession,
    extra: { recoveredFrom?: SessionRecord['recoveredFrom']; abandonedAtStage?: SessionStage } = {},
  ): SessionRecord {
    const machine = this.#o.bundles.machine({ status: this.#o.machineStatus(), capabilities: [] });
    return sessionRecordFrom(session, {
      machine,
      softwareVersion: this.#o.softwareVersion,
      retentionMode: this.policyFor(session).mode,
      ...(extra.recoveredFrom !== undefined ? { recoveredFrom: extra.recoveredFrom } : {}),
      ...(extra.abandonedAtStage !== undefined ? { abandonedAtStage: extra.abandonedAtStage } : {}),
    });
  }

  /* ---------- internos ---------- */

  #open(id: string): StationSession {
    const session = this.require(id);
    if (TERMINAL_STAGES.includes(session.stage))
      throw conflict('session_closed', `session is ${session.stage}`);
    return session;
  }

  #close(
    session: StationSession,
    stage: SessionStage,
    reason?: string,
    extra: { recoveredFrom?: SessionRecord['recoveredFrom']; abandonedAtStage?: SessionStage } = {},
  ): StationSession {
    const now = this.#o.clock();
    const abandonedAtStage =
      extra.abandonedAtStage ?? (stage === 'done' ? undefined : session.stage);
    session.stage = stage;
    session.endedAt = iso(now);
    session.updatedAt = iso(now);
    if (reason !== undefined && stage !== 'done') session.userMessage = reason;
    const policy = this.policyFor(session);
    const completed = stage === 'done';
    const deleteAt =
      completed || policy.deleteIncomplete
        ? (retentionDeadline(policy, now) ?? (completed ? undefined : now))
        : retentionDeadline(policy, now);
    session.retention = {
      ...session.retention,
      ...(deleteAt !== undefined ? { deleteAt: iso(deleteAt) } : {}),
    };
    this.#save(session);
    const record = this.record(session, {
      ...extra,
      ...(abandonedAtStage !== undefined && !completed ? { abandonedAtStage } : {}),
    });
    this.#o.outbox.enqueue({ type: 'session_record', payload: record });
    const result: SessionResult = record.result ?? 'completed';
    const eventType =
      result === 'completed'
        ? 'session_completed'
        : result === 'cancelled'
          ? 'session_cancelled'
          : result === 'failed'
            ? 'session_failed'
            : 'session_cancelled';
    this.#o.outbox.machineEvent(
      eventType,
      `session ${session.code} ${result}${reason ? `: ${reason}` : ''}`,
      { sessionId: session.id, payload: { result } },
    );
    return session;
  }

  #lastRecord(sessionId: string): SessionRecord | undefined {
    const events = this.#o.store.outboxByType('session_record');
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      if (event?.type === 'session_record' && event.payload.id === sessionId) return event.payload;
    }
    return undefined;
  }

  #touch(session: StationSession): void {
    session.updatedAt = iso(this.#o.clock());
  }

  #save(session: StationSession): void {
    this.#o.store.saveSession(session);
    this.#o.bus.emit({ type: 'session', session });
  }

  #write(sessionId: string, name: string, bytes: Uint8Array): void {
    const dir = this.sessionDir(sessionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), bytes);
  }
}
