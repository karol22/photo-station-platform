import { z } from 'zod';
import { Id, JsonValue, Timestamp } from './common';
import { MachineCapabilityState, PrinterRuntime } from './capabilities';
import { MachineStatus, ReleaseChannel } from './hierarchy';
import { MachineReleaseState } from './releases';
import { SessionRecord } from './sessions';
import { AuditEntry, Consumable, Incident, MachineEvent, MaintenanceLog, PrintJob } from './ops';
import { ConfigBundle } from './bundle';

export const FLEET_PROTOCOL_VERSION = 'fleet.v1' as const;

export const HardwareReport = z.object({
  hostname: z.string().optional(),
  platform: z.string().optional(),
  capabilities: z.array(MachineCapabilityState),
  softwareVersion: z.string(),
  hardwareProfileHint: Id.optional(),
});

export const EnrollRequest = z.object({
  provisioningToken: z.string(),
  report: HardwareReport,
});
export type EnrollRequest = z.infer<typeof EnrollRequest>;

export const EnrollResponse = z.object({
  machineId: Id,
  machineSecret: z.string(),
  organizationId: Id,
  heartbeatIntervalSec: z.number().int(),
  bundleVersion: z.string().optional(),
});
export type EnrollResponse = z.infer<typeof EnrollResponse>;

export const MachineHealth = z.object({
  cpuPct: z.number().optional(),
  memPct: z.number().optional(),
  diskFreeMb: z.number().int(),
  storagePct: z.number(),
  temperatureC: z.number().optional(),
  uptimeSec: z.number().int(),
  cloudReachable: z.boolean().default(true),
});

export const HeartbeatRequest = z.object({
  machineId: Id,
  at: Timestamp,
  localTime: z.string(),
  timezone: z.string(),
  softwareVersion: z.string(),
  bundleVersion: z.string().optional(),
  status: MachineStatus,
  capabilities: z.array(MachineCapabilityState),
  printers: z.array(PrinterRuntime),
  consumables: z.array(Consumable.pick({ type: true, estimatedRemaining: true, unit: true })).default([]),
  health: MachineHealth,
  release: MachineReleaseState.omit({ machineId: true, updatedAt: true }),
  activeSessionId: Id.optional(),
  pendingEvents: z.number().int().default(0),
  lastError: z.string().optional(),
  maintenance: z.object({ on: z.boolean(), message: z.string().optional() }).default({ on: false }),
});
export type HeartbeatRequest = z.infer<typeof HeartbeatRequest>;

const commandBase = {
  id: Id,
  issuedAt: Timestamp,
  issuedBy: Id.optional(),
  expiresAt: Timestamp.optional(),
  reason: z.string().optional(),
};

/** Comandos que viajan en la respuesta del heartbeat. Idempotentes por id. */
export const FleetCommand = z.discriminatedUnion('type', [
  z.object({ ...commandBase, type: z.literal('set_maintenance'), on: z.boolean(), message: z.string().optional() }),
  z.object({ ...commandBase, type: z.literal('set_status'), status: MachineStatus }),
  z.object({ ...commandBase, type: z.literal('reload_bundle'), version: z.string().optional() }),
  z.object({ ...commandBase, type: z.literal('apply_release'), releaseId: Id, rolloutId: Id, version: z.string(), artifactHash: z.string(), windowStartLocal: z.string().optional(), windowEndLocal: z.string().optional(), requiresRestart: z.boolean().default(false) }),
  z.object({ ...commandBase, type: z.literal('rollback_release'), toVersion: z.string(), rolloutId: Id }),
  z.object({ ...commandBase, type: z.literal('pause_release'), rolloutId: Id }),
  z.object({ ...commandBase, type: z.literal('restart_app') }),
  z.object({ ...commandBase, type: z.literal('clear_temp_sessions') }),
  z.object({ ...commandBase, type: z.literal('run_test'), kind: z.enum(['camera', 'preview', 'capture', 'print', 'lighting', 'touch', 'audio', 'storage', 'network', 'demo_session', 'composition']) }),
  z.object({ ...commandBase, type: z.literal('print_test') }),
  z.object({ ...commandBase, type: z.literal('sync_now') }),
  z.object({ ...commandBase, type: z.literal('capture_diagnostics') }),
  z.object({ ...commandBase, type: z.literal('set_local_config'), values: z.record(z.string(), JsonValue) }),
  z.object({ ...commandBase, type: z.literal('suspend') }),
  z.object({ ...commandBase, type: z.literal('resume') }),
]);
export type FleetCommand = z.infer<typeof FleetCommand>;

