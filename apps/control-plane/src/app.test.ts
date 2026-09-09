import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DashboardSummary, KioskBundle, type FleetCommand, type HeartbeatResponse } from '@psp/contracts';
import { stableHash } from '@psp/domain';
import { seedDatabase } from '../seed/index';
import { createApp, type ControlPlaneApp } from './app';
import { openControlPlaneDb } from './store';
import { TEST_NOW, TEST_USERS, testDataset } from './test-dataset';

let cp: ControlPlaneApp;
const tokens: Record<string, string> = {};
let seq = 0;

const MACHINE_AUTH = { authorization: `Machine mch_norte_1:${stableHash('secret:mch_norte_1')}`, 'x-psp-contracts': 'v1' };

async function login(email: string, password: string): Promise<string> {
  const res = await cp.app.inject({ method: 'POST', url: '/admin/v1/auth/login', payload: { email, password } });
  expect(res.statusCode).toBe(200);
  return (res.json() as { token: string }).token;
}

const admin = (token: string) => ({ authorization: `Bearer ${token}` });

function heartbeat(overrides: Record<string, unknown> = {}) {
  return {
    machineId: 'mch_norte_1',
    at: TEST_NOW.toISOString(),
    localTime: '06:00',
    timezone: 'America/Monterrey',
    softwareVersion: '0.4.2',
    status: 'active',
    capabilities: [{ key: 'camera.primary', present: true, operational: true }, { key: 'printer.photo', present: true, operational: true }],
    printers: [{ id: 'prn_photo_1', name: 'Photo printer', type: 'photo', paperSizes: ['4x6in'], color: true, priority: 0, status: 'ready', paperEstimate: 100 }],
    consumables: [],
    health: { diskFreeMb: 50000, storagePct: 20, uptimeSec: 100, cloudReachable: true },
    release: { currentVersion: '0.4.2', status: 'up_to_date', requiresRestart: false },
    pendingEvents: 0,
    maintenance: { on: false },
    ...overrides,
  };
}

beforeAll(async () => {
  const db = openControlPlaneDb(':memory:');
  seedDatabase(db, testDataset(), { now: TEST_NOW, users: TEST_USERS });
  cp = await createApp({ db, now: () => TEST_NOW, random: () => `t${(seq++).toString(36).padStart(11, '0')}`, assetsDir: '/nonexistent/assets' });
  tokens['owner'] = await login('owner@psp.test', 'owner-pass');
  tokens['norte'] = await login('franq@norte.test', 'norte-pass');
  tokens['analyst'] = await login('analyst@psp.test', 'analyst-pass');
});

afterAll(async () => {
  await cp.app.close();
});

describe('auth y alcance (escenario D)', () => {
  it('login devuelve principal con permisos; credenciales malas → 403', async () => {
    const me = await cp.app.inject({ method: 'GET', url: '/admin/v1/auth/me', headers: admin(tokens['owner']!) });
    expect(me.statusCode).toBe(200);
    expect((me.json() as { permissions: unknown[] }).permissions.length).toBeGreaterThan(0);
    const bad = await cp.app.inject({ method: 'POST', url: '/admin/v1/auth/login', payload: { email: 'owner@psp.test', password: 'nope' } });
    expect(bad.statusCode).toBe(403);
    const noAuth = await cp.app.inject({ method: 'GET', url: '/admin/v1/machines' });
    expect(noAuth.statusCode).toBe(401);
    expect((noAuth.json() as { code: string }).code).toBe('unauthorized');
  });

  it('el franquiciatario del norte no ve máquinas de otra franquicia; el owner ve todas', async () => {
    const norte = await cp.app.inject({ method: 'GET', url: '/admin/v1/machines', headers: admin(tokens['norte']!) });
    expect(norte.statusCode).toBe(200);
    const ids = (norte.json() as { items: Array<{ id: string }> }).items.map((m) => m.id);
    expect(ids).toEqual(['mch_norte_1']);
    const owner = await cp.app.inject({ method: 'GET', url: '/admin/v1/machines', headers: admin(tokens['owner']!) });
    expect((owner.json() as { total: number }).total).toBe(2);
    const sur = await cp.app.inject({ method: 'GET', url: '/admin/v1/machines/mch_sur_1', headers: admin(tokens['norte']!) });
    expect(sur.statusCode).toBe(404);
    const incidents = await cp.app.inject({ method: 'GET', url: '/admin/v1/incidents', headers: admin(tokens['norte']!) });
    expect((incidents.json() as { total: number }).total).toBe(0);
  });

  it('el analista no puede crear productos (403) y las mutaciones auditan', async () => {
    const product = { ...(testDataset().products![0] as Record<string, unknown>), id: 'prd_new', internalName: 'Nuevo' };
    const denied = await cp.app.inject({ method: 'POST', url: '/admin/v1/products', headers: admin(tokens['analyst']!), payload: product });
    expect(denied.statusCode).toBe(403);
    const created = await cp.app.inject({ method: 'POST', url: '/admin/v1/products', headers: admin(tokens['owner']!), payload: product });
    expect(created.statusCode).toBe(201);
    const audit = await cp.app.inject({ method: 'GET', url: '/admin/v1/audit?entityId=prd_new', headers: admin(tokens['owner']!) });
    expect((audit.json() as { items: Array<{ action: string }> }).items.map((e) => e.action)).toContain('products.create');
    const listed = await cp.app.inject({ method: 'GET', url: '/admin/v1/products?q=nuevo', headers: admin(tokens['norte']!) });
    expect((listed.json() as { items: Array<{ id: string }> }).items.map((p) => p.id)).toEqual(['prd_new']);
  });
});

