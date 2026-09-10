/**
 * Rutas `/admin/v1`. Toda entrada se valida con `safeParse`; todo listado se filtra por el alcance
 * del principal; toda mutación escribe `AuditEntry`.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  AdminListQuery,
  AssetUsage,
  AuditQuery,
  BulkApplyRequest,
  BulkPreviewRequest,
  CampaignPreviewRequest,
  ConfigLayer,
  ConfigPatchRequest,
  CONFIG_KEYS,
  ExportRequest,
  FeatureOverride,
  FleetCommand,
  FleetSimulateRequest,
  ImportApplyRequest,
  ImportPreviewRequest,
  LoginRequest,
  MachineCommandRequest,
  MetricsQuery,
  PresetPublishRequest,
  RolloutActionRequest,
  RolloutTarget,
  TimelineQuery,
  type Actor,
  type Asset,
  type Campaign,
  type DocumentPreset,
  type DocumentPresetVersion,
  type Machine,
  type PriceRule,
  type Principal,
  type Rollout,
  type Scope,
  type SessionRecord,
} from '@psp/contracts';
import { machinesInScope, resolveFeatures, scopeChain, stableHash, validatePriceRule } from '@psp/domain';
import { chainLayers, blueprintLayer, materializeBundle } from '@psp/bundler';
import { resolveEffectiveConfig, validateLayer } from '@psp/config-engine';
import {
  assertCan,
  narrowToPrincipal,
  ownScopeOf,
  principalFor,
  requirePrincipal,
  sha256HexOf,
  type UserCredential,
} from './auth';
import { conflict, forbidden, notFound, validation, type AppContext } from './context';
import { applyListQuery, coerceRow, parseListQuery, toCsv } from './listing';
import { RESOURCES, RESOURCE_BY_NAME, type ResourceDef } from './resources';
import { computeDashboard, computeMetrics } from './reports';
import { refreshRollout, runRolloutAction } from './rollouts';
import { listAuditEntries, listMachineEvents, listReleaseStates, listSessionRecords, putCommand, putCredential, putHeartbeat, putToken, type EntityType, type ScopeColumns } from './store';
import type { SimulatorHandle } from './simulator';

const TOKEN_TTL_MS = 12 * 3_600_000;

type Entity = Record<string, unknown> & { id: string };

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw validation(result.error.issues);
  return result.data as z.output<S>;
}

const actorOf = (principal: Principal): Actor => ({ type: 'user', id: principal.user.id, name: principal.user.name });

const scopeFilterOf = (query: { organizationId?: string; franchiseId?: string; regionId?: string; locationId?: string; machineId?: string }): ScopeColumns => ({
  ...(query.organizationId !== undefined ? { organizationId: query.organizationId } : {}),
  ...(query.franchiseId !== undefined ? { franchiseId: query.franchiseId } : {}),
  ...(query.regionId !== undefined ? { regionId: query.regionId } : {}),
  ...(query.locationId !== undefined ? { locationId: query.locationId } : {}),
  ...(query.machineId !== undefined ? { machineId: query.machineId } : {}),
});

export interface AdminOptions {
  simulator?: SimulatorHandle;
  fixtures?: {
    generateFleet?: (base: unknown, count: number, seed: string) => { machines: Machine[]; locations: unknown[]; configLayers: ConfigLayer[] };
  };
}

export function registerAdminRoutes(app: FastifyInstance, ctx: AppContext, opts: AdminOptions = {}): void {
  const idParam = z.object({ id: z.string().min(1) });

  /** Máquinas visibles para el principal (base de dashboard, métricas y acciones masivas). */
  const visibleMachines = (principal: Principal, filter: ScopeColumns = {}): Machine[] =>
    narrowToPrincipal(ctx.repo.list<Machine>('machines', filter), principal, 'machines.view', 'machine', ctx.index());

  const listResource = (def: ResourceDef, principal: Principal, filter: ScopeColumns): Entity[] => {
    const index = ctx.index();
    let items = ctx.repo.list<Entity>(def.type, filter);
    if (def.type === 'users') {
      const assignments = ctx.repo.list<{ userId: string }>('roleAssignments');
      items = items.map((user) => ({ ...user, __assignments: assignments.filter((a) => a.userId === user.id) }));
    }
    const narrowed = narrowToPrincipal(items, principal, def.view, def.level, index, def.type);
    return def.type === 'users' ? narrowed.map(({ __assignments: _a, ...user }) => user as Entity) : narrowed;
  };

  const getVisible = (def: ResourceDef, principal: Principal, id: string): Entity => {
    const item = ctx.repo.get<Entity>(def.type, id);
    if (!item) throw notFound(def.resource, id);
    if (listResource(def, principal, {}).every((visible) => visible.id !== id)) throw notFound(def.resource, id);
    return item;
  };

  const writeScope = (def: ResourceDef, entity: Entity): Scope => ownScopeOf(entity, def.level, ctx.index());

  const assetUsage = (assetId: string): AssetUsage => {
    const usedBy: AssetUsage['usedBy'] = [];
    const mentions = (value: unknown): boolean => JSON.stringify(value).includes(`"${assetId}"`);
    const scan = (type: EntityType, label: string): void => {
      for (const item of ctx.repo.list<Entity>(type)) {
        if (!mentions(item)) continue;
        const name = item['name'];
        usedBy.push({ type: label, id: item.id, name: typeof name === 'string' ? name : typeof name === 'object' && name !== null ? String((name as { es?: string }).es ?? '') : String(item['internalName'] ?? '') });
      }
    };
    scan('products', 'product');
    scan('templates', 'template');
    scan('campaigns', 'campaign');
    scan('configLayers', 'configLayer');
    scan('experiences', 'experience');
    return { assetId, usedBy };
  };

  /* ---------- auth ---------- */
  app.post('/auth/login', async (request, reply) => {
    const body = parse(LoginRequest, request.body);
    const credential = ctx.repo.list<UserCredential>('credentials').find((c) => c.email.toLowerCase() === body.email.toLowerCase());
    if (!credential || credential.passwordHash !== sha256HexOf(body.password)) throw forbidden('Invalid credentials');
    const principal = principalFor(ctx, credential.userId);
    if (!principal) throw forbidden('Invalid credentials');
    if (principal.user.status === 'suspended') throw forbidden('User suspended');
    const token = ctx.id('tok') + ctx.id('tok').slice(4);
    const expiresAt = new Date(ctx.now().getTime() + TOKEN_TTL_MS).toISOString();
    putToken(ctx.db, token, principal.user.id, expiresAt);
    ctx.repo.put('users', { ...principal.user, lastLoginAt: ctx.nowIso() }, ctx.nowIso());
    ctx.audit({ actor: actorOf(principal), action: 'auth.login', entityType: 'user', entityId: principal.user.id });
    return reply.send({ token, expiresAt, principal });
  });

  app.get('/auth/me', async (request) => requirePrincipal(ctx, request));

  /* ---------- dashboard, métricas, auditoría, catálogo ---------- */
  app.get('/dashboard', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const query = parseListQuery(request.query);
    const machines = visibleMachines(principal, scopeFilterOf(query));
    return computeDashboard(ctx, machines);
  });

  app.post('/metrics/query', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const query = parse(MetricsQuery, request.body);
    const allowed = new Set(narrowToPrincipal(ctx.repo.list<Machine>('machines'), principal, 'metrics.view', 'machine', ctx.index()).map((m) => m.id));
    return computeMetrics(ctx, query, allowed);
  });

  app.get('/audit', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const query = parseListQuery(request.query, AuditQuery) as z.output<typeof AuditQuery>;
    const platform = principal.permissions.some((p) => p.key === 'audit.view' && p.scope.level === 'platform');
    if (!principal.permissions.some((p) => p.key === 'audit.view')) throw forbidden('Missing permission audit.view');
    const organizationIds = new Set(principal.permissions.filter((p) => p.key === 'audit.view').map((p) => scopeChain(ctx.index(), p.scope).find((s) => s.level === 'organization')?.id).filter(Boolean));
    const entries = listAuditEntries(ctx.db, {
      ...(query.entityType !== undefined ? { entityType: query.entityType } : {}),
      ...(query.entityId !== undefined ? { entityId: query.entityId } : {}),
      ...(query.actorId !== undefined ? { actorId: query.actorId } : {}),
      ...(query.action !== undefined ? { action: query.action } : {}),
      ...(query.from !== undefined ? { from: query.from } : {}),
      ...(query.to !== undefined ? { to: query.to } : {}),
    }).filter((entry) => platform || (entry.scope !== undefined && scopeChain(ctx.index(), entry.scope).some((s) => s.level === 'organization' && organizationIds.has(s.id))));
    return applyListQuery(entries, query, ['action', 'entityType', 'entityId']);
  });

  app.get('/catalog', async (request) => {
    requirePrincipal(ctx, request);
    try {
      const moduleName = '@psp/catalog';
      const loaded = (await import(moduleName)) as { CATALOG?: unknown[] };
      return loaded.CATALOG ?? [];
    } catch {
      return [];
    }
  });

  /* ---------- configuración y features ---------- */
  const targetQuery = z.object({ level: z.enum(['platform', 'organization', 'franchise', 'region', 'location', 'machine']), id: z.string().optional() });

  const layersFor = (scope: Scope): { chain: Scope[]; layers: ConfigLayer[] } => {
    const chain = scopeChain(ctx.index(), scope);
    const all = ctx.repo.list<ConfigLayer>('configLayers');
    const layers = chainLayers(all, chain);
    if (scope.level === 'machine' && scope.id) {
      const machine = ctx.index().machines.get(scope.id);
      const blueprint = machine?.blueprintId ? ctx.repo.list<Parameters<typeof blueprintLayer>[0]>('blueprints').find((b) => b.id === machine.blueprintId) : undefined;
      if (blueprint) layers.push(blueprintLayer(blueprint, all));
    }
    return { chain, layers };
  };

  app.get('/config/effective', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const target = parse(targetQuery, request.query);
    const scope: Scope = target.level === 'platform' ? { level: 'platform' } : { level: target.level, id: target.id };
    if (scope.level !== 'platform' && !scope.id) throw validation('id is required');
    assertCan(principal, 'config.edit', scope, ctx.index());
    const { layers } = layersFor(scope);
    const effective = resolveEffectiveConfig({ layers, definitions: CONFIG_KEYS, now: ctx.now(), timezone: 'UTC' });
    return { target: { level: target.level, ...(target.id !== undefined ? { id: target.id } : {}) }, effective, chain: layers, definitions: CONFIG_KEYS };
  });

  /** Upsert de la capa de un nivel/entidad: valida contra los padres, audita e invalida bundles. */
  const patchLayer = (principal: Principal, patch: z.output<typeof ConfigPatchRequest>): ConfigLayer => {
    const scope: Scope = patch.level === 'platform' ? { level: 'platform' } : { level: patch.level, id: patch.entityId };
    if (scope.level !== 'platform' && !scope.id) throw validation('entityId is required');
    assertCan(principal, 'config.edit', scope, ctx.index());
    const all = ctx.repo.list<ConfigLayer>('configLayers');
    const existing = all.filter((l) => l.level === patch.level && (patch.level === 'platform' ? l.entityId === undefined : l.entityId === patch.entityId)).sort((a, b) => a.version - b.version).at(-1);
    const values = { ...(existing?.values ?? {}), ...(patch.values ?? {}) };
    for (const key of patch.unset ?? []) delete values[key];
    const locks = patch.locks !== undefined ? patch.locks.map((lock) => ({ ...lock, setBy: patch.level, ...(patch.entityId !== undefined ? { setById: patch.entityId } : {}) })) : (existing?.locks ?? []);
    const layer: ConfigLayer = {
      id: existing?.id ?? ctx.id('cfg'),
      level: patch.level,
      ...(patch.entityId !== undefined ? { entityId: patch.entityId } : {}),
      values,
      locks,
      version: (existing?.version ?? 0) + 1,
      updatedAt: ctx.nowIso(),
      updatedBy: principal.user.id,
    };
    const parents = chainLayers(all, scopeChain(ctx.index(), scope)).filter((l) => l.level !== patch.level);
    const result = validateLayer(layer, parents, CONFIG_KEYS);
    if (!result.ok) throw validation(result.violations, 'Config layer violates locks or definitions');
    ctx.repo.put('configLayers', layer, layer.updatedAt);
    ctx.audit({ actor: actorOf(principal), action: 'config.patch', entityType: 'configLayer', entityId: layer.id, scope, before: existing, after: layer, ...(patch.reason !== undefined ? { reason: patch.reason } : {}) });
    ctx.invalidate(machinesInScope(ctx.index(), scope).map((m) => m.id));
    return layer;
  };

  app.post('/config', async (request) => {
    const principal = requirePrincipal(ctx, request);
    return patchLayer(principal, parse(ConfigPatchRequest, request.body));
  });

  app.post('/features/resolve', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const target = parse(targetQuery, request.query);
    const scope: Scope = target.level === 'platform' ? { level: 'platform' } : { level: target.level, id: target.id };
    assertCan(principal, 'features.manage', scope, ctx.index());
    const source = ctx.source();
    const machine = scope.level === 'machine' && scope.id ? ctx.index().machines.get(scope.id) : undefined;
    return resolveFeatures({ chain: scopeChain(ctx.index(), scope), overrides: source.featureOverrides, entitlements: source.entitlements, plans: source.entitlementPlans, ...(machine ? { machine } : {}), now: ctx.now() });
  });

  /* ---------- acciones masivas ---------- */
  const bulkAffected = (principal: Principal, targets: Scope[]): Machine[] => {
    const index = ctx.index();
    const seen = new Map<string, Machine>();
    for (const target of targets) {
      assertCan(principal, 'machines.edit', target, index);
      for (const machine of machinesInScope(index, target)) seen.set(machine.id, machine);
    }
    return [...seen.values()];
  };
  const bulkPreview = (principal: Principal, body: z.output<typeof BulkPreviewRequest>) => {
    const affected = bulkAffected(principal, body.targets).map((machine) => ({
      machineId: machine.id,
      name: machine.name,
      ...(machine.locationId ? { locationName: ctx.index().locations.get(machine.locationId)?.internalName ?? machine.locationId } : {}),
      ...(machine.bundleVersion ? { currentBundle: machine.bundleVersion } : {}),
      wouldChange: true,
    }));
    return { affected, count: affected.length, confirmToken: stableHash({ action: body.action, targets: body.targets, payload: body.payload }) };
  };

  app.post('/bulk/preview', async (request) => bulkPreview(requirePrincipal(ctx, request), parse(BulkPreviewRequest, request.body)));

  app.post('/bulk/apply', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const body = parse(BulkApplyRequest, request.body);
    const preview = bulkPreview(principal, body);
    if (preview.confirmToken !== body.confirmToken) throw conflict('confirmToken does not match the preview');
    const machines = bulkAffected(principal, body.targets);
    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const now = ctx.nowIso();
    let applied = 0;
    switch (body.action) {
      case 'config_patch':
        for (const target of body.targets) {
          patchLayer(principal, parse(ConfigPatchRequest, { level: target.level, entityId: target.id, values: payload['values'], unset: payload['unset'], reason: body.reason }));
          applied += 1;
        }
        break;
      case 'feature_override':
        for (const target of body.targets) {
          assertCan(principal, 'features.manage', target, ctx.index());
          const override = parse(FeatureOverride, { id: ctx.id('fov'), key: payload['key'], mode: payload['mode'], scope: target, reason: body.reason, setBy: principal.user.id, setAt: now });
          ctx.repo.put('featureOverrides', override, now);
          ctx.audit({ actor: actorOf(principal), action: 'bulk.feature_override', entityType: 'featureOverride', entityId: override.id, scope: target, after: override, ...(body.reason !== undefined ? { reason: body.reason } : {}) });
          applied += 1;
        }
        ctx.invalidate(machines.map((m) => m.id));
        break;
      case 'status': {
        const status = parse(z.object({ status: z.string() }), payload).status;
        for (const machine of machines) {
          const updated = parse(RESOURCE_BY_NAME['machines']!.schema, { ...machine, status, updatedAt: now }) as Machine;
          ctx.repo.put('machines', updated, now);
          putCommand(ctx.db, { id: ctx.id('cmd'), type: 'set_status', issuedAt: now, issuedBy: principal.user.id, status: updated.status, ...(body.reason !== undefined ? { reason: body.reason } : {}) }, machine.id);
          ctx.audit({ actor: actorOf(principal), action: 'bulk.status', entityType: 'machine', entityId: machine.id, scope: { level: 'machine', id: machine.id }, before: machine, after: updated, ...(body.reason !== undefined ? { reason: body.reason } : {}) });
          applied += 1;
        }
        ctx.invalidate(machines.map((m) => m.id));
        break;
      }
      case 'command':
        for (const machine of machines) {
          assertCan(principal, 'machines.commands', { level: 'machine', id: machine.id }, ctx.index());
          const command = parse(FleetCommand, { ...payload, id: ctx.id('cmd'), issuedAt: now, issuedBy: principal.user.id, reason: body.reason });
          putCommand(ctx.db, command, machine.id);
          ctx.audit({ actor: actorOf(principal), action: 'bulk.command', entityType: 'command', entityId: command.id, scope: { level: 'machine', id: machine.id }, after: command });
          applied += 1;
        }
        break;
      default:
        throw validation(`Bulk action ${body.action} is not supported yet`);
    }
    return { ...preview, applied };
  });

  /* ---------- importación / exportación ---------- */
  const IMPORT_RESOURCE: Record<z.output<typeof ImportPreviewRequest>['entityType'], string> = { machines: 'machines', locations: 'locations', products: 'products', prices: 'price-rules', presets: 'presets' };

  const importPreview = (principal: Principal, body: z.output<typeof ImportPreviewRequest>) => {
    const def = RESOURCE_BY_NAME[IMPORT_RESOURCE[body.entityType]]!;
    if (!principal.permissions.some((p) => p.key === 'data.import')) throw forbidden('Missing permission data.import');
    const errors: Array<{ row: number; field?: string; message: string }> = [];
    const preview: unknown[] = [];
    const now = ctx.nowIso();
    body.rows.forEach((raw, i) => {
      const candidate = coerceRow(raw);
      if (candidate['id'] === undefined) candidate['id'] = `${def.idPrefix}_${stableHash({ type: def.type, i, raw }).slice(0, 12)}`;
      if (candidate['createdAt'] === undefined) candidate['createdAt'] = now;
      if (candidate['updatedAt'] === undefined) candidate['updatedAt'] = now;
      const result = def.schema.safeParse(candidate);
      if (!result.success) {
        for (const issue of result.error.issues) errors.push({ row: i, field: issue.path.join('.'), message: issue.message });
        return;
      }
      const entity = result.data as Entity;
      if (!principal.permissions.some((p) => p.key === def.write) || !canWrite(principal, def, entity)) {
        errors.push({ row: i, message: 'forbidden: outside of your scope' });
        return;
      }
      preview.push(entity);
    });
    return { valid: preview.length, invalid: body.rows.length - preview.length, errors, preview, confirmToken: stableHash({ entityType: body.entityType, rows: body.rows }) };
  };

  const canWrite = (principal: Principal, def: ResourceDef, entity: Entity): boolean => {
    try {
      assertCan(principal, def.write, writeScope(def, entity), ctx.index());
      return true;
    } catch {
      return false;
    }
  };

  app.post('/import/preview', async (request) => importPreview(requirePrincipal(ctx, request), parse(ImportPreviewRequest, request.body)));

  app.post('/import/apply', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const body = parse(ImportApplyRequest, request.body);
    const preview = importPreview(principal, body);
    if (preview.confirmToken !== body.confirmToken) throw conflict('confirmToken does not match the preview');
    const def = RESOURCE_BY_NAME[IMPORT_RESOURCE[body.entityType]]!;
    const now = ctx.nowIso();
    for (const entity of preview.preview as Entity[]) {
      const before = ctx.repo.get<Entity>(def.type, entity.id);
      ctx.repo.put(def.type, entity, now);
      ctx.audit({ actor: actorOf(principal), action: 'import.apply', entityType: def.type, entityId: entity.id, scope: writeScope(def, entity), before, after: entity });
    }
    ctx.invalidate();
    return { ...preview, applied: preview.preview.length };
  });

  const EXPORT_RESOURCE: Record<string, string> = { machines: 'machines', locations: 'locations', incidents: 'incidents', maintenance: 'maintenance-logs', consumables: 'consumables', products: 'products', prices: 'price-rules', presets: 'presets' };

  app.post('/export', async (request, reply) => {
    const principal = requirePrincipal(ctx, request);
    const body = parse(ExportRequest, request.body);
    if (!principal.permissions.some((p) => p.key === 'data.export')) throw forbidden('Missing permission data.export');
    const query = body.filters ?? AdminListQuery.parse({});
    let rows: Array<Record<string, unknown>>;
    if (body.entityType === 'sessions') {
      const allowed = new Set(visibleMachines(principal).map((m) => m.id));
      rows = listSessionRecords(ctx.db, { ...scopeFilterOf(query), includeDemo: true }).filter((r) => allowed.has(r.machineId));
    } else if (body.entityType === 'metrics') {
      const to = ctx.now();
      const from = new Date(to.getTime() - 30 * 86_400_000);
      const allowed = new Set(visibleMachines(principal).map((m) => m.id));
      rows = computeMetrics(ctx, MetricsQuery.parse({ from: from.toISOString(), to: to.toISOString(), ...scopeFilterOf(query) }), allowed).series.map((point) => ({ key: point.key, ...point.sessions, registeredValue: point.commercial.registeredValue.amount }));
    } else {
      const def = RESOURCE_BY_NAME[EXPORT_RESOURCE[body.entityType] ?? '']!;
      rows = applyListQuery(listResource(def, principal, scopeFilterOf(query)), { ...query, page: 1, pageSize: 500 }, def.searchFields).items;
    }
    ctx.audit({ actor: actorOf(principal), action: 'data.export', entityType: body.entityType, after: { rows: rows.length } });
    return reply.header('content-type', 'text/csv; charset=utf-8').send(toCsv(rows));
  });

  /* ---------- simulación de flota ---------- */
  app.post('/fleet/simulate', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const body = parse(FleetSimulateRequest, request.body);
    const organizationId = body.organizationId ?? ctx.repo.list<{ id: string }>('organizations')[0]?.id;
    if (!organizationId) throw validation('No organization to simulate into');
    assertCan(principal, 'machines.edit', { level: 'organization', id: organizationId }, ctx.index());
    if (!opts.fixtures?.generateFleet) throw conflict('Fleet generator (@psp/fixtures.generateFleet) is not available');
    const base = {
      organizations: ctx.repo.list('organizations').filter((o) => (o as { id: string }).id === organizationId),
      franchises: ctx.repo.list('franchises').filter((f) => body.franchiseId === undefined || (f as { id: string }).id === body.franchiseId),
      regions: ctx.repo.list('regions'),
      locations: ctx.repo.list('locations'),
      machines: ctx.repo.list('machines'),
      hardwareProfiles: ctx.repo.list('hardwareProfiles'),
      blueprints: ctx.repo.list('blueprints'),
    };
    const result = opts.fixtures.generateFleet(base, body.count, `simulate:${ctx.nowIso()}`);
    const now = ctx.nowIso();
    for (const location of result.locations) ctx.repo.put('locations', location as Entity, now);
    for (const layer of result.configLayers) ctx.repo.put('configLayers', layer, now);
    for (const machine of result.machines) {
      const stored: Machine = { ...machine, ...(body.franchiseId !== undefined ? { franchiseId: body.franchiseId } : {}) };
      ctx.repo.put('machines', stored, now);
      putCredential(ctx.db, stored.id, stableHash(`secret:${stored.id}`));
      putHeartbeat(ctx.db, {
        machineId: stored.id,
        at: now,
        localTime: '12:00',
        timezone: stored.timezone ?? 'UTC',
        softwareVersion: stored.softwareVersion ?? '0.0.0',
        ...(stored.bundleVersion !== undefined ? { bundleVersion: stored.bundleVersion } : {}),
        status: stored.status,
        capabilities: stored.capabilities,
        printers: stored.printers.map((p) => ({ ...p, status: 'ready' as const, paperEstimate: 200 })),
        consumables: [],
        health: { diskFreeMb: 50000, storagePct: 20, uptimeSec: 3600, cloudReachable: true },
        release: { currentVersion: stored.softwareVersion ?? '0.0.0', status: 'up_to_date', requiresRestart: false },
        pendingEvents: 0,
        maintenance: { on: false },
      });
    }
    ctx.invalidate();
    ctx.audit({ actor: actorOf(principal), action: 'fleet.simulate', entityType: 'machine', scope: { level: 'organization', id: organizationId }, after: { count: result.machines.length } });
    if (body.heartbeats && opts.simulator) opts.simulator.start();
    return { machines: result.machines.length, locations: result.locations.length, simulator: body.heartbeats && opts.simulator ? 'running' : 'off' };
  });

  /* ---------- rutas especiales ---------- */
  app.get('/presets/:id/versions', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    getVisible(RESOURCE_BY_NAME['presets']!, principal, id);
    return ctx.repo.list<DocumentPresetVersion>('presetVersions').filter((v) => v.presetId === id).sort((a, b) => a.version - b.version);
  });

  app.post('/presets/:id/versions', async (request, reply) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    const body = parse(PresetPublishRequest, request.body);
    const def = RESOURCE_BY_NAME['presets']!;
    const preset = getVisible(def, principal, id) as unknown as DocumentPreset;
    assertCan(principal, def.write, writeScope(def, preset as unknown as Entity), ctx.index());
    const versions = ctx.repo.list<DocumentPresetVersion>('presetVersions').filter((v) => v.presetId === id);
    const next = Math.max(preset.currentVersion, ...versions.map((v) => v.version)) + 1;
    const now = ctx.nowIso();
    const version: DocumentPresetVersion & { id: string } = { id: `${id}:${next}`, presetId: id, version: next, spec: body.spec, changeNote: body.changeNote, createdAt: now, createdBy: principal.user.id };
    ctx.repo.put('presetVersions', version, now);
    const updated: DocumentPreset = { ...preset, currentVersion: next, updatedAt: now, updatedBy: principal.user.id };
    ctx.repo.put('presets', updated, now);
    ctx.audit({ actor: actorOf(principal), action: 'presets.publish', entityType: 'preset', entityId: id, scope: writeScope(def, preset as unknown as Entity), before: { currentVersion: preset.currentVersion }, after: { currentVersion: next, changeNote: body.changeNote } });
    ctx.invalidate();
    return reply.code(201).send(version);
  });

  app.get('/assets/:id/content', async (request, reply) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    const asset = getVisible(RESOURCE_BY_NAME['assets']!, principal, id) as unknown as Asset;
    const bytes = ctx.readAsset(asset.hash);
    if (!bytes) throw notFound('asset content', asset.hash);
    return reply.header('content-type', asset.mime).send(bytes);
  });

  app.get('/assets/:id/usage', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    getVisible(RESOURCE_BY_NAME['assets']!, principal, id);
    return assetUsage(id);
  });

  app.post('/campaigns/:id/preview', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    const body = parse(CampaignPreviewRequest, request.body);
    const campaign = getVisible(RESOURCE_BY_NAME['campaigns']!, principal, id) as unknown as Campaign;
    getVisible(RESOURCE_BY_NAME['machines']!, principal, body.machineId);
    const at = body.at ? new Date(body.at) : ctx.now();
    const forced: Campaign = { ...campaign, status: 'active', startsAt: new Date(at.getTime() - 1000).toISOString(), endsAt: new Date(at.getTime() + 3_600_000).toISOString(), targets: { scopes: [...campaign.targets.scopes, { level: 'machine', id: body.machineId }], tags: campaign.targets.tags } };
    const source = { ...ctx.source(), campaigns: [...ctx.source().campaigns.filter((c) => c.id !== id), forced] };
    const bundle = materializeBundle(source, body.machineId, { now: at, assetUrlBase: ctx.assetUrlBase });
    return { bundle: ctx.kioskBundle(body.machineId, bundle) };
  });

  app.post('/rollouts/:id/actions', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    const body = parse(RolloutActionRequest, request.body);
    const def = RESOURCE_BY_NAME['rollouts']!;
    const rollout = getVisible(def, principal, id) as unknown as Rollout;
    assertCan(principal, 'releases.manage', writeScope(def, rollout as unknown as Entity), ctx.index());
    const expand = body.expandTargets ? body.expandTargets.map((t) => parse(RolloutTarget, t)) : [];
    const updated = runRolloutAction(ctx, rollout, body.action, expand);
    ctx.audit({ actor: actorOf(principal), action: `rollouts.${body.action}`, entityType: 'rollout', entityId: id, before: { status: rollout.status }, after: { status: updated.status, stats: updated.stats } });
    return updated;
  });

  app.get('/rollouts/:id/machines', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    getVisible(RESOURCE_BY_NAME['rollouts']!, principal, id);
    const visible = new Set(visibleMachines(principal).map((m) => m.id));
    return listReleaseStates(ctx.db, id).filter((s) => visible.has(s.machineId));
  });

  app.get('/machines/:id/timeline', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    getVisible(RESOURCE_BY_NAME['machines']!, principal, id);
    const query = parseListQuery(request.query, TimelineQuery) as unknown as z.output<typeof TimelineQuery>;
    return listMachineEvents(ctx.db, id, { ...(query.from !== undefined ? { from: query.from } : {}), ...(query.to !== undefined ? { to: query.to } : {}), ...(query.types !== undefined ? { types: query.types } : {}), limit: query.limit });
  });

  app.get('/machines/:id/bundle', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    getVisible(RESOURCE_BY_NAME['machines']!, principal, id);
    return ctx.kioskBundle(id);
  });

  app.post('/machines/:id/commands', async (request, reply) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    const body = parse(MachineCommandRequest, request.body);
    getVisible(RESOURCE_BY_NAME['machines']!, principal, id);
    assertCan(principal, 'machines.commands', { level: 'machine', id }, ctx.index());
    const raw = (body.command ?? {}) as Record<string, unknown>;
    const command = parse(FleetCommand, { ...raw, id: typeof raw['id'] === 'string' ? raw['id'] : ctx.id('cmd'), issuedAt: ctx.nowIso(), issuedBy: principal.user.id, ...(body.reason !== undefined ? { reason: body.reason } : {}) });
    putCommand(ctx.db, command, id);
    ctx.audit({ actor: actorOf(principal), action: 'machines.command', entityType: 'command', entityId: command.id, scope: { level: 'machine', id }, after: command, ...(body.reason !== undefined ? { reason: body.reason } : {}) });
    return reply.code(201).send({ commandId: command.id });
  });

  /* ---------- sesiones (sólo lectura) ---------- */
  app.get('/sessions', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const query = parseListQuery(request.query);
    const allowed = new Set(narrowToPrincipal(ctx.repo.list<Machine>('machines'), principal, 'sessions.view', 'machine', ctx.index()).map((m) => m.id));
    const records = listSessionRecords(ctx.db, { ...scopeFilterOf(query), includeDemo: true }).filter((r) => allowed.has(r.machineId));
    return applyListQuery(records, query, ['code', 'productName']);
  });

  app.get('/sessions/:id', async (request) => {
    const principal = requirePrincipal(ctx, request);
    const { id } = parse(idParam, request.params);
    const record = listSessionRecords(ctx.db, { includeDemo: true }).find((r) => r.id === id);
    if (!record) throw notFound('session', id);
    const allowed = new Set(narrowToPrincipal(ctx.repo.list<Machine>('machines'), principal, 'sessions.view', 'machine', ctx.index()).map((m) => m.id));
    if (!allowed.has(record.machineId)) throw notFound('session', id);
    return record satisfies SessionRecord;
  });

  /* ---------- CRUD genérico ---------- */
  for (const def of RESOURCES) {
    app.get(`/${def.resource}`, async (request) => {
      const principal = requirePrincipal(ctx, request);
      const query = parseListQuery(request.query);
      return applyListQuery(listResource(def, principal, scopeFilterOf(query)), query, def.searchFields);
    });

    app.get(`/${def.resource}/:id`, async (request) => {
      const principal = requirePrincipal(ctx, request);
      const { id } = parse(idParam, request.params);
      return getVisible(def, principal, id);
    });

    app.post(`/${def.resource}`, async (request, reply) => {
      const principal = requirePrincipal(ctx, request);
      const now = ctx.nowIso();
      const raw = (request.body ?? {}) as Record<string, unknown>;
      const candidate: Record<string, unknown> = { ...raw, id: typeof raw['id'] === 'string' && raw['id'] ? raw['id'] : ctx.id(def.idPrefix) };
      if (!('createdAt' in candidate) && 'createdAt' in ((def.schema as z.ZodObject).shape ?? {})) candidate['createdAt'] = now;
      if ('updatedAt' in ((def.schema as z.ZodObject).shape ?? {})) candidate['updatedAt'] = now;
      if ('createdBy' in ((def.schema as z.ZodObject).shape ?? {})) candidate['createdBy'] = principal.user.id;
      const entity = parse(def.schema, candidate) as Entity;
      assertCan(principal, def.write, writeScope(def, entity), ctx.index());
      if (ctx.repo.get(def.type, entity.id)) throw conflict(`${def.resource} ${entity.id} already exists`);
      if (def.type === 'priceRules') validatePriceRuleAgainstParents(entity as unknown as PriceRule);
      ctx.repo.put(def.type, entity, now);
      ctx.audit({ actor: actorOf(principal), action: `${def.resource}.create`, entityType: def.type, entityId: entity.id, scope: writeScope(def, entity), after: entity });
      ctx.invalidate();
      return reply.code(201).send(entity);
    });

    app.patch(`/${def.resource}/:id`, async (request) => {
      const principal = requirePrincipal(ctx, request);
      const { id } = parse(idParam, request.params);
      const before = getVisible(def, principal, id);
      const patch = (request.body ?? {}) as Record<string, unknown>;
      const now = ctx.nowIso();
      const merged: Record<string, unknown> = { ...before, ...patch, id };
      if ('updatedAt' in ((def.schema as z.ZodObject).shape ?? {})) merged['updatedAt'] = now;
      if ('updatedBy' in ((def.schema as z.ZodObject).shape ?? {})) merged['updatedBy'] = principal.user.id;
      const entity = parse(def.schema, merged) as Entity;
      assertCan(principal, def.write, writeScope(def, before), ctx.index());
      assertCan(principal, def.write, writeScope(def, entity), ctx.index());
      if (def.type === 'priceRules') validatePriceRuleAgainstParents(entity as unknown as PriceRule);
      ctx.repo.put(def.type, entity, now);
      ctx.audit({ actor: actorOf(principal), action: `${def.resource}.update`, entityType: def.type, entityId: id, scope: writeScope(def, entity), before, after: entity });
      ctx.invalidate();
      return entity;
    });

    app.delete(`/${def.resource}/:id`, async (request, reply) => {
      const principal = requirePrincipal(ctx, request);
      const { id } = parse(idParam, request.params);
      const before = getVisible(def, principal, id);
      assertCan(principal, def.write, writeScope(def, before), ctx.index());
      if (def.type === 'assets') {
        const usage = assetUsage(id);
        if (usage.usedBy.length > 0) throw conflict('Asset is in use', usage);
      }
      ctx.repo.delete(def.type, id);
      ctx.audit({ actor: actorOf(principal), action: `${def.resource}.delete`, entityType: def.type, entityId: id, scope: writeScope(def, before), before });
      ctx.invalidate();
      return reply.code(204).send();
    });
  }

  /** Regla de precio válida respecto a las reglas de niveles superiores del mismo producto. */
  function validatePriceRuleAgainstParents(rule: PriceRule): void {
    const chain = scopeChain(ctx.index(), rule.scope);
    const parents = ctx.repo.list<PriceRule>('priceRules').filter((r) => r.id !== rule.id && r.productId === rule.productId && r.scope.level !== rule.scope.level && chain.some((s) => s.level === r.scope.level && (s.level === 'platform' || s.id === r.scope.id)));
    const result = validatePriceRule(rule, parents);
    if (!result.ok) throw validation({ reason: result.reason }, `Price rule violates a parent lock: ${result.reason ?? 'unknown'}`);
  }
}