export const ReleaseTarget = z.object({
  releaseId: Id,
  rolloutId: Id,
  version: z.string(),
  channel: ReleaseChannel,
  artifactHash: z.string(),
  requiresRestart: z.boolean(),
  windowStartLocal: z.string().optional(),
  windowEndLocal: z.string().optional(),
});
export type ReleaseTarget = z.infer<typeof ReleaseTarget>;

export const HeartbeatResponse = z.object({
  serverTime: Timestamp,
  heartbeatIntervalSec: z.number().int(),
  bundleVersion: z.string().optional(),
  releaseTarget: ReleaseTarget.optional(),
  commands: z.array(FleetCommand),
  statusOverride: MachineStatus.optional(),
});
export type HeartbeatResponse = z.infer<typeof HeartbeatResponse>;

export const CommandAck = z.object({
  commandId: Id,
  machineId: Id,
  result: z.enum(['ok', 'failed', 'expired', 'skipped']),
  message: z.string().optional(),
  at: Timestamp,
});
export type CommandAck = z.infer<typeof CommandAck>;

const eventBase = {
  id: Id,
  machineId: Id,
  at: Timestamp,
  sequence: z.number().int(),
  softwareVersion: z.string(),
  bundleVersion: z.string().optional(),
};

/** Eventos que la máquina envía en lote. Idempotentes por id. Nunca contienen fotografías. */
export const FleetEvent = z.discriminatedUnion('type', [
  z.object({ ...eventBase, type: z.literal('session_record'), payload: SessionRecord }),
  z.object({ ...eventBase, type: z.literal('machine_event'), payload: MachineEvent }),
  z.object({ ...eventBase, type: z.literal('release_status'), payload: MachineReleaseState }),
  z.object({ ...eventBase, type: z.literal('incident'), payload: Incident }),
  z.object({ ...eventBase, type: z.literal('maintenance_log'), payload: MaintenanceLog }),
  z.object({ ...eventBase, type: z.literal('consumable_update'), payload: Consumable }),
  z.object({ ...eventBase, type: z.literal('capability_change'), payload: z.array(MachineCapabilityState) }),
  z.object({ ...eventBase, type: z.literal('local_audit'), payload: AuditEntry }),
  z.object({ ...eventBase, type: z.literal('print_job'), payload: PrintJob.omit({ outputPath: true }) }),
  z.object({ ...eventBase, type: z.literal('command_ack'), payload: CommandAck }),
  z.object({ ...eventBase, type: z.literal('diagnostics'), payload: JsonValue }),
]);
export type FleetEvent = z.infer<typeof FleetEvent>;
export type FleetEventType = FleetEvent['type'];

export const EventBatchRequest = z.object({
  machineId: Id,
  events: z.array(FleetEvent).min(1).max(1000),
});
export type EventBatchRequest = z.infer<typeof EventBatchRequest>;

export const EventBatchResponse = z.object({
  accepted: z.array(Id),
  duplicates: z.array(Id),
  rejected: z.array(z.object({ id: Id, reason: z.string() })),
});
export type EventBatchResponse = z.infer<typeof EventBatchResponse>;

export const BundleResponse = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unchanged'), version: z.string() }),
  z.object({ kind: z.literal('bundle'), bundle: ConfigBundle }),
]);
export type BundleResponse = z.infer<typeof BundleResponse>;
