import { z } from 'zod';
import { Id, JsonValue, LocaleCode, LocalizedText, Money, Timestamp } from './common';
import { MachineCapabilityState, PrinterRuntime } from './capabilities';
import { MachineStatus } from './hierarchy';
import { ConfigBundle, ProductAvailabilityState } from './bundle';
import { EditingTool, Product } from './catalog';
import { DocumentPresetVersion } from './presets';
import { ConsentRecord, PaymentState, SessionCommercial, SessionError, SessionRecord, SessionStage } from './sessions';
import { AiExperienceKey, AiJobState } from './experiences';
import { CustomerHandoff } from './customer';
import { MachineEvent, PrintJob } from './ops';
import { MachineReleaseState } from './releases';

export const STATION_API_VERSION = 'station.v1' as const;

export const ServiceNotice = z.object({
  kind: z.enum(['info', 'warning', 'error']),
  code: z.string(),
  message: LocalizedText,
});

export const PaymentTerminalStatus = z.enum(['ready', 'busy', 'out_of_service', 'not_configured', 'offline']);

export const StationStatus = z.object({
  apiVersion: z.literal(STATION_API_VERSION),
  machineId: Id,
  machineCode: z.string(),
  machineName: z.string(),
  organizationId: Id,
  status: MachineStatus,
  cloudReachable: z.boolean(),
  lastSyncAt: Timestamp.optional(),
  bundleVersion: z.string().optional(),
  softwareVersion: z.string(),
  maintenance: z.object({ on: z.boolean(), message: z.string().optional() }),
  capabilities: z.array(MachineCapabilityState),
  printers: z.array(PrinterRuntime),
  paymentTerminal: z.object({ adapter: z.string(), status: PaymentTerminalStatus }),
  storage: z.object({ freeMb: z.number().int(), usedPct: z.number() }),
  time: z.object({ now: Timestamp, timezone: z.string(), localTime: z.string() }),
  activeSessionId: Id.optional(),
  demoMode: z.boolean(),
  notices: z.array(ServiceNotice),
  pendingEvents: z.number().int(),
  release: MachineReleaseState.optional(),
});
export type StationStatus = z.infer<typeof StationStatus>;

/** Vista del bundle para la UI: bundle + disponibilidad calculada + base de activos locales. */
export const KioskBundle = ConfigBundle.extend({
  availability: z.array(ProductAvailabilityState),
  assetBaseUrl: z.string(),
});
export type KioskBundle = z.infer<typeof KioskBundle>;

export const CaptureAnalysisSummary = z.object({
  faces: z.number().int(),
  passed: z.array(z.string()),
  warnings: z.array(z.string()),
  blocked: z.array(z.string()),
  sharpness: z.number().optional(),
  brightness: z.number().optional(),
});
export type CaptureAnalysisSummary = z.infer<typeof CaptureAnalysisSummary>;

export const Capture = z.object({
  id: Id,
  index: z.number().int(),
  takenAt: Timestamp,
  width: z.number().int(),
  height: z.number().int(),
  url: z.string(),
  editedUrl: z.string().optional(),
  retakeOf: Id.optional(),
  selected: z.boolean().default(false),
  analysis: CaptureAnalysisSummary.optional(),
  auto: z.boolean().default(false),
});
export type Capture = z.infer<typeof Capture>;

export const EditOp = z.object({ op: z.string(), params: z.record(z.string(), JsonValue) });
export type EditOp = z.infer<typeof EditOp>;

export const PaymentIntent = z.object({
  id: Id,
  sessionId: Id,
  amount: Money,
  state: PaymentState,
  adapter: z.string(),
  ref: z.string().optional(),
  message: LocalizedText.optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  expiresAt: Timestamp.optional(),
});
export type PaymentIntent = z.infer<typeof PaymentIntent>;