describe('bundles y configuración', () => {
  it('GET /machines/:id/bundle devuelve un KioskBundle válido', async () => {
    const res = await cp.app.inject({ method: 'GET', url: '/admin/v1/machines/mch_norte_1/bundle', headers: admin(tokens['norte']!) });
    expect(res.statusCode).toBe(200);
    const parsed = KioskBundle.safeParse(res.json());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.effective.values['branding.publicName']).toBe('Lumina Foto');
      expect(parsed.data.products.map((p) => p.id)).toContain('prd_doc');
    }
  });

  it('POST /config con clave bloqueada devuelve violación; un patch de organización cambia la versión del bundle', async () => {
    const before = (await cp.app.inject({ method: 'GET', url: '/admin/v1/machines/mch_norte_1/bundle', headers: admin(tokens['owner']!) })).json() as { version: string };
    const locked = await cp.app.inject({ method: 'POST', url: '/admin/v1/config', headers: admin(tokens['owner']!), payload: { level: 'organization', entityId: 'org_lumina', values: { 'kiosk.attractRotationSec': 20 } } });
    expect(locked.statusCode).toBe(400);
    expect((locked.json() as { code: string }).code).toBe('validation');
    const ok = await cp.app.inject({ method: 'POST', url: '/admin/v1/config', headers: admin(tokens['owner']!), payload: { level: 'organization', entityId: 'org_lumina', values: { 'branding.publicName': 'Lumina 2' }, reason: 'rebrand' } });
    expect(ok.statusCode).toBe(200);
    const after = (await cp.app.inject({ method: 'GET', url: '/admin/v1/machines/mch_norte_1/bundle', headers: admin(tokens['owner']!) })).json() as { version: string; effective: { values: Record<string, unknown> } };
    expect(after.version).not.toBe(before.version);
    expect(after.effective.values['branding.publicName']).toBe('Lumina 2');
    const effective = await cp.app.inject({ method: 'GET', url: '/admin/v1/config/effective?level=machine&id=mch_norte_1', headers: admin(tokens['owner']!) });
    expect(effective.statusCode).toBe(200);
    expect((effective.json() as { chain: unknown[] }).chain.length).toBeGreaterThanOrEqual(2);
    const denied = await cp.app.inject({ method: 'POST', url: '/admin/v1/config', headers: admin(tokens['norte']!), payload: { level: 'franchise', entityId: 'fr_sur', values: { 'branding.footerText': 'x' } } });
    expect(denied.statusCode).toBe(403);
  });
});

