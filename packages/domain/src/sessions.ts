/**
 * Sesiones (requisitos 4.4, 4.5, 10.4, 22, 23, 31): máquina de estados, recorrido por producto,
 * temporizadores, retención, estado comercial, registro sin fotografías y ciclo de release.
 */
import {
  CONFIG_KEY_INDEX,
  SessionRecord as SessionRecordSchema,
  SessionTimers as SessionTimersSchema,
  TERMINAL_STAGES,
  type CommercialState,
  type Id,
  type Machine,
  type MachineReleaseStatus,
  type PaymentState,
  type Product,
  type RetentionMode,
  type RetentionPolicy,
  type SessionRecord,
  type SessionResult,
  type SessionStage,
  type StationSession,
} from '@psp/contracts';
import type { z } from 'zod';

/** Temporizadores de sesión: contracts exporta sólo el esquema; aquí se infiere el tipo. */
export type SessionTimers = z.infer<typeof SessionTimersSchema>;

/** Etapas terminales que cierran una sesión sin completarla. */
export const ABORT_STAGES: SessionStage[] = ['cancelled', 'failed', 'expired', 'abandoned'];

const FLOW: Record<SessionStage, SessionStage[]> = {
  started: ['product_selected'],
  product_selected: ['configuring', 'consent', 'awaiting_payment', 'capturing', 'started'],
  configuring: ['consent', 'awaiting_payment', 'capturing', 'product_selected'],
  consent: ['awaiting_payment', 'capturing', 'configuring'],
  awaiting_payment: ['capturing', 'consent', 'configuring'],
  capturing: ['reviewing'],
  reviewing: ['editing', 'selecting', 'composing', 'capturing'],
  editing: ['reviewing', 'selecting', 'composing'],
  selecting: ['composing', 'editing', 'capturing', 'reviewing'],
  composing: ['confirming', 'selecting', 'editing', 'reviewing'],
  confirming: ['printing', 'delivering', 'composing'],
  printing: ['delivering', 'finishing'],
  delivering: ['finishing'],
  finishing: ['done'],
  done: [],
  cancelled: [],
  failed: [],
  expired: [],
  abandoned: [],
};

/**
 * Grafo de transiciones. Desde cualquier etapa no terminal se puede cancelar, fallar, expirar o
 * abandonar. `reviewing → capturing` es el retake; `selecting → capturing` cuando los retakes lo
 * permiten; `editing ↔ reviewing` para volver a comparar.
 */
export const SESSION_TRANSITIONS: Record<SessionStage, SessionStage[]> = Object.fromEntries(
  (Object.keys(FLOW) as SessionStage[]).map((stage) => [
    stage,
    TERMINAL_STAGES.includes(stage) ? [] : [...(FLOW[stage] ?? []), ...ABORT_STAGES],
  ]),
) as Record<SessionStage, SessionStage[]>;