export const AiJob = z.object({
  id: Id,
  sessionId: Id,
  captureId: Id,
  experience: AiExperienceKey,
  state: AiJobState,
  provider: z.string(),
  resultUrl: z.string().optional(),
  message: LocalizedText.optional(),
  consent: ConsentRecord.optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type AiJob = z.infer<typeof AiJob>;

export const DeliveryState = z.enum(['not_available', 'coming_soon', 'queued', 'sent_simulated', 'failed']);
export const DeliveryRequestRecord = z.object({
  id: Id,
  sessionId: Id,
  channel: z.enum(['whatsapp', 'sms', 'email']),
  state: DeliveryState,
  createdAt: Timestamp,
});

export const SessionTimers = z.object({
  idleTimeoutSec: z.number().int(),
  warningBeforeCancelSec: z.number().int(),
  captureCountdownSec: z.number().int(),
  prepareBeforeCaptureSec: z.number().int(),
  reviewTimeoutSec: z.number().int(),
  autoCaptureStabilityMs: z.number().int(),
  paymentTimeoutSec: z.number().int(),
});

/** Sesión completa tal como la ve el kiosco. Vive sólo en la máquina. */
export const StationSession = z.object({
  id: Id,
  code: z.string(),
  stage: SessionStage,
  startedAt: Timestamp,
  updatedAt: Timestamp,
  endedAt: Timestamp.optional(),
  locale: LocaleCode,
  product: Product,
  presetVersion: DocumentPresetVersion.optional(),
  templateId: Id,
  templateVersion: z.number().int(),
  experienceId: Id.optional(),
  bundleVersion: z.string(),
  captures: z.array(Capture),
  retakesUsed: z.number().int(),
  edits: z.record(z.string(), z.array(EditOp)).default({}),
  editingToolsUsed: z.array(EditingTool).default([]),
  selection: z.array(Id).default([]),
  composition: z.object({ url: z.string(), width: z.number().int(), height: z.number().int(), createdAt: Timestamp }).optional(),
  copies: z.number().int(),
  printJobs: z.array(PrintJob),
  payment: PaymentIntent.optional(),
  commercial: SessionCommercial,
  consents: z.array(ConsentRecord),
  aiJobs: z.array(AiJob).default([]),
  deliveries: z.array(DeliveryRequestRecord).default([]),
  /** Enlaces efímeros de esta sesión (ADR-011). Se borran con ella. */
  handoffs: z.array(CustomerHandoff).default([]),
  timers: SessionTimers,
  retention: z.object({ policyId: Id, customerText: LocalizedText, deleteAt: Timestamp.optional(), deletedAt: Timestamp.optional() }),
  errors: z.array(SessionError),
  isDemo: z.boolean(),
  operatorStarted: z.boolean(),
  userMessage: z.string().optional(),
});
export type StationSession = z.infer<typeof StationSession>;

export const CreateSessionRequest = z.object({
  productId: Id,
  locale: LocaleCode,
  isDemo: z.boolean().default(false),
  operatorStarted: z.boolean().default(false),
  accessible: z.boolean().default(false),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

export const AdvanceStageRequest = z.object({ to: SessionStage, reason: z.string().optional() });
export const RecordConsentRequest = z.object({ consents: z.array(ConsentRecord) });

export const UploadCaptureRequest = z.object({
  index: z.number().int(),
  /** data URL o base64 crudo de PNG/JPEG. */
  imageBase64: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  analysis: CaptureAnalysisSummary.optional(),
  retakeOf: Id.optional(),
  auto: z.boolean().default(false),
});
export type UploadCaptureRequest = z.infer<typeof UploadCaptureRequest>;

export const SaveEditsRequest = z.object({
  captureId: Id,
  ops: z.array(EditOp),
  toolsUsed: z.array(EditingTool),
  resultBase64: z.string().optional(),
});
export const SetSelectionRequest = z.object({ captureIds: z.array(Id) });
export const SaveCompositionRequest = z.object({ imageBase64: z.string(), width: z.number().int(), height: z.number().int(), copies: z.number().int().min(0).optional() });
export const PrintRequest = z.object({ copies: z.number().int().min(1).optional(), printerId: z.string().optional(), idempotencyKey: z.string() });
export const CancelSessionRequest = z.object({ reason: z.string().optional() });
export const ExtendSessionRequest = z.object({ extraSec: z.number().int().min(1).max(600) });

export const FinishSessionResponse = z.object({
  session: StationSession,
  record: SessionRecord,
  retentionNotice: LocalizedText,
});

export const CreatePaymentIntentRequest = z.object({ sessionId: Id });
export const SimulatePaymentRequest = z.object({
  intentId: Id,
  outcome: z.enum(['approve', 'decline', 'cancel', 'expire', 'review', 'device_out', 'recover']),
});

export const AiJobRequest = z.object({ sessionId: Id, captureId: Id, experience: AiExperienceKey, consent: ConsentRecord.optional() });
export const DeliveryRequest = z.object({ sessionId: Id, channel: z.enum(['whatsapp', 'sms', 'email']), destination: z.string() });

/** Eventos en vivo del agente hacia el kiosco (SSE). */
export const StationEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), status: StationStatus }),
  z.object({ type: z.literal('bundle_changed'), version: z.string() }),
  z.object({ type: z.literal('printer'), printer: PrinterRuntime }),
  z.object({ type: z.literal('print_job'), job: PrintJob }),
  z.object({ type: z.literal('payment'), intent: PaymentIntent }),
  z.object({ type: z.literal('session'), session: StationSession }),
  z.object({ type: z.literal('maintenance'), on: z.boolean(), message: z.string().optional() }),
  z.object({ type: z.literal('ai_job'), job: AiJob }),
  z.object({ type: z.literal('handoff'), handoff: CustomerHandoff }),
  z.object({ type: z.literal('command'), command: z.string() }),
  z.object({ type: z.literal('machine_event'), event: MachineEvent }),
]);
export type StationEvent = z.infer<typeof StationEvent>;