describe('flota', () => {
  it('heartbeat crea/actualiza estado y devuelve comandos pendientes', async () => {
    const cmd = await cp.app.inject({ method: 'POST', url: '/admin/v1/machines/mch_norte_1/commands', headers: admin(tokens['owner']!), payload: { command: { type: 'sync_now' }, reason: 'test' } });
    expect(cmd.statusCode).toBe(201);
    const { commandId } = cmd.json() as { commandId: string };
    const res = await cp.app.inject({ method: 'POST', url: '/fleet/v1/heartbeat', headers: MACHINE_AUTH, payload: heartbeat() });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-psp-contracts']).toBe('v1');
    const body = res.json() as HeartbeatResponse;
    expect(body.bundleVersion).toBeDefined();
    expect(body.commands.map((c: FleetCommand) => c.id)).toContain(commandId);
    const ack = await cp.app.inject({ method: 'POST', url: '/fleet/v1/commands/ack', headers: MACHINE_AUTH, payload: [{ commandId, machineId: 'mch_norte_1', result: 'ok', at: TEST_NOW.toISOString() }] });
    expect(ack.statusCode).toBe(204);
    const again = (await cp.app.inject({ method: 'POST', url: '/fleet/v1/heartbeat', headers: MACHINE_AUTH, payload: heartbeat() })).json() as HeartbeatResponse;
    expect(again.commands.map((c) => c.id)).not.toContain(commandId);
    const bad = await cp.app.inject({ method: 'POST', url: '/fleet/v1/heartbeat', headers: { authorization: 'Machine mch_norte_1:wrong' }, payload: heartbeat() });
    expect(bad.statusCode).toBe(401);
    const unchanged = await cp.app.inject({ method: 'GET', url: `/fleet/v1/bundle?version=${body.bundleVersion}`, headers: MACHINE_AUTH });
    expect((unchanged.json() as { kind: string }).kind).toBe('unchanged');
  });

  it('POST /events es idempotente por id y registra sesiones', async () => {
    const event = {
      id: 'evt_1',
      machineId: 'mch_norte_1',
      at: TEST_NOW.toISOString(),
      sequence: 1,
      softwareVersion: '0.4.2',
      type: 'session_record',
      payload: { id: 'ses_2', code: 'XYZ789', machineId: 'mch_norte_1', locationId: 'loc_norte_1', organizationId: 'org_lumina', franchiseId: 'fr_norte', startedAt: '2026-09-09T11:00:00Z', endedAt: '2026-09-09T11:02:00Z', stage: 'done', result: 'completed', productId: 'prd_doc', productName: 'Foto infantil', productKind: 'document', commercial: { state: 'paid_simulated', paymentState: 'approved' }, softwareVersion: '0.4.2', bundleVersion: 'x', retention: { policyId: 'ret_delete_on_finish', mode: 'none' }, locale: 'es' },
    };
    const first = await cp.app.inject({ method: 'POST', url: '/fleet/v1/events', headers: MACHINE_AUTH, payload: { machineId: 'mch_norte_1', events: [event, { id: 'evt_bad', type: 'nope' }] } });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ accepted: ['evt_1'], duplicates: [], rejected: [{ id: 'evt_bad' }] });
    const second = await cp.app.inject({ method: 'POST', url: '/fleet/v1/events', headers: MACHINE_AUTH, payload: { machineId: 'mch_norte_1', events: [event] } });
    expect(second.json()).toMatchObject({ accepted: [], duplicates: ['evt_1'] });
    const sessions = await cp.app.inject({ method: 'GET', url: '/admin/v1/sessions', headers: admin(tokens['norte']!) });
    expect((sessions.json() as { items: Array<{ id: string }> }).items.map((s) => s.id)).toContain('ses_2');
  });

  it('enroll con token demo crea una máquina configuring', async () => {
    const res = await cp.app.inject({ method: 'POST', url: '/fleet/v1/enroll', headers: { 'x-psp-contracts': 'v1' }, payload: { provisioningToken: 'demo-provisioning-token', report: { hostname: 'kiosk-42', capabilities: [], softwareVersion: '0.4.2' } } });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { machineId: string; machineSecret: string; organizationId: string };
    expect(body.organizationId).toBe('org_lumina');
    expect(body.machineSecret).toBe(stableHash(`secret:${body.machineId}`));
  });
});