export function canTransition(from: SessionStage, to: SessionStage): boolean {
  return (SESSION_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Recorrido ordenado de etapas para un producto: sin `selecting` en documentos ni en experiencias
 * de una sola captura; sin `printing` cuando `printCount` es 0; `awaiting_payment` y `consent`
 * sólo cuando se requieren; `editing` sólo si la política de edición lo permite.
 */
export function stagesForProduct(product: Product, opts: { paymentRequired: boolean; consentRequired: boolean }): SessionStage[] {
  const stages: SessionStage[] = ['started', 'product_selected', 'configuring'];
  if (opts.consentRequired) stages.push('consent');
  if (opts.paymentRequired) stages.push('awaiting_payment');
  stages.push('capturing', 'reviewing');
  if (product.editing.enabled && product.editing.allowedTools.length > 0) stages.push('editing');
  if (product.kind !== 'document' && product.captureCount > 1) stages.push('selecting');
  stages.push('composing', 'confirming');
  if (product.printCount > 0) stages.push('printing');
  stages.push('delivering', 'finishing', 'done');
  return stages;
}

function numberValue(values: Record<string, unknown>, key: string): number {
  const value = values[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const fallback = CONFIG_KEY_INDEX[key]?.default;
  return typeof fallback === 'number' ? fallback : 0;
}

function stringValue(values: Record<string, unknown>, key: string): string | undefined {
  const value = values[key];
  if (typeof value === 'string' && value.length > 0) return value;
  const fallback = CONFIG_KEY_INDEX[key]?.default;
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : undefined;
}

/**
 * Temporizadores efectivos: claves `timing.*` y `payment.timeoutSec` del efectivo, sobrescritas por
 * `product.timing`. Con `accessible`, los tiempos de espera del cliente se multiplican por
 * `kiosk.accessibleTimeoutMultiplier` (redondeo hacia arriba); el aviso previo y la estabilidad
 * de auto-captura no cambian.
 */
export function computeTimers(effectiveValues: Record<string, unknown>, product: Product, accessible: boolean): SessionTimers {
  const timing = product.timing ?? {};
  const base: SessionTimers = {
    idleTimeoutSec: Math.round(timing.idleTimeoutSec ?? numberValue(effectiveValues, 'timing.idleTimeoutSec')),
    warningBeforeCancelSec: Math.round(numberValue(effectiveValues, 'timing.warningBeforeCancelSec')),
    captureCountdownSec: Math.round(timing.captureCountdownSec ?? numberValue(effectiveValues, 'timing.captureCountdownSec')),
    prepareBeforeCaptureSec: Math.round(numberValue(effectiveValues, 'timing.prepareBeforeCaptureSec')),
    reviewTimeoutSec: Math.round(timing.reviewTimeoutSec ?? numberValue(effectiveValues, 'timing.reviewTimeoutSec')),
    autoCaptureStabilityMs: Math.round(timing.autoCaptureStabilityMs ?? numberValue(effectiveValues, 'timing.autoCaptureStabilityMs')),
    paymentTimeoutSec: Math.round(numberValue(effectiveValues, 'payment.timeoutSec')),
  };
  if (!accessible) return base;
  const multiplier = Math.max(1, numberValue(effectiveValues, 'kiosk.accessibleTimeoutMultiplier'));
  const scale = (seconds: number): number => Math.ceil(seconds * multiplier);
  return {
    ...base,
    idleTimeoutSec: scale(base.idleTimeoutSec),
    captureCountdownSec: scale(base.captureCountdownSec),
    prepareBeforeCaptureSec: scale(base.prepareBeforeCaptureSec),
    reviewTimeoutSec: scale(base.reviewTimeoutSec),
    paymentTimeoutSec: scale(base.paymentTimeoutSec),
  };
}

/** Política de respaldo cuando no hay ninguna configurada: retención mínima (requisito 23.4). */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  id: 'ret_delete_on_finish',
  name: { es: 'Eliminar al terminar', en: 'Delete on finish' },
  mode: 'none',
  deleteIncomplete: true,
  appliesToKinds: [],
  customerText: {
    es: 'Tus fotos se procesan en esta máquina y se eliminan al terminar la sesión.',
    en: 'Your photos are processed on this machine and deleted when the session ends.',
  },
  leavesDevice: false,
};

/**
 * Política de retención aplicable: la del producto → la primera que declara el tipo de producto →
 * `privacy.defaultRetentionPolicyId` → la primera de la lista → la política de respaldo.
 */
export function resolveRetentionPolicy(policies: RetentionPolicy[], product: Product, effectiveValues: Record<string, unknown>): RetentionPolicy {
  const byProduct = product.retentionPolicyId === undefined ? undefined : policies.find((p) => p.id === product.retentionPolicyId);
  if (byProduct) return byProduct;
  const byKind = policies.find((p) => p.appliesToKinds.includes(product.kind));
  if (byKind) return byKind;
  const defaultId = stringValue(effectiveValues, 'privacy.defaultRetentionPolicyId');
  const byDefault = defaultId === undefined ? undefined : policies.find((p) => p.id === defaultId);
  if (byDefault) return byDefault;
  return policies[0] ?? DEFAULT_RETENTION_POLICY;
}

/**
 * Instante en que deben eliminarse las fotografías. `undefined` = sin eliminación automática
 * (sólo `period` y `derivatives_only` sin duración).
 */
export function retentionDeadline(policy: RetentionPolicy, endedAt: Date): Date | undefined {
  const plusDuration = (): Date | undefined =>
    policy.durationMinutes === undefined ? undefined : new Date(endedAt.getTime() + policy.durationMinutes * 60_000);
  switch (policy.mode) {
    case 'none':
    case 'delete_originals':
    case 'metadata_only':
      return new Date(endedAt.getTime());
    case 'temporary':
      return plusDuration() ?? new Date(endedAt.getTime());
    case 'period':
    case 'derivatives_only':
      return plusDuration();
    default:
      return new Date(endedAt.getTime());
  }
}

/**
 * Estado comercial de una sesión (requisito 10.4). Sin procesador real, un pago aprobado se
 * registra como `paid_simulated`; `paid` queda reservado para un adaptador real.
 */
export function commercialStateFor(input: { businessMode: string; paymentState: PaymentState; isDemo: boolean; promotionIds: Id[] }): CommercialState {
  const { businessMode, paymentState, isDemo, promotionIds } = input;
  if (isDemo || businessMode === 'demo' || paymentState === 'demo') return 'demo';
  if (paymentState === 'operator_started' || businessMode === 'courtesy') return 'courtesy';
  if (businessMode === 'promotional') return 'promotion';
  if (businessMode !== 'paid') return 'free';
  switch (paymentState) {
    case 'approved':
      return promotionIds.length > 0 ? 'promotion' : 'paid_simulated';
    case 'free':
    case 'not_required':
      return promotionIds.length > 0 ? 'promotion' : 'free';
    case 'declined':
    case 'expired':
    case 'unavailable':
    case 'device_out_of_service':
      return 'failed';
    default:
      return 'voided';
  }
}

/** Contexto para construir el registro; los campos opcionales cubren lo que la sesión no lleva. */
export interface SessionRecordContext {
  machine: Machine;
  softwareVersion: string;
  endedAt?: Date;
  result?: SessionResult;
  /** Modo de la política aplicada; `StationSession.retention` no lo transporta. */
  retentionMode?: RetentionMode;
  abandonedAtStage?: SessionStage;
  recoveredFrom?: SessionRecord['recoveredFrom'];
  campaignId?: Id;
}

function resultForStage(stage: SessionStage): SessionResult | undefined {
  switch (stage) {
    case 'done':
      return 'completed';
    case 'cancelled':
    case 'failed':
    case 'expired':
    case 'abandoned':
      return stage;
    default:
      return undefined;
  }
}

/**
 * Registro de sesión sin fotografías: es lo único que viaja a la nube (requisito 22). No copia
 * ninguna URL ni ruta de captura, edición, composición o impresión.
 */
export function sessionRecordFrom(session: StationSession, ctx: SessionRecordContext): SessionRecord {
  const endedAtIso = ctx.endedAt?.toISOString() ?? session.endedAt;
  const startedMs = Date.parse(session.startedAt);
  const endedMs = endedAtIso === undefined ? Number.NaN : Date.parse(endedAtIso);
  const durationSec = Number.isNaN(startedMs) || Number.isNaN(endedMs) ? undefined : Math.max(0, Math.floor((endedMs - startedMs) / 1000));
  const result = ctx.result ?? resultForStage(session.stage);
  const jobs = session.printJobs.filter((job) => !job.isTest);
  const printsRequested = jobs.filter((job) => job.status !== 'cancelled').reduce((sum, job) => sum + job.copies, 0);
  const printsCompleted = jobs.filter((job) => job.status === 'completed').reduce((sum, job) => sum + job.copies, 0);
  const abandonedAtStage =
    ctx.abandonedAtStage ??
    (result !== undefined && result !== 'completed' && !TERMINAL_STAGES.includes(session.stage) ? session.stage : undefined);
  const editingTools = session.editingToolsUsed ?? [];
  const editingUsed = editingTools.length > 0 || Object.values(session.edits ?? {}).some((ops) => ops.length > 0);
  const retentionMode: RetentionMode = ctx.retentionMode ?? (session.retention.deleteAt !== undefined ? 'temporary' : 'none');

  const record: SessionRecord = {
    id: session.id,
    code: session.code,
    machineId: ctx.machine.id,
    organizationId: ctx.machine.organizationId,
    startedAt: session.startedAt,
    stage: session.stage,
    productId: session.product.id,
    productName: session.product.displayName.es,
    productKind: session.product.kind,
    templateId: session.templateId,
    templateVersion: session.templateVersion,
    captures: session.captures.length,
    retakes: session.retakesUsed,
    printsRequested,
    printsCompleted,
    commercial: {
      state: session.commercial.state,
      promotionIds: session.commercial.promotionIds ?? [],
      paymentState: session.commercial.paymentState,
      ...(session.commercial.listPrice !== undefined ? { listPrice: session.commercial.listPrice } : {}),
      ...(session.commercial.finalPrice !== undefined ? { finalPrice: session.commercial.finalPrice } : {}),
      ...(session.commercial.paymentRef !== undefined ? { paymentRef: session.commercial.paymentRef } : {}),
      ...(session.commercial.adapter !== undefined ? { adapter: session.commercial.adapter } : {}),
    },
    softwareVersion: ctx.softwareVersion,
    bundleVersion: session.bundleVersion,
    errors: session.errors.map((error) => ({ ...error })),
    consents: session.consents.map((consent) => ({ ...consent })),
    retention: {
      policyId: session.retention.policyId,
      mode: retentionMode,
      ...(session.retention.deleteAt !== undefined ? { deleteAt: session.retention.deleteAt } : {}),
      ...(session.retention.deletedAt !== undefined ? { deletedAt: session.retention.deletedAt } : {}),
    },
    isDemo: session.isDemo,
    operatorStarted: session.operatorStarted,
    locale: session.locale,
    editingUsed,
    editingTools,
    ...(ctx.machine.locationId !== undefined ? { locationId: ctx.machine.locationId } : {}),
    ...(ctx.machine.franchiseId !== undefined ? { franchiseId: ctx.machine.franchiseId } : {}),
    ...(endedAtIso !== undefined ? { endedAt: endedAtIso } : {}),
    ...(result !== undefined ? { result } : {}),
    ...(session.presetVersion !== undefined ? { presetId: session.presetVersion.presetId, presetVersion: session.presetVersion.version } : {}),
    ...(session.experienceId !== undefined ? { experienceId: session.experienceId } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
    ...(abandonedAtStage !== undefined ? { abandonedAtStage } : {}),
    ...(ctx.recoveredFrom !== undefined ? { recoveredFrom: ctx.recoveredFrom } : {}),
    ...(ctx.campaignId !== undefined ? { campaignId: ctx.campaignId } : {}),
  };
  // El esquema elimina cualquier clave desconocida: el registro nunca transporta una fotografía.
  return SessionRecordSchema.parse(record);
}

export type ReleaseEvent = 'assign' | 'download' | 'ready' | 'install' | 'complete' | 'fail' | 'rollback' | 'pause' | 'resume';

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly event: string,
  ) {
    super(`invalid transition: ${from} --${event}-->`);
    this.name = 'InvalidTransitionError';
  }
}

const RELEASE_TRANSITIONS: Record<ReleaseEvent, Partial<Record<MachineReleaseStatus, MachineReleaseStatus>>> = {
  assign: { up_to_date: 'pending', pending: 'pending', completed: 'pending', failed: 'pending', rolled_back: 'pending', paused: 'pending' },
  download: { pending: 'downloading' },
  ready: { downloading: 'ready' },
  install: { ready: 'installing' },
  complete: { installing: 'completed' },
  fail: { pending: 'failed', downloading: 'failed', ready: 'failed', installing: 'failed' },
  rollback: { completed: 'rolled_back', failed: 'rolled_back', installing: 'rolled_back' },
  pause: { pending: 'paused', downloading: 'paused', ready: 'paused' },
  resume: { paused: 'pending' },
};

/**
 * Ciclo de una release en una máquina (requisito 19.5):
 * pending → downloading → ready → installing → completed | failed → rolled_back; pause/resume
 * antes de instalar. Una transición inválida lanza `InvalidTransitionError`.
 */
export function nextReleaseStatus(current: MachineReleaseStatus, event: ReleaseEvent): MachineReleaseStatus {
  const next = RELEASE_TRANSITIONS[event]?.[current];
  if (next === undefined) throw new InvalidTransitionError(current, event);
  return next;
}

/** ¿La transición de release es válida? */
export function canReleaseTransition(current: MachineReleaseStatus, event: ReleaseEvent): boolean {
  return RELEASE_TRANSITIONS[event]?.[current] !== undefined;
}
