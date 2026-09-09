/**
 * Dashboard y métricas, calculados desde `session_records`, heartbeats, estados de release,
 * consumibles e incidencias. Todo con `realMoney: false` (no existe procesador real).
 */
import type {
  Consumable,
  DashboardSummary,
  Incident,
  Location,
  Machine,
  MetricsQuery,
  MetricsResponse,
  Money,
  Product,
  ProductMetrics,
  Release,
  Rollout,
  SessionMetrics,
  SessionRecord,
} from '@psp/contracts';
import { localTimeParts } from '@psp/domain';
import type { AppContext } from './context';
import { listHeartbeats, listReleaseStates, listSessionRecords, type ScopeColumns } from './store';

const DAY_MS = 86_400_000;

function sessionMetricsOf(records: SessionRecord[]): SessionMetrics {
  const completed = records.filter((r) => r.result === 'completed');
  const durations = records.map((r) => r.durationSec).filter((d): d is number => typeof d === 'number');
  const retakes = records.map((r) => r.retakes);
  const abandoned = records.filter((r) => r.result === 'abandoned' || r.result === 'expired');
  const avg = (values: number[]): number => (values.length === 0 ? 0 : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100);
  return {
    started: records.length,
    completed: completed.length,
    cancelled: records.filter((r) => r.result === 'cancelled').length,
    failed: records.filter((r) => r.result === 'failed').length,
    avgDurationSec: avg(durations),
    avgRetakes: avg(retakes),
    photosTaken: records.reduce((a, r) => a + r.captures, 0),
    photosPrinted: records.reduce((a, r) => a + r.printsCompleted, 0),
    abandonedBeforeCapture: abandoned.filter((r) => ['started', 'product_selected', 'configuring', 'consent', 'awaiting_payment'].includes(r.abandonedAtStage ?? r.stage)).length,
    abandonedDuringEditing: abandoned.filter((r) => (r.abandonedAtStage ?? r.stage) === 'editing').length,
    abandonedBeforeFinish: abandoned.filter((r) => ['selecting', 'composing', 'confirming', 'printing', 'delivering', 'finishing'].includes(r.abandonedAtStage ?? r.stage)).length,
    editingUsageRate: records.length === 0 ? 0 : Math.round((records.filter((r) => r.editingUsed).length / records.length) * 100) / 100,
  };
}

function commercialOf(records: SessionRecord[], currency: string): MetricsResponse['totals']['commercial'] {
  const paid = records.filter((r) => r.commercial.state === 'paid_simulated' || r.commercial.state === 'paid');
  const value = paid.reduce((a, r) => a + (r.commercial.finalPrice?.amount ?? 0), 0);
  const money = (amount: number): Money => ({ amount, currency });
  return {
    registeredValue: money(value),
    realMoney: false,
    freeSessions: records.filter((r) => r.commercial.state === 'free' || r.commercial.state === 'courtesy').length,
    demoSessions: records.filter((r) => r.commercial.state === 'demo' || r.isDemo).length,
    promoSessions: records.filter((r) => r.commercial.state === 'promotion').length,
    paidSimulatedSessions: paid.length,
    avgTicket: money(paid.length === 0 ? 0 : Math.round(value / paid.length)),
  };
}

function periodKey(record: SessionRecord, granularity: MetricsQuery['granularity']): string {
  const date = new Date(record.startedAt);
  const iso = date.toISOString();
  switch (granularity) {
    case 'hour':
      return iso.slice(0, 13) + ':00';
    case 'day':
      return iso.slice(0, 10);
    case 'week': {
      const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
      return monday.toISOString().slice(0, 10);
    }
    case 'month':
      return iso.slice(0, 7);
    default:
      return iso.slice(0, 10);
  }
}

