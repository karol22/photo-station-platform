/**
 * Rutas `/fleet/v1` (docs/protocolos/fleet-sync-v1.md). Auth `Authorization: Machine <id>:<secret>`
 * y cabecera `X-PSP-Contracts: v1`. Nunca recibe ni sirve fotografías.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CommandAck,
  EnrollRequest,
  FleetEvent,
  HeartbeatRequest,
  type BundleResponse,
  type ConfigBundle,
  type EnrollResponse,
  type EventBatchResponse,
  type HardwareProfile,
  type HeartbeatResponse,
  type Incident,
  type Machine,
  type MachineReleaseState,
  type Organization,
  type Rollout,
} from '@psp/contracts';
import { stableHash } from '@psp/domain';
import { requireMachine } from './auth';
import { HttpError, notFound, validation, type AppContext } from './context';
import { refreshRollout, releaseTargetFor } from './rollouts';
import {
  ackCommand,
  getReleaseState,
  markEventSeen,
  pendingCommands,
  putCommand,
  putCredential,
  putHeartbeat,
  putMachineEvent,
  putReleaseState,
  putSessionRecord,
  transaction,
} from './store';

export const DEMO_PROVISIONING_TOKEN = 'demo-provisioning-token';
const DEMO_ORGANIZATION = 'org_lumina';

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError(400, 'validation_error', 'Validation failed', result.error.issues);
  return result.data as z.output<S>;
}

function heartbeatInterval(bundle: ConfigBundle | undefined): number {
  const value = bundle?.effective.values['sync.heartbeatIntervalSec'];
  return typeof value === 'number' ? value : 30;
}

export function registerFleetRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const contracts = request.headers['x-psp-contracts'];
    if (contracts !== undefined && contracts !== 'v1') throw new HttpError(426, 'contracts_unsupported', `Unsupported contracts version: ${String(contracts)}`);
    reply.header('X-PSP-Contracts', 'v1');
  });

  const machineOf = (machineId: string): Machine => {
    const machine = ctx.repo.get<Machine>('machines', machineId);
    if (!machine) throw new HttpError(401, 'machine_unauthorized', 'Unknown machine');
    if (machine.status === 'retired') throw new HttpError(409, 'machine_retired', 'Machine is retired');
    return machine;
  };

  const safeBundle = (machineId: string): ConfigBundle | undefined => {
    try {
      return ctx.bundle(machineId);
    } catch (error) {
      app.log.warn({ machineId, error: error instanceof Error ? error.message : String(error) }, 'bundle materialization failed');
      return undefined;
    }
  };

  app.post('/enroll', async (request, reply) => {
    const body = parse(EnrollRequest, request.body);
    const organizations = ctx.repo.list<Organization>('organizations');
    const organization =
      body.provisioningToken === DEMO_PROVISIONING_TOKEN
        ? (organizations.find((o) => o.id === DEMO_ORGANIZATION) ?? organizations[0])
        : organizations.find((o) => stableHash(`provision:${o.id}`) === body.provisioningToken);
    if (!organization) throw new HttpError(403, 'enroll_token_invalid', 'Unknown provisioning token');
    const profiles = ctx.repo.list<HardwareProfile>('hardwareProfiles').filter((p) => p.organizationId === undefined || p.organizationId === organization.id);
    const profile = profiles.find((p) => p.id === body.report.hardwareProfileHint) ?? profiles[0];
    if (!profile) throw validation('No hardware profile available for enrollment');
    const now = ctx.nowIso();
    const hostname = body.report.hostname ?? 'station';
    const machineId = `mch_${stableHash(`enroll:${organization.id}:${hostname}:${profile.id}`).slice(0, 12)}`;
    const existing = ctx.repo.get<Machine>('machines', machineId);
    const machine: Machine = existing ?? {
      id: machineId,
      code: `ENR-${stableHash(machineId).slice(0, 6).toUpperCase()}`,
      name: `Estación ${hostname}`,
      organizationId: organization.id,
      hardwareProfileId: profile.id,
      status: 'configuring',
      capabilities: body.report.capabilities,
      printers: profile.printers,
      softwareVersion: body.report.softwareVersion,
      releaseChannel: 'stable',
      online: true,
      lastSeenAt: now,
      timezone: organization.timezone,
      localContact: {},
      tags: [],
      createdAt: now,
    };
    ctx.repo.put('machines', machine, now);
    const secret = stableHash(`secret:${machine.id}`);
    putCredential(ctx.db, machine.id, secret);
    putReleaseState(ctx.db, { machineId: machine.id, currentVersion: body.report.softwareVersion, status: 'up_to_date', requiresRestart: false, updatedAt: now });
    putMachineEvent(ctx.db, { id: ctx.id('evt'), machineId: machine.id, at: now, type: 'enrolled', severity: 'info', message: `Enrolled ${hostname}` });
    ctx.audit({ actor: { type: 'machine', id: machine.id }, action: 'fleet.enroll', entityType: 'machine', entityId: machine.id, scope: { level: 'machine', id: machine.id }, after: machine, origin: 'station' });
    ctx.invalidate([machine.id]);
    const bundle = safeBundle(machine.id);
    const response: EnrollResponse = { machineId: machine.id, machineSecret: secret, organizationId: organization.id, heartbeatIntervalSec: heartbeatInterval(bundle), ...(bundle ? { bundleVersion: bundle.version } : {}) };
    return reply.code(201).send(response);
  });

  app.post('/heartbeat', async (request) => {
    const machineId = requireMachine(ctx, request);
    const body = parse(HeartbeatRequest, request.body);
    if (body.machineId !== machineId) throw new HttpError(401, 'machine_unauthorized', 'machineId does not match credential');
    const machine = machineOf(machineId);
    const now = ctx.nowIso();
    transaction(ctx.db, () => {
      putHeartbeat(ctx.db, body);
      const updated: Machine = {
        ...machine,
        online: true,
        lastSeenAt: now,
        status: ['suspended', 'storage', 'demo', 'retired'].includes(machine.status) ? machine.status : body.status,
        softwareVersion: body.softwareVersion,
        ...(body.bundleVersion !== undefined ? { bundleVersion: body.bundleVersion } : {}),
        capabilities: body.capabilities,
        updatedAt: now,
      };
      ctx.repo.put('machines', updated, now);
      const current = getReleaseState(ctx.db, machineId);
      putReleaseState(ctx.db, { ...(current ?? {}), ...body.release, machineId, updatedAt: now });
      if (!machine.online) putMachineEvent(ctx.db, { id: ctx.id('evt'), machineId, at: now, type: 'online', severity: 'info', message: 'Machine back online' });
    });
    // El cambio de `online/lastSeenAt` no altera el bundle; sólo se invalida el índice en memoria.
    ctx.invalidate([]);
    const bundle = safeBundle(machineId);
    const releaseTarget = releaseTargetFor(ctx, machineId, body.localTime);
    const statusOverride = ['suspended', 'storage', 'demo', 'retired'].includes(machine.status) && machine.status !== body.status ? machine.status : undefined;
    const response: HeartbeatResponse = {
      serverTime: now,
      heartbeatIntervalSec: heartbeatInterval(bundle),
      ...(bundle ? { bundleVersion: bundle.version } : {}),
      ...(releaseTarget ? { releaseTarget } : {}),
      commands: pendingCommands(ctx.db, machineId, now),
      ...(statusOverride ? { statusOverride } : {}),
    };
    return response;
  });

  app.get('/bundle', async (request) => {
    const machineId = requireMachine(ctx, request);
    machineOf(machineId);
    const query = parse(z.object({ version: z.string().optional() }), request.query);
    const bundle = ctx.bundle(machineId);
    const response: BundleResponse = query.version === bundle.version ? { kind: 'unchanged', version: bundle.version } : { kind: 'bundle', bundle };
    return response;
  });

  app.get('/assets/:hash', async (request, reply) => {
    requireMachine(ctx, request);
    const { hash } = parse(z.object({ hash: z.string().min(1) }), request.params);
    const bytes = ctx.readAsset(hash);
    if (!bytes) throw notFound('asset', hash);
    const asset = ctx.repo.list<{ hash: string; mime: string }>('assets').find((a) => a.hash === hash);
    return reply.header('content-type', asset?.mime ?? 'application/octet-stream').send(bytes);
  });

  app.post('/events', async (request) => {
    const machineId = requireMachine(ctx, request);
    machineOf(machineId);
    const envelope = parse(z.object({ machineId: z.string(), events: z.array(z.unknown()).min(1).max(1000) }), request.body);
    if (envelope.machineId !== machineId) throw new HttpError(401, 'machine_unauthorized', 'machineId does not match credential');
    const accepted: string[] = [];
    const duplicates: string[] = [];
    const rejected: Array<{ id: string; reason: string }> = [];
    const now = ctx.nowIso();
    for (const raw of envelope.events) {
      const parsed = FleetEvent.safeParse(raw);
      if (!parsed.success) {
        const id = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : 'unknown';
        rejected.push({ id, reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
        continue;
      }
      const event = parsed.data;
      if (event.machineId !== machineId) {
        rejected.push({ id: event.id, reason: 'machineId mismatch' });
        continue;
      }
      try {
        transaction(ctx.db, () => {
          if (!markEventSeen(ctx.db, event.id, machineId, now)) {
            duplicates.push(event.id);
            return;
          }
          applyEvent(ctx, event, now);
          accepted.push(event.id);
        });
      } catch (error) {
        rejected.push({ id: event.id, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    const response: EventBatchResponse = { accepted, duplicates, rejected };
    return response;
  });

  app.post('/commands/ack', async (request, reply) => {
    const machineId = requireMachine(ctx, request);
    const acks = parse(z.array(CommandAck), request.body);
    for (const ack of acks) {
      if (ack.machineId !== machineId) continue;
      if (ackCommand(ctx.db, ack)) putMachineEvent(ctx.db, { id: ctx.id('evt'), machineId, at: ack.at, type: 'command_executed', severity: ack.result === 'ok' ? 'info' : 'warning', message: `${ack.commandId}: ${ack.result}${ack.message ? ' ' + ack.message : ''}` });
    }
    return reply.code(204).send();
  });

  app.get('/release', async (request, reply) => {
    const machineId = requireMachine(ctx, request);
    machineOf(machineId);
    const target = releaseTargetFor(ctx, machineId, undefined);
    if (!target) return reply.code(204).send();
    return target;
  });
}

/** Aplica un evento aceptado a sus tablas. Se ejecuta dentro de la transacción del lote. */
function applyEvent(ctx: AppContext, event: FleetEvent, now: string): void {
  const machineActor = { type: 'machine' as const, id: event.machineId };
  switch (event.type) {
    case 'session_record':
      putSessionRecord(ctx.db, event.payload);
      break;
    case 'machine_event':
      putMachineEvent(ctx.db, event.payload);
      break;
    case 'print_job':
      putMachineEvent(ctx.db, { id: event.id, machineId: event.machineId, at: event.at, type: event.payload.status === 'failed' ? 'print_failed' : event.payload.status === 'completed' ? 'print_completed' : 'print_started', severity: event.payload.status === 'failed' ? 'error' : 'info', message: `print job ${event.payload.id}: ${event.payload.status}`, payload: event.payload, ...(event.payload.sessionId !== undefined ? { sessionId: event.payload.sessionId } : {}) });
      break;
    case 'release_status': {
      // La transición la decide la máquina (nextReleaseStatus en el agente); la nube registra el estado reportado.
      const state: MachineReleaseState = { ...event.payload, machineId: event.machineId, updatedAt: now };
      putReleaseState(ctx.db, state);
      putMachineEvent(ctx.db, { id: event.id, machineId: event.machineId, at: event.at, type: 'release_status', severity: state.status === 'failed' ? 'error' : 'info', message: `release ${state.targetVersion ?? state.currentVersion}: ${state.status}` });
      if (state.status === 'completed') {
        const machine = ctx.repo.get<Machine>('machines', event.machineId);
        if (machine) ctx.repo.put('machines', { ...machine, softwareVersion: state.currentVersion, updatedAt: now }, now);
      }
      if (state.rolloutId) {
        const rollout = ctx.repo.get<Rollout>('rollouts', state.rolloutId);
        if (rollout) refreshRollout(ctx, rollout.id);
      }
      break;
    }
    case 'incident': {
      const incident: Incident = event.payload;
      ctx.repo.put('incidents', incident, now);
      putMachineEvent(ctx.db, { id: event.id, machineId: event.machineId, at: event.at, type: incident.status === 'closed' || incident.status === 'resolved' ? 'incident_closed' : 'incident_opened', severity: 'warning', message: `${incident.code}: ${incident.title}` });
      break;
    }
    case 'maintenance_log':
      ctx.repo.put('maintenanceLogs', event.payload, now);
      ctx.audit({ actor: machineActor, action: 'maintenance.log', entityType: 'maintenanceLog', entityId: event.payload.id, scope: { level: 'machine', id: event.machineId }, after: event.payload, origin: 'station' });
      break;
    case 'consumable_update':
      ctx.repo.put('consumables', event.payload, now);
      ctx.audit({ actor: machineActor, action: 'consumable.update', entityType: 'consumable', entityId: event.payload.id, scope: { level: 'machine', id: event.machineId }, after: event.payload, origin: 'station' });
      break;
    case 'capability_change': {
      const machine = ctx.repo.get<Machine>('machines', event.machineId);
      if (machine) ctx.repo.put('machines', { ...machine, capabilities: event.payload, updatedAt: now }, now);
      ctx.audit({ actor: machineActor, action: 'capabilities.change', entityType: 'machine', entityId: event.machineId, scope: { level: 'machine', id: event.machineId }, before: machine?.capabilities, after: event.payload, origin: 'station' });
      ctx.invalidate([event.machineId]);
      break;
    }
    case 'local_audit':
      ctx.audit({ ...event.payload, actor: event.payload.actor, action: event.payload.action, entityType: event.payload.entityType, origin: 'station', scope: event.payload.scope ?? { level: 'machine', id: event.machineId } });
      break;
    case 'command_ack':
      ackCommand(ctx.db, event.payload);
      break;
    case 'diagnostics':
      putMachineEvent(ctx.db, { id: event.id, machineId: event.machineId, at: event.at, type: 'test_run', severity: 'info', message: 'diagnostics', payload: event.payload });
      break;
  }
}

export { putCommand };
