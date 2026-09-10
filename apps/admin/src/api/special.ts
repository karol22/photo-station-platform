/** Rutas especiales del control-plane fuera del CRUD. */
import { z } from 'zod';
import {
  AuditEntry,
  BulkPreviewResponse,
  CampaignPreviewResponse,
  CatalogEntry,
  DashboardSummary,
  DocumentPresetVersion,
  EffectiveConfigView,
  FeatureState,
  ImportPreviewResponse,
  KioskBundle,
  LoginResponse,
  MachineCommandResponse,
  MachineEvent,
  MachineReleaseState,
  MetricsResponse,
  Principal,
  Rollout,
  SupportAccess,
  paginated,
  type AssetUsage,
  type ConfigPatchRequest,
  type FleetCommand,
  type MetricsQuery,
  type ScopeFilter,
  type ScopeLevel,
} from '@psp/contracts';
import { AssetUsage as AssetUsageSchema } from '@psp/contracts';
import { Unknown, request, requestObjectUrl, requestText, type RequestOptions } from './client';
import { adminQueryToSearchParams, type ListQueryInput } from '../lib/listQuery';

const MeResponse = z.union([Principal, z.object({ principal: Principal }).transform((v) => v.principal)]);

export const auth = {
  login(email: string, password: string) {
    return request(LoginResponse, 'POST', '/auth/login', { email, password }, { skipAuth: true });
  },
  me(options?: RequestOptions) {
    return request(MeResponse, 'GET', '/auth/me', undefined, options);
  },
  async logout() {
    await request(Unknown, 'POST', '/auth/logout', {}).catch(() => undefined);
  },
};