describe('rollouts', () => {
  it('start deja las máquinas objetivo en pending y release_status completed actualiza stats', async () => {
    const start = await cp.app.inject({ method: 'POST', url: '/admin/v1/rollouts/rlt_norte/actions', headers: admin(tokens['owner']!), payload: { action: 'start' } });
    expect(start.statusCode).toBe(200);
    expect((start.json() as { status: string; stats: { pending: number } }).status).toBe('in_progress');
    const machines = (await cp.app.inject({ method: 'GET', url: '/admin/v1/rollouts/rlt_norte/machines', headers: admin(tokens['owner']!) })).json() as Array<{ machineId: string; status: string }>;
    expect(machines).toEqual([{ machineId: 'mch_norte_1', status: 'pending', currentVersion: '0.4.2', targetVersion: '0.5.0', rolloutId: 'rlt_norte', requiresRestart: true, updatedAt: TEST_NOW.toISOString() }]);
    const hb = (await cp.app.inject({ method: 'POST', url: '/fleet/v1/heartbeat', headers: MACHINE_AUTH, payload: heartbeat({ release: { currentVersion: '0.4.2', targetVersion: '0.5.0', rolloutId: 'rlt_norte', status: 'pending', requiresRestart: true } }) })).json() as HeartbeatResponse;
    expect(hb.releaseTarget?.version).toBe('0.5.0');
    expect(hb.commands.some((c) => c.type === 'apply_release')).toBe(true);
    const done = await cp.app.inject({ method: 'POST', url: '/fleet/v1/events', headers: MACHINE_AUTH, payload: { machineId: 'mch_norte_1', events: [{ id: 'evt_rel_1', machineId: 'mch_norte_1', at: TEST_NOW.toISOString(), sequence: 2, softwareVersion: '0.5.0', type: 'release_status', payload: { machineId: 'mch_norte_1', currentVersion: '0.5.0', targetVersion: '0.5.0', rolloutId: 'rlt_norte', status: 'completed', requiresRestart: true, updatedAt: TEST_NOW.toISOString() } }] } });
    expect((done.json() as { accepted: string[] }).accepted).toEqual(['evt_rel_1']);
    const rollout = (await cp.app.inject({ method: 'GET', url: '/admin/v1/rollouts/rlt_norte', headers: admin(tokens['owner']!) })).json() as { status: string; stats: { completed: number; total: number } };
    expect(rollout.stats).toMatchObject({ completed: 1, total: 1 });
    expect(rollout.status).toBe('completed');
  });
});

describe('dashboard y métricas', () => {
  it('GET /dashboard cumple DashboardSummary y respeta el alcance', async () => {
    const res = await cp.app.inject({ method: 'GET', url: '/admin/v1/dashboard', headers: admin(tokens['owner']!) });
    expect(res.statusCode).toBe(200);
    const parsed = DashboardSummary.safeParse(res.json());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.machines.total).toBe(3);
      expect(parsed.data.openIncidents.map((i) => i.code)).toContain('INC-0001');
      expect(parsed.data.sessionsToday.started).toBeGreaterThanOrEqual(1);
    }
    const norte = (await cp.app.inject({ method: 'GET', url: '/admin/v1/dashboard', headers: admin(tokens['norte']!) })).json() as { machines: { total: number }; openIncidents: unknown[] };
    expect(norte.machines.total).toBe(1);
    expect(norte.openIncidents).toEqual([]);
  });

  it('POST /metrics/query agrega sesiones con realMoney:false', async () => {
    const res = await cp.app.inject({ method: 'POST', url: '/admin/v1/metrics/query', headers: admin(tokens['owner']!), payload: { from: '2026-09-01T00:00:00Z', to: '2026-09-10T00:00:00Z', groupBy: 'product' } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { totals: { sessions: { started: number }; commercial: { realMoney: boolean } }; series: unknown[] };
    expect(body.totals.commercial.realMoney).toBe(false);
    expect(body.totals.sessions.started).toBeGreaterThanOrEqual(2);
    expect(body.series.length).toBeGreaterThan(0);
  });

  it('el simulador avanza heartbeats y releases en un ciclo', () => {
    const result = cp.simulator.tick();
    expect(result.heartbeats).toBeGreaterThan(0);
  });
});
