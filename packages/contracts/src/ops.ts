import { z } from 'zod';
import { AuditFields, Id, JsonValue, LocalizedText, Scope, Timestamp } from './common';

export const IncidentSeverity = z.enum(['low', 'medium', 'high', 'critical']);
export const IncidentStatus = z.enum(['open', 'investigating', 'awaiting_visit', 'awaiting_part', 'resolved', 'closed']);
export const IncidentCategory = z.enum(['printer', 'camera', 'display', 'payment', 'software', 'connectivity', 'physical', 'consumables', 'lighting', 'other']);
export type IncidentStatus = z.infer<typeof IncidentStatus>;

export const Actor = z.object({
  type: z.enum(['user', 'machine', 'system', 'cli']),
  id: Id.optional(),
  name: z.string().optional(),
});
export type Actor = z.infer<typeof Actor>;

export const Incident = z
  .object({
    id: Id,
    /** Código corto visible al cliente y al soporte (requisito 30). */
    code: z.string(),
    machineId: Id,
    locationId: Id.optional(),
    organizationId: Id,
    franchiseId: Id.optional(),
    severity: IncidentSeverity,
    category: IncidentCategory,
    title: z.string(),
    description: z.string().optional(),
    evidenceAssetIds: z.array(Id).default([]),
    reportedAt: Timestamp,
    reportedBy: Actor,
    assigneeId: Id.optional(),
    status: IncidentStatus.default('open'),
    notes: z.array(z.object({ at: Timestamp, by: Actor, text: z.string() })).default([]),
    resolution: z.string().optional(),
    partsUsed: z.array(z.string()).default([]),
    downtimeMinutes: z.number().int().optional(),
    closedAt: Timestamp.optional(),
    source: z.enum(['auto', 'manual']),
  })
  .extend(AuditFields.shape);
export type Incident = z.infer<typeof Incident>;

export const MaintenanceType = z.enum(['preventive', 'repair', 'paper_change', 'cleaning', 'inspection', 'installation', 'other']);

export const MaintenanceLog = z.object({
  id: Id,
  machineId: Id,
  type: MaintenanceType,
  performedAt: Timestamp,
  performedBy: Actor,
  checklistId: Id.optional(),
  checklistResults: z.array(z.object({ key: z.string(), ok: z.boolean(), note: z.string().optional() })).default([]),
  notes: z.string().optional(),
  consumablesUsed: z.array(z.object({ type: z.string(), qty: z.number() })).default([]),
  incidentId: Id.optional(),
});
export type MaintenanceLog = z.infer<typeof MaintenanceLog>;

export const MaintenanceChecklist = z.object({
  id: Id,
  organizationId: Id.optional(),
  hardwareProfileId: Id.optional(),
  name: LocalizedText,
  items: z.array(z.object({ key: z.string(), label: LocalizedText })),
});
export type MaintenanceChecklist = z.infer<typeof MaintenanceChecklist>;

export const ConsumableType = z.enum(['photo_paper', 'thermal_paper', 'ink_ribbon', 'cleaning_kit', 'other']);

export const Consumable = z.object({
  id: Id,
  machineId: Id,
  type: ConsumableType,
  compatibility: z.string().optional(),
  unit: z.string().default('prints'),
  installedQty: z.number().int(),
  estimatedRemaining: z.number().int(),
  changedAt: Timestamp,
  changedBy: Actor,
  localStock: z.number().int().default(0),
  history: z.array(z.object({ at: Timestamp, qty: z.number().int(), by: Actor })).default([]),
});
export type Consumable = z.infer<typeof Consumable>;

/** Entrada de auditoría inmutable (requisito 24). */
export const AuditEntry = z.object({
  id: Id,
  at: Timestamp,
  actor: Actor,
  action: z.string(),
  entityType: z.string(),
  entityId: Id.optional(),
  scope: Scope.optional(),
  before: JsonValue.optional(),
  after: JsonValue.optional(),
  origin: z.enum(['admin', 'station', 'cli', 'sync', 'system']),
  reason: z.string().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const MachineEventType = z.enum([
  'heartbeat',
  'online',
  'offline',
  'enrolled',
  'session_started',
  'session_completed',
  'session_cancelled',
  'session_failed',
  'session_recovered',
  'print_started',
  'print_completed',
  'print_failed',
  'printer_status',
  'paper_low',
  'paper_out',
  'camera_error',
  'error',
  'maintenance_on',
  'maintenance_off',
  'out_of_service',
  'back_in_service',
  'bundle_applied',
  'bundle_failed',
  'release_status',
  'command_received',
  'command_executed',
  'incident_opened',
  'incident_closed',
  'local_config_changed',
  'consumable_changed',
  'payment_event',
  'test_run',
  'restart',
]);
export type MachineEventType = z.infer<typeof MachineEventType>;

export const MachineEvent = z.object({
  id: Id,
  machineId: Id,
  at: Timestamp,
  type: MachineEventType,
  severity: z.enum(['info', 'warning', 'error']).default('info'),
  message: z.string(),
  payload: JsonValue.optional(),
  sessionId: Id.optional(),
});
export type MachineEvent = z.infer<typeof MachineEvent>;

export const PrintJobStatus = z.enum(['preparing', 'printing', 'completed', 'failed', 'retrying', 'cancelled']);
export type PrintJobStatus = z.infer<typeof PrintJobStatus>;

export const PrintJob = z.object({
  id: Id,
  sessionId: Id.optional(),
  machineId: Id,
  printerId: z.string(),
  copies: z.number().int().min(1),
  status: PrintJobStatus,
  attempt: z.number().int().default(1),
  idempotencyKey: z.string(),
  isTest: z.boolean().default(false),
  createdAt: Timestamp,
  completedAt: Timestamp.optional(),
  error: z.string().optional(),
  /** Ruta local de la salida del adaptador mock. Nunca viaja a la nube. */
  outputPath: z.string().optional(),
});
export type PrintJob = z.infer<typeof PrintJob>;