/** `POST /metrics/query`: agrega `session_records` del alcance pedido. */
export function computeMetrics(ctx: AppContext, query: MetricsQuery, allowedMachineIds: Set<string> | undefined): MetricsResponse {
  const filter: ScopeColumns & { machineIds?: string[]; productId?: string; from?: string; to?: string; includeDemo?: boolean } = {
    ...(query.organizationId !== undefined ? { organizationId: query.organizationId } : {}),
    ...(query.franchiseId !== undefined ? { franchiseId: query.franchiseId } : {}),
    ...(query.locationId !== undefined ? { locationId: query.locationId } : {}),
    ...(query.machineIds !== undefined ? { machineIds: query.machineIds } : {}),
    ...(query.productId !== undefined ? { productId: query.productId } : {}),
    from: query.from,
    to: query.to,
    includeDemo: query.includeDemo,
  };
  let records = listSessionRecords(ctx.db, filter);
  if (allowedMachineIds) records = records.filter((r) => allowedMachineIds.has(r.machineId));
  if (query.regionId !== undefined) {
    const machines = ctx.index().machines;
    records = records.filter((r) => machines.get(r.machineId)?.regionId === query.regionId);
  }
  if (query.campaignId !== undefined) records = records.filter((r) => r.campaignId === query.campaignId);
  const currency = ctx.repo.list<{ id: string; currency: string }>('organizations').find((o) => o.id === (query.organizationId ?? records[0]?.organizationId))?.currency ?? 'MXN';
  const index = ctx.index();
  const groupKey = (record: SessionRecord): { key: string; label: string } => {
    switch (query.groupBy) {
      case 'machine':
        return { key: record.machineId, label: index.machines.get(record.machineId)?.name ?? record.machineId };
      case 'location':
        return { key: record.locationId ?? 'none', label: (record.locationId && index.locations.get(record.locationId)?.internalName) || 'Sin ubicación' };
      case 'city':
        return { key: (record.locationId && index.locations.get(record.locationId)?.address.city) || 'none', label: (record.locationId && index.locations.get(record.locationId)?.address.city) || 'Sin ciudad' };
      case 'franchise':
        return { key: record.franchiseId ?? 'none', label: (record.franchiseId && index.franchises.get(record.franchiseId)?.name) || 'Sin franquicia' };
      case 'organization':
        return { key: record.organizationId, label: index.organizations.get(record.organizationId)?.name ?? record.organizationId };
      case 'product':
        return { key: record.productId, label: record.productName };
      case 'campaign':
        return { key: record.campaignId ?? 'none', label: record.campaignId ?? 'Sin campaña' };
      default: {
        const key = periodKey(record, query.granularity);
        return { key, label: key };
      }
    }
  };
  const groups = new Map<string, { label: string; records: SessionRecord[] }>();
  for (const record of records) {
    const { key, label } = groupKey(record);
    const group = groups.get(key) ?? { label, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  const series = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, group]) => ({ key, label: group.label, sessions: sessionMetricsOf(group.records), commercial: commercialOf(group.records, currency) }));
  const byProduct = new Map<string, SessionRecord[]>();
  for (const record of records) byProduct.set(record.productId, [...(byProduct.get(record.productId) ?? []), record]);
  const products: ProductMetrics[] = [...byProduct.entries()].map(([productId, group]) => {
    const metrics = sessionMetricsOf(group);
    return {
      productId,
      productName: group[0]?.productName ?? productId,
      sessions: group.length,
      completed: metrics.completed,
      conversionFromHome: group.length === 0 ? 0 : Math.round((metrics.completed / group.length) * 100) / 100,
      avgRetakes: metrics.avgRetakes,
      avgDurationSec: metrics.avgDurationSec,
      failures: metrics.failed,
      editingUsageRate: metrics.editingUsageRate,
      registeredValue: commercialOf(group, currency).registeredValue,
    };
  });
  return { query, totals: { sessions: sessionMetricsOf(records), commercial: commercialOf(records, currency) }, series, products };
}

