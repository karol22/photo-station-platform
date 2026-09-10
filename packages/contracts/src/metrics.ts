import { z } from 'zod';
import { Id, Money, Timestamp } from './common';

export const MetricsGroupBy = z.enum(['machine', 'location', 'city', 'franchise', 'organization', 'product', 'campaign', 'period']);

export const MetricsQuery = z.object({
  organizationId: Id.optional(),
  franchiseId: Id.optional(),
  regionId: Id.optional(),
  locationId: Id.optional(),
  machineIds: z.array(Id).optional(),
  productId: Id.optional(),
  campaignId: Id.optional(),
  from: Timestamp,
  to: Timestamp,
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  groupBy: MetricsGroupBy.optional(),
  includeDemo: z.boolean().default(false),
});
export type MetricsQuery = z.infer<typeof MetricsQuery>;

export const SessionMetrics = z.object({
  started: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
  failed: z.number().int(),
  avgDurationSec: z.number(),
  avgRetakes: z.number(),
  photosTaken: z.number().int(),
  photosPrinted: z.number().int(),
  abandonedBeforeCapture: z.number().int(),
  abandonedDuringEditing: z.number().int(),
  abandonedBeforeFinish: z.number().int(),
  editingUsageRate: z.number(),
});
export type SessionMetrics = z.infer<typeof SessionMetrics>;

export const MachineMetrics = z.object({
  uptimePct: z.number(),
  offlineMinutes: z.number(),
  errors: z.number().int(),
  restarts: z.number().int(),
  cameraFailures: z.number().int(),
  printerFailures: z.number().int(),
  prints: z.number().int(),
  sessionsByHour: z.array(z.object({ hour: z.number().int(), sessions: z.number().int() })),
});
export type MachineMetrics = z.infer<typeof MachineMetrics>;

/** Valores registrados o simulados. `realMoney` es false hasta que exista un procesador real. */
export const CommercialMetrics = z.object({
  registeredValue: Money,
  realMoney: z.literal(false),
  freeSessions: z.number().int(),
  demoSessions: z.number().int(),
  promoSessions: z.number().int(),
  paidSimulatedSessions: z.number().int(),
  avgTicket: Money,
});
export type CommercialMetrics = z.infer<typeof CommercialMetrics>;

export const ProductMetrics = z.object({
  productId: Id,
  productName: z.string(),
  sessions: z.number().int(),
  completed: z.number().int(),
  conversionFromHome: z.number(),
  avgRetakes: z.number(),
  avgDurationSec: z.number(),
  failures: z.number().int(),
  editingUsageRate: z.number(),
  registeredValue: Money,
});
export type ProductMetrics = z.infer<typeof ProductMetrics>;

export const MetricsSeriesPoint = z.object({
  key: z.string(),
  label: z.string(),
  sessions: SessionMetrics,
  commercial: CommercialMetrics,
  machine: MachineMetrics.optional(),
});

export const MetricsResponse = z.object({
  query: MetricsQuery,
  totals: z.object({ sessions: SessionMetrics, commercial: CommercialMetrics }),
  series: z.array(MetricsSeriesPoint),
  products: z.array(ProductMetrics),
});
export type MetricsResponse = z.infer<typeof MetricsResponse>;

/** Respuestas del dashboard operativo (requisito 20). */
export const DashboardSummary = z.object({
  generatedAt: Timestamp,
  machines: z.object({
    total: z.number().int(),
    active: z.number().int(),
    offline: z.number().int(),
    warnings: z.number().int(),
    maintenance: z.number().int(),
    needAttention: z.array(z.object({ machineId: Id, name: z.string(), reason: z.string() })),
    idle: z.array(z.object({ machineId: Id, name: z.string(), lastSessionAt: Timestamp.optional() })),
  }),
  sessionsToday: z.object({ started: z.number().int(), completed: z.number().int(), demo: z.number().int() }),
  topProducts: z.array(z.object({ productId: Id, name: z.string(), sessions: z.number().int() })),
  topLocations: z.array(z.object({ locationId: Id, name: z.string(), sessions: z.number().int() })),
  consumablesAttention: z.array(z.object({ machineId: Id, name: z.string(), type: z.string(), estimatedRemaining: z.number().int() })),
  pendingRollouts: z.array(z.object({ rolloutId: Id, name: z.string(), version: z.string(), completed: z.number().int(), total: z.number().int() })),
  openIncidents: z.array(z.object({ incidentId: Id, code: z.string(), machineName: z.string(), severity: z.string(), title: z.string() })),
});
export type DashboardSummary = z.infer<typeof DashboardSummary>;