/* ---------- Panel técnico (requisito 12) ---------- */

export const TechLoginRequest = z.object({ pin: z.string().min(4).max(12) });
export const TechLoginResponse = z.object({ token: z.string(), expiresAt: Timestamp });

export const TechTestKind = z.enum(['camera', 'preview', 'capture', 'print', 'lighting', 'touch', 'audio', 'storage', 'network', 'demo_session', 'composition']);
export const RunTestRequest = z.object({ kind: TechTestKind });
export const TestResult = z.object({ kind: TechTestKind, ok: z.boolean(), message: z.string(), details: JsonValue.optional(), at: Timestamp });

export const TechStatus = z.object({
  status: StationStatus,
  location: z.object({ id: Id, name: z.string() }).optional(),
  organizationName: z.string(),
  effectiveConfigSummary: z.record(z.string(), JsonValue),
  recentSessions: z.array(SessionRecord),
  recentEvents: z.array(MachineEvent),
  recentTests: z.array(TestResult),
  localOverrides: z.record(z.string(), JsonValue),
  consumables: z.array(z.object({ type: z.string(), estimatedRemaining: z.number().int(), unit: z.string() })),
  outbox: z.object({ pending: z.number().int(), oldestAt: Timestamp.optional() }),
});
export type TechStatus = z.infer<typeof TechStatus>;

export const MaintenanceActionRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('out_of_service'), message: z.string().optional() }),
  z.object({ action: z.literal('back_in_service') }),
  z.object({ action: z.literal('maintenance_on'), message: z.string().optional() }),
  z.object({ action: z.literal('maintenance_off') }),
  z.object({ action: z.literal('clear_temp_sessions') }),
  z.object({ action: z.literal('paper_changed'), printerId: z.string(), qty: z.number().int() }),
  z.object({ action: z.literal('log_maintenance'), type: z.string(), checklistId: Id.optional(), results: z.array(z.object({ key: z.string(), ok: z.boolean(), note: z.string().optional() })).default([]), notes: z.string().optional() }),
  z.object({ action: z.literal('open_incident'), severity: z.enum(['low', 'medium', 'high', 'critical']), category: z.string(), title: z.string(), description: z.string().optional() }),
  z.object({ action: z.literal('close_incident'), incidentId: Id, resolution: z.string() }),
  z.object({ action: z.literal('set_demo_mode'), on: z.boolean() }),
  z.object({ action: z.literal('sync_now') }),
]);
export type MaintenanceActionRequest = z.infer<typeof MaintenanceActionRequest>;

export const LocalConfigPatchRequest = z.object({ values: z.record(z.string(), JsonValue), reason: z.string().optional() });

/** Fallas simulables para probar la UI sin hardware real. */
export const SimulateFaultRequest = z.discriminatedUnion('fault', [
  z.object({ fault: z.literal('printer_no_paper'), printerId: z.string() }),
  z.object({ fault: z.literal('printer_jam'), printerId: z.string() }),
  z.object({ fault: z.literal('printer_ok'), printerId: z.string() }),
  z.object({ fault: z.literal('camera_off') }),
  z.object({ fault: z.literal('camera_on') }),
  z.object({ fault: z.literal('cloud_off') }),
  z.object({ fault: z.literal('cloud_on') }),
  z.object({ fault: z.literal('storage_low') }),
  z.object({ fault: z.literal('storage_ok') }),
  z.object({ fault: z.literal('payment_device_out') }),
  z.object({ fault: z.literal('payment_device_ok') }),
]);
export type SimulateFaultRequest = z.infer<typeof SimulateFaultRequest>;