/** `GET /dashboard`: resumen operativo del alcance visible. */
export function computeDashboard(ctx: AppContext, machines: Machine[]): DashboardSummary {
  const now = ctx.now();
  const nowIso = now.toISOString();
  const machineIds = new Set(machines.map((m) => m.id));
  const index = ctx.index();
  const heartbeats = new Map(listHeartbeats(ctx.db).map((h) => [h.machineId, h]));
  const records = listSessionRecords(ctx.db, { from: new Date(now.getTime() - 8 * DAY_MS).toISOString(), includeDemo: true }).filter((r) => machineIds.has(r.machineId));
  const timezoneOf = (machine: Machine): string =>
    machine.timezone ?? (machine.locationId ? index.locations.get(machine.locationId)?.timezone : undefined) ?? index.organizations.get(machine.organizationId)?.timezone ?? 'UTC';
  const todayByMachine = new Map<string, string>();
  for (const machine of machines) todayByMachine.set(machine.id, localTimeParts(now, timezoneOf(machine)).isoDate);
  const today = records.filter((r) => {
    const machine = index.machines.get(r.machineId);
    const tz = machine ? timezoneOf(machine) : 'UTC';
    return localTimeParts(new Date(r.startedAt), tz).isoDate === todayByMachine.get(r.machineId);
  });
  const active = machines.filter((m) => m.status === 'active');
  const warnings = machines.filter((m) => m.status === 'active_with_warnings');
  const maintenance = machines.filter((m) => m.status === 'maintenance');
  const offline = machines.filter((m) => !m.online && !['retired', 'storage', 'suspended'].includes(m.status));
  const needAttention: DashboardSummary['machines']['needAttention'] = [];
  for (const machine of machines) {
    const heartbeat = heartbeats.get(machine.id);
    if (!machine.online && !['retired', 'storage', 'suspended', 'configuring'].includes(machine.status)) needAttention.push({ machineId: machine.id, name: machine.name, reason: 'offline' });
    else if (machine.status === 'out_of_service') needAttention.push({ machineId: machine.id, name: machine.name, reason: 'out_of_service' });
    else if (heartbeat?.printers.some((p) => p.status === 'no_paper' || p.status === 'jam' || p.status === 'error')) needAttention.push({ machineId: machine.id, name: machine.name, reason: 'printer_problem' });
    else if (heartbeat && heartbeat.pendingEvents > 100) needAttention.push({ machineId: machine.id, name: machine.name, reason: 'sync_backlog' });
    else if (heartbeat && heartbeat.health.storagePct > 90) needAttention.push({ machineId: machine.id, name: machine.name, reason: 'storage_low' });
  }
  const lastSession = new Map<string, string>();
  for (const record of records) {
    const previous = lastSession.get(record.machineId);
    if (previous === undefined || previous < record.startedAt) lastSession.set(record.machineId, record.startedAt);
  }
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const idle = machines
    .filter((m) => ['active', 'active_with_warnings'].includes(m.status) && (lastSession.get(m.id) ?? '') < sevenDaysAgo)
    .map((m) => ({ machineId: m.id, name: m.name, ...(lastSession.get(m.id) !== undefined ? { lastSessionAt: lastSession.get(m.id) as string } : {}) }));
  const productSessions = new Map<string, { name: string; sessions: number }>();
  const locationSessions = new Map<string, number>();
  for (const record of today) {
    const product = productSessions.get(record.productId) ?? { name: record.productName, sessions: 0 };
    product.sessions += 1;
    productSessions.set(record.productId, product);
    if (record.locationId) locationSessions.set(record.locationId, (locationSessions.get(record.locationId) ?? 0) + 1);
  }
  const products = ctx.repo.list<Product>('products');
  const topProducts = [...productSessions.entries()]
    .map(([productId, entry]) => ({ productId, name: products.find((p) => p.id === productId)?.displayName.es ?? entry.name, sessions: entry.sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);
  const topLocations = [...locationSessions.entries()]
    .map(([locationId, sessions]) => ({ locationId, name: (index.locations.get(locationId) as Location | undefined)?.internalName ?? locationId, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);
  const consumablesAttention: DashboardSummary['consumablesAttention'] = [];
  for (const machine of machines) {
    const heartbeat = heartbeats.get(machine.id);
    const fromHeartbeat = heartbeat?.consumables ?? [];
    const stored = fromHeartbeat.length > 0 ? fromHeartbeat : ctx.repo.list<Consumable>('consumables', { machineId: machine.id }).map((c) => ({ type: c.type, estimatedRemaining: c.estimatedRemaining, unit: c.unit }));
    for (const consumable of stored) {
      if (consumable.estimatedRemaining <= 50) consumablesAttention.push({ machineId: machine.id, name: machine.name, type: consumable.type, estimatedRemaining: consumable.estimatedRemaining });
    }
  }
  const releases = new Map(ctx.repo.list<Release>('releases').map((r) => [r.id, r]));
  const pendingRollouts = ctx.repo
    .list<Rollout>('rollouts')
    .filter((r) => r.status === 'in_progress' || r.status === 'paused' || r.status === 'scheduled')
    .map((rollout) => {
      const states = listReleaseStates(ctx.db, rollout.id).filter((s) => machineIds.has(s.machineId));
      return {
        rolloutId: rollout.id,
        name: rollout.name,
        version: releases.get(rollout.releaseId)?.version ?? '',
        completed: states.filter((s) => s.status === 'completed').length,
        total: states.length || rollout.stats?.total || 0,
      };
    })
    .filter((r) => r.total > 0);
  const openIncidents = ctx.repo
    .list<Incident>('incidents')
    .filter((i) => machineIds.has(i.machineId) && i.status !== 'resolved' && i.status !== 'closed')
    .map((i) => ({ incidentId: i.id, code: i.code, machineName: index.machines.get(i.machineId)?.name ?? i.machineId, severity: i.severity, title: i.title }))
    .slice(0, 50);
  return {
    generatedAt: nowIso,
    machines: {
      total: machines.length,
      active: active.length,
      offline: offline.length,
      warnings: warnings.length,
      maintenance: maintenance.length,
      needAttention: needAttention.slice(0, 50),
      idle: idle.slice(0, 50),
    },
    sessionsToday: {
      started: today.filter((r) => !r.isDemo).length,
      completed: today.filter((r) => !r.isDemo && r.result === 'completed').length,
      demo: today.filter((r) => r.isDemo).length,
    },
    topProducts,
    topLocations,
    consumablesAttention: consumablesAttention.slice(0, 50),
    pendingRollouts,
    openIncidents,
  };
}
