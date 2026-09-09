import { z } from 'zod';
import { Id, JsonValue, ListQuery, Scope, ScopeLevel, Timestamp } from './common';
import { PermissionKey, Principal } from './rbac';
import { ConfigKeyDefinition, ConfigLayer, ConfigLock, EffectiveConfig } from './config';
import { DocumentPresetSpec } from './presets';
import { KioskBundle } from './station-api';
import { MachineEventType } from './ops';

export const ADMIN_API_VERSION = 'admin.v1' as const;

export const LoginRequest = z.object({ email: z.string(), password: z.string() });
export const LoginResponse = z.object({ token: z.string(), expiresAt: Timestamp, principal: Principal });
export type LoginResponse = z.infer<typeof LoginResponse>;

/** Filtro de alcance común a todos los listados (requisito 35). */
export const ScopeFilter = z.object({
  organizationId: Id.optional(),
  franchiseId: Id.optional(),
  regionId: Id.optional(),
  locationId: Id.optional(),
  machineId: Id.optional(),
});
export type ScopeFilter = z.infer<typeof ScopeFilter>;

export const AdminListQuery = ListQuery.extend(ScopeFilter.shape);
export type AdminListQuery = z.infer<typeof AdminListQuery>;

/** Vista de configuración efectiva con la cadena de capas (requisito 36). */
export const EffectiveConfigView = z.object({
  target: z.object({ level: ScopeLevel, id: Id.optional() }),
  effective: EffectiveConfig,
  chain: z.array(ConfigLayer),
  definitions: z.array(ConfigKeyDefinition),
});
export type EffectiveConfigView = z.infer<typeof EffectiveConfigView>;

export const ConfigPatchRequest = z.object({
  level: ScopeLevel,
  entityId: Id.optional(),
  values: z.record(z.string(), JsonValue).optional(),
  /** null elimina el override y vuelve al valor heredado. */
  unset: z.array(z.string()).optional(),
  locks: z.array(ConfigLock.omit({ setBy: true, setById: true })).optional(),
  reason: z.string().optional(),
});
export type ConfigPatchRequest = z.infer<typeof ConfigPatchRequest>;

/** Previsualización de acciones masivas: cuántas entidades cambian (requisitos 13.4, 36). */
export const BulkPreviewRequest = z.object({
  action: z.enum(['config_patch', 'feature_override', 'price_rule', 'product_availability', 'campaign_assign', 'command', 'status']),
  targets: z.array(Scope),
  payload: JsonValue,
});
export const BulkPreviewResponse = z.object({
  affected: z.array(z.object({ machineId: Id, name: z.string(), locationName: z.string().optional(), currentBundle: z.string().optional(), wouldChange: z.boolean() })),
  count: z.number().int(),
  confirmToken: z.string(),
});
export const BulkApplyRequest = BulkPreviewRequest.extend({ confirmToken: z.string(), reason: z.string().optional() });

export const RolloutActionRequest = z.object({
  action: z.enum(['start', 'pause', 'resume', 'cancel', 'expand']),
  expandTargets: z.array(z.any()).optional(),
});

export const ImportPreviewRequest = z.object({
  entityType: z.enum(['machines', 'locations', 'products', 'prices', 'presets']),
  rows: z.array(z.record(z.string(), z.string())),
});
export const ImportPreviewResponse = z.object({
  valid: z.number().int(),
  invalid: z.number().int(),
  errors: z.array(z.object({ row: z.number().int(), field: z.string().optional(), message: z.string() })),
  preview: z.array(JsonValue),
  confirmToken: z.string(),
});
export const ImportApplyRequest = ImportPreviewRequest.extend({ confirmToken: z.string() });

export const ExportRequest = z.object({
  entityType: z.enum(['machines', 'locations', 'sessions', 'incidents', 'maintenance', 'consumables', 'products', 'prices', 'presets', 'metrics']),
  filters: AdminListQuery.optional(),
});

export const SupportGrantRequest = z.object({
  userId: Id,
  scope: Scope,
  permissions: z.array(PermissionKey),
  reason: z.string().min(3),
  durationMinutes: z.number().int().min(5).max(24 * 60 * 7),
});

export const FleetSimulateRequest = z.object({
  count: z.number().int().min(1).max(2000),
  organizationId: Id.optional(),
  franchiseId: Id.optional(),
  heartbeats: z.boolean().default(true),
});

export const MachineCommandRequest = z.object({ command: JsonValue, reason: z.string().optional() });
export const MachineCommandResponse = z.object({ commandId: Id });

export const PresetPublishRequest = z.object({ spec: DocumentPresetSpec, changeNote: z.string().min(1) });

export const CampaignPreviewRequest = z.object({ machineId: Id, at: Timestamp.optional() });
export const CampaignPreviewResponse = z.object({ bundle: KioskBundle });

export const AuditQuery = AdminListQuery.extend({
  entityType: z.string().optional(),
  entityId: Id.optional(),
  actorId: Id.optional(),
  action: z.string().optional(),
  from: Timestamp.optional(),
  to: Timestamp.optional(),
});

export const TimelineQuery = z.object({
  from: Timestamp.optional(),
  to: Timestamp.optional(),
  types: z.array(MachineEventType).optional(),
  limit: z.number().int().min(1).max(1000).default(200),
});

/** Vista guardada de una lista administrativa (requisito 35). */
export const SavedView = z.object({
  id: Id,
  userId: Id,
  name: z.string(),
  route: z.string(),
  query: JsonValue,
  shared: z.boolean().default(false),
  createdAt: Timestamp,
});
export type SavedView = z.infer<typeof SavedView>;