function scopeQuery(scope: ScopeFilter): string {
  const params = new URLSearchParams();
  for (const key of ['organizationId', 'franchiseId', 'regionId', 'locationId', 'machineId'] as const) {
    const value = scope[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const dashboard = {
  summary(scope: ScopeFilter, options?: RequestOptions) {
    return request(DashboardSummary, 'GET', `/dashboard${scopeQuery(scope)}`, undefined, options);
  },
};

export const metrics = {
  query(body: MetricsQuery, options?: RequestOptions) {
    return request(MetricsResponse, 'POST', '/metrics/query', body, options);
  },
};

export interface AuditListQuery extends ListQueryInput {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
}

export const audit = {
  list(query: AuditListQuery, options?: RequestOptions) {
    const params = adminQueryToSearchParams(query);
    for (const key of ['entityType', 'entityId', 'actorId', 'action', 'from', 'to'] as const) {
      const value = query[key];
      if (value) params.set(key, value);
    }
    return request(paginated(AuditEntry), 'GET', `/audit?${params.toString()}`, undefined, options);
  },
};

export const machines = {
  timeline(id: string, query: { from?: string; to?: string; types?: string[]; limit?: number }, options?: RequestOptions) {
    const params = new URLSearchParams();
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.limit) params.set('limit', String(query.limit));
    for (const type of query.types ?? []) params.append('types', type);
    const qs = params.toString();
    return request(z.array(MachineEvent), 'GET', `/machines/${encodeURIComponent(id)}/timeline${qs ? `?${qs}` : ''}`, undefined, options);
  },
  bundle(id: string, options?: RequestOptions) {
    return request(KioskBundle, 'GET', `/machines/${encodeURIComponent(id)}/bundle`, undefined, options);
  },
  command(id: string, command: Omit<FleetCommand, 'id' | 'issuedAt'> | Record<string, unknown>, reason: string | undefined, options?: RequestOptions) {
    return request(MachineCommandResponse, 'POST', `/machines/${encodeURIComponent(id)}/commands`, { command, ...(reason ? { reason } : {}) }, options);
  },
};

export const config = {
  effective(level: ScopeLevel, id: string | undefined, options?: RequestOptions) {
    const params = new URLSearchParams({ level });
    if (id) params.set('id', id);
    return request(EffectiveConfigView, 'GET', `/config/effective?${params.toString()}`, undefined, options);
  },
  patch(body: ConfigPatchRequest, options?: RequestOptions) {
    return request(Unknown, 'POST', '/config', body, options);
  },
};

export const bulk = {
  preview(body: { action: string; targets: unknown[]; payload: unknown }, options?: RequestOptions) {
    return request(BulkPreviewResponse, 'POST', '/bulk/preview', body, options);
  },
  apply(body: { action: string; targets: unknown[]; payload: unknown; confirmToken: string; reason?: string }, options?: RequestOptions) {
    return request(Unknown, 'POST', '/bulk/apply', body, options);
  },
};

export const importExport = {
  preview(entityType: string, rows: Record<string, string>[], options?: RequestOptions) {
    return request(ImportPreviewResponse, 'POST', '/import/preview', { entityType, rows }, options);
  },
  apply(entityType: string, rows: Record<string, string>[], confirmToken: string, options?: RequestOptions) {
    return request(Unknown, 'POST', '/import/apply', { entityType, rows, confirmToken }, options);
  },
  exportCsv(entityType: string, filters: ListQueryInput | undefined, options?: RequestOptions) {
    return requestText('POST', '/export', { entityType, ...(filters ? { filters } : {}) }, options);
  },
};

export const features = {
  resolve(level: ScopeLevel, id: string | undefined, options?: RequestOptions) {
    const params = new URLSearchParams({ level });
    if (id) params.set('id', id);
    return request(z.array(FeatureState), 'POST', `/features/resolve?${params.toString()}`, {}, options);
  },
};

export const fleet = {
  simulate(body: { count: number; organizationId?: string; franchiseId?: string; heartbeats?: boolean }, options?: RequestOptions) {
    return request(Unknown, 'POST', '/fleet/simulate', body, options);
  },
};

export const rollouts = {
  machines(id: string, options?: RequestOptions) {
    return request(z.array(MachineReleaseState), 'GET', `/rollouts/${encodeURIComponent(id)}/machines`, undefined, options);
  },
  action(id: string, action: 'start' | 'pause' | 'resume' | 'cancel' | 'expand', expandTargets?: unknown[], options?: RequestOptions) {
    return request(z.union([Rollout, Unknown]), 'POST', `/rollouts/${encodeURIComponent(id)}/actions`, { action, ...(expandTargets ? { expandTargets } : {}) }, options);
  },
};

export const presets = {
  versions(id: string, options?: RequestOptions) {
    return request(z.array(DocumentPresetVersion), 'GET', `/presets/${encodeURIComponent(id)}/versions`, undefined, options);
  },
  publish(id: string, spec: unknown, changeNote: string, options?: RequestOptions) {
    return request(z.union([DocumentPresetVersion, Unknown]), 'POST', `/presets/${encodeURIComponent(id)}/versions`, { spec, changeNote }, options);
  },
};

export const campaigns = {
  preview(id: string, machineId: string, at?: string, options?: RequestOptions) {
    return request(CampaignPreviewResponse, 'POST', `/campaigns/${encodeURIComponent(id)}/preview`, { machineId, ...(at ? { at } : {}) }, options);
  },
};

const objectUrlCache = new Map<string, Promise<{ url: string; mime: string }>>();

export const assets = {
  content(id: string): Promise<{ url: string; mime: string }> {
    let cached = objectUrlCache.get(id);
    if (!cached) {
      cached = requestObjectUrl(`/assets/${encodeURIComponent(id)}/content`).catch((error: unknown) => {
        objectUrlCache.delete(id);
        throw error;
      });
      objectUrlCache.set(id, cached);
    }
    return cached;
  },
  usage(id: string, options?: RequestOptions): Promise<AssetUsage> {
    return request(AssetUsageSchema, 'GET', `/assets/${encodeURIComponent(id)}/usage`, undefined, options);
  },
  invalidate(id: string) {
    objectUrlCache.delete(id);
  },
};

export const support = {
  grant(body: { userId: string; scope: { level: ScopeLevel; id?: string }; permissions: string[]; reason: string; durationMinutes: number }, options?: RequestOptions) {
    return request(z.union([SupportAccess, Unknown]), 'POST', '/support-accesses', body, options);
  },
  revoke(id: string, options?: RequestOptions) {
    return request(z.union([SupportAccess, Unknown]), 'PATCH', `/support-accesses/${encodeURIComponent(id)}`, { revokedAt: new Date().toISOString() }, options);
  },
};

export const catalog = {
  list(options?: RequestOptions) {
    return request(z.array(CatalogEntry), 'GET', '/catalog', undefined, options);
  },
};
