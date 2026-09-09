import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { JsonValue, StationSession } from '@psp/contracts';
import {
  KioskBundle,
  SessionRecord,
  StationStatus,
  StationSession as StationSessionSchema,
} from '@psp/contracts';
import { createRaster, encodePNG } from '@psp/imaging';
import { StationAgent } from './agent';
import { standaloneBundle } from './bundle/standalone';
import { buildServer } from './server';
import { manualClock, sequentialIdFactory, type ManualClock } from './support';

const MACHINE = 'mch_test_01';
const PRODUCT = 'prd_standalone_doc';
const START = '2026-09-09T12:00:00Z';

interface Harness {
  agent: StationAgent;
  app: FastifyInstance;
  clock: ManualClock;
  dir: string;
}

const cleanups: Array<() => Promise<void>> = [];

async function harness(
  opts: {
    values?: Record<string, JsonValue>;
    dbPath?: string;
    dir?: string;
    initialPaper?: number;
    idStart?: number;
  } = {},
): Promise<Harness> {
  const dir = opts.dir ?? mkdtempSync(join(tmpdir(), 'psp-agent-'));
  const clock = manualClock(START);
  const agent = new StationAgent({
    config: { machineId: MACHINE, varDir: dir, techPin: '2468', softwareVersion: '0.1.0-test' },
    clock,
    ids: sequentialIdFactory(opts.idStart ?? 1),
    dbPath: opts.dbPath ?? ':memory:',
    cloud: false,
    printerStepDelayMs: 0,
    ...(opts.initialPaper !== undefined ? { initialPaper: opts.initialPaper } : {}),
    fallback: (machineId, now) =>
      standaloneBundle(machineId, {
        now,
        assetUrlBase: '/station/v1/assets',
        ...(opts.values ? { values: opts.values } : {}),
      }),
  });
  await agent.init();
  const app = buildServer(agent, { kioskDist: join(dir, 'no-kiosk') });
  await app.ready();
  cleanups.push(async () => {
    await app.close();
    await agent.stop();
    if (!opts.dir) rmSync(dir, { recursive: true, force: true });
  });
  return { agent, app, clock, dir };
}

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

const pngBase64 = (): string => Buffer.from(encodePNG(createRaster(4, 4))).toString('base64');

async function post(
  app: FastifyInstance,
  url: string,
  payload: unknown,
  headers: Record<string, string> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url,
    payload: payload as Record<string, unknown>,
    headers,
  });
  return {
    status: response.statusCode,
    body: response.json() as Record<string, unknown> & { stage?: string },
  };
}

async function createSession(
  app: FastifyInstance,
  extra: Record<string, unknown> = {},
): Promise<StationSession> {
  const created = await post(app, '/station/v1/sessions', {
    productId: PRODUCT,
    locale: 'es',
    ...extra,
  });
  expect(created.status).toBe(201);
  return created.body as unknown as StationSession;
}

async function techToken(app: FastifyInstance, pin = '2468'): Promise<string> {
  const login = await post(app, '/station/v1/tech/login', { pin });
  expect(login.status).toBe(200);
  return `Tech ${String(login.body['token'])}`;
}

describe('status y bundle', () => {
  it('responden con las formas del contrato en modo standalone', async () => {
    const { app } = await harness();
    const status = await app.inject({ method: 'GET', url: '/station/v1/status' });
    expect(status.statusCode).toBe(200);
    const parsedStatus = StationStatus.safeParse(status.json());
    expect(parsedStatus.success).toBe(true);
    if (parsedStatus.success) {
      expect(parsedStatus.data.machineId).toBe(MACHINE);
      expect(parsedStatus.data.cloudReachable).toBe(false);
      expect(parsedStatus.data.printers).toHaveLength(1);
    }
    const bundle = await app.inject({ method: 'GET', url: '/station/v1/bundle' });
    expect(bundle.statusCode).toBe(200);
    const parsedBundle = KioskBundle.safeParse(bundle.json());
    expect(parsedBundle.success).toBe(true);
    if (parsedBundle.success) {
      expect(parsedBundle.data.assetBaseUrl).toBe('/station/v1/assets');
      expect(
        parsedBundle.data.availability.find((state) => state.productId === PRODUCT)?.available,
      ).toBe(true);
    }
    const active = await app.inject({ method: 'GET', url: '/station/v1/sessions/active' });
    expect(active.statusCode).toBe(204);
  });

  it('rechaza cuerpos que no validan contra el contrato', async () => {
    const { app } = await harness();
    const bad = await post(app, '/station/v1/sessions', { locale: 'fr' });
    expect(bad.status).toBe(400);
    expect(bad.body['code']).toBe('validation_error');
  });
});

describe('ciclo documental completo', () => {
  it('crea, captura, compone, imprime idempotente y termina con registro sin fotos', async () => {
    const { app, agent } = await harness();
    const session = await createSession(app);
    expect(StationSessionSchema.safeParse(session).success).toBe(true);
    expect(session.stage).toBe('product_selected');
    expect(session.commercial.paymentState).toBe('awaiting');
    expect(session.retention.customerText.es.length).toBeGreaterThan(0);

    const busy = await post(app, '/station/v1/sessions', { productId: PRODUCT, locale: 'es' });
    expect(busy.status).toBe(409);

    // Pago aprobado antes de capturar.
    const intent = await post(app, '/station/v1/payments/intents', { sessionId: session.id });
    expect(intent.status).toBe(201);
    await post(app, '/station/v1/payments/simulate', {
      intentId: intent.body['id'],
      outcome: 'approve',
    });

    const capturing = await post(app, `/station/v1/sessions/${session.id}/stage`, {
      to: 'capturing',
    });
    expect(capturing.status).toBe(200);
    expect(capturing.body.stage).toBe('capturing');

    const capture = await post(app, `/station/v1/sessions/${session.id}/captures`, {
      index: 0,
      imageBase64: `data:image/png;base64,${pngBase64()}`,
      width: 4,
      height: 4,
    });
    expect(capture.status).toBe(201);
    expect(String(capture.body['url'])).toMatch(
      new RegExp(`^/station/v1/sessions/${session.id}/files/`),
    );
    const file = await app.inject({ method: 'GET', url: String(capture.body['url']) });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');

    const retake = await post(app, `/station/v1/sessions/${session.id}/captures`, {
      index: 0,
      imageBase64: pngBase64(),
      width: 4,
      height: 4,
      retakeOf: capture.body['id'],
    });
    expect(retake.status).toBe(201);
    expect(
      (await app.inject({ method: 'GET', url: `/station/v1/sessions/${session.id}` })).json()
        .retakesUsed,
    ).toBe(1);

    for (const stage of ['reviewing', 'composing']) {
      const moved = await post(app, `/station/v1/sessions/${session.id}/stage`, { to: stage });
      expect(moved.status).toBe(200);
    }
    const invalid = await post(app, `/station/v1/sessions/${session.id}/stage`, { to: 'done' });
    expect(invalid.status).toBe(409);

    const composition = await post(app, `/station/v1/sessions/${session.id}/composition`, {
      imageBase64: pngBase64(),
      width: 4,
      height: 4,
      copies: 1,
    });
    expect(composition.status).toBe(200);
    expect((composition.body['composition'] as { url: string }).url).toContain(
      '/files/composition.png',
    );

    await post(app, `/station/v1/sessions/${session.id}/stage`, { to: 'confirming' });
    const print = await post(app, `/station/v1/sessions/${session.id}/print`, {
      idempotencyKey: 'key-1',
    });
    expect(print.status).toBe(202);
    const again = await post(app, `/station/v1/sessions/${session.id}/print`, {
      idempotencyKey: 'key-1',
    });
    expect(again.body['id']).toBe(print.body['id']);
    await agent.sessions.waitForPrints();
    const afterPrint = agent.sessions.require(session.id);
    expect(afterPrint.printJobs).toHaveLength(1);
    expect(afterPrint.printJobs[0]?.status).toBe('completed');
    expect(afterPrint.printJobs[0]?.outputPath).toContain(
      join('prints', `${String(print.body['id'])}.png`),
    );
    expect(agent.hardware.printer()?.paperEstimate).toBe(199);

    await post(app, `/station/v1/sessions/${session.id}/stage`, { to: 'printing' });
    await post(app, `/station/v1/sessions/${session.id}/stage`, { to: 'finishing' });
    const finished = await post(app, `/station/v1/sessions/${session.id}/finish`, {});
    expect(finished.status).toBe(200);
    const record = SessionRecord.safeParse(finished.body['record']);
    expect(record.success).toBe(true);
    if (record.success) {
      expect(record.data.result).toBe('completed');
      expect(record.data.captures).toBe(2);
      expect(record.data.retakes).toBe(1);
      expect(record.data.printsCompleted).toBe(1);
      expect(record.data.commercial.state).toBe('paid_simulated');
      expect(JSON.stringify(record.data)).not.toContain('/files/');
    }
    const queued = agent.store.outboxByType('session_record');
    expect(
      queued.some((event) => event.type === 'session_record' && event.payload.id === session.id),
    ).toBe(true);
    expect(
      (await app.inject({ method: 'GET', url: '/station/v1/sessions/active' })).statusCode,
    ).toBe(204);
  });
});

describe('pagos', () => {
  it('intent en awaiting → approve → approved y sesión actualizada', async () => {
    const { app, agent } = await harness();
    const session = await createSession(app);
    const intent = await post(app, '/station/v1/payments/intents', { sessionId: session.id });
    expect(intent.body['state']).toBe('awaiting');
    const approved = await post(app, '/station/v1/payments/simulate', {
      intentId: intent.body['id'],
      outcome: 'approve',
    });
    expect(approved.status).toBe(200);
    expect(approved.body['state']).toBe('approved');
    const updated = agent.sessions.require(session.id);
    expect(updated.commercial.paymentState).toBe('approved');
    expect(updated.commercial.state).toBe('paid_simulated');
  });

  it('businessMode demo → el intent nace en demo', async () => {
    const { app } = await harness({ values: { 'payment.businessMode': 'demo' } });
    const session = await createSession(app);
    expect(session.commercial.state).toBe('demo');
    const intent = await post(app, '/station/v1/payments/intents', { sessionId: session.id });
    expect(intent.status).toBe(201);
    expect(intent.body['state']).toBe('demo');
  });
});

describe('impresora', () => {
  it('sin papel falla con error comprensible y paper_changed la recupera', async () => {
    const { app, agent } = await harness();
    const token = await techToken(app);
    const session = await createSession(app);
    await post(app, `/station/v1/sessions/${session.id}/composition`, {
      imageBase64: pngBase64(),
      width: 4,
      height: 4,
    });
    const fault = await post(
      app,
      '/station/v1/tech/simulate',
      { fault: 'printer_no_paper', printerId: 'prn_photo_1' },
      { authorization: token },
    );
    expect(fault.status).toBe(200);
    const failed = await post(app, `/station/v1/sessions/${session.id}/print`, {
      idempotencyKey: 'k',
    });
    expect(failed.status).toBe(409);
    expect(failed.body['code']).toBe('printer_unavailable');
    expect(String(failed.body['message'])).toContain('no paper');
    const changed = await post(
      app,
      '/station/v1/tech/maintenance',
      { action: 'paper_changed', printerId: 'prn_photo_1', qty: 100 },
      { authorization: token },
    );
    expect(changed.status).toBe(200);
    expect(agent.hardware.printer()?.status).toBe('ready');
    const ok = await post(app, `/station/v1/sessions/${session.id}/print`, {
      idempotencyKey: 'k2',
    });
    expect(ok.status).toBe(202);
    await agent.sessions.waitForPrints();
    expect(agent.hardware.printer()?.paperEstimate).toBe(99);
  });
});

describe('expiración', () => {
  it('una sesión inactiva expira con el reloj inyectado', async () => {
    const { app, agent, clock } = await harness();
    const session = await createSession(app);
    clock.advance((session.timers.idleTimeoutSec - 1) * 1000);
    expect(agent.sessions.expireIdle()).toHaveLength(0);
    clock.advance(2000);
    const expired = agent.sessions.expireIdle();
    expect(expired).toHaveLength(1);
    expect(agent.sessions.require(session.id).stage).toBe('expired');
    const record = agent.store.outboxByType('session_record').at(-1);
    expect(record?.type === 'session_record' && record.payload.result).toBe('expired');
    // El reaper elimina los archivos al vencer el plazo; el registro queda.
    expect(agent.sessions.reap()).toContain(session.id);
    expect(agent.sessions.require(session.id).retention.deletedAt).toBeDefined();
  });
});

describe('panel técnico', () => {
  it('login con PIN correcto e incorrecto; config local sólo con claves editables en machine', async () => {
    const { app } = await harness();
    const wrong = await post(app, '/station/v1/tech/login', { pin: '0000' });
    expect(wrong.status).toBe(401);
    const unauthorized = await app.inject({ method: 'GET', url: '/station/v1/tech/status' });
    expect(unauthorized.statusCode).toBe(401);
    const token = await techToken(app);
    const status = await app.inject({
      method: 'GET',
      url: '/station/v1/tech/status',
      headers: { authorization: token },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().organizationName).toBeTruthy();

    const rejected = await app.inject({
      method: 'PATCH',
      url: '/station/v1/tech/config',
      headers: { authorization: token },
      payload: { values: { 'sync.heartbeatIntervalSec': 5 } },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json().code).toBe('key_not_editable');
    const accepted = await app.inject({
      method: 'PATCH',
      url: '/station/v1/tech/config',
      headers: { authorization: token },
      payload: { values: { 'kiosk.volume': 30 }, reason: 'ruido' },
    });
    expect(accepted.statusCode).toBe(200);
    const bundle = await app.inject({ method: 'GET', url: '/station/v1/bundle' });
    expect(bundle.json().effective.values['kiosk.volume']).toBe(30);
    const test = await post(
      app,
      '/station/v1/tech/tests',
      { kind: 'print' },
      { authorization: token },
    );
    expect(test.status).toBe(200);
    expect(test.body['ok']).toBe(true);
  });
});

describe('recuperación', () => {
  it('una sesión no terminal en la base se cierra como abandoned al arrancar', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'psp-agent-recovery-'));
    const dbPath = join(dir, 'station.sqlite');
    const first = await harness({ dir, dbPath });
    const session = await createSession(first.app);
    await post(first.app, `/station/v1/sessions/${session.id}/stage`, { to: 'capturing' });
    await post(first.app, `/station/v1/sessions/${session.id}/captures`, {
      index: 0,
      imageBase64: pngBase64(),
      width: 4,
      height: 4,
    });
    await first.app.close();
    await first.agent.stop();
    cleanups.pop();

    const second = await harness({ dir, dbPath, idStart: 1000 });
    const recovered = second.agent.sessions.require(session.id);
    expect(recovered.stage).toBe('abandoned');
    expect(recovered.retention.deletedAt).toBeDefined();
    const record = second.agent.store
      .outboxByType('session_record')
      .find((event) => event.type === 'session_record' && event.payload.id === session.id);
    expect(record?.type === 'session_record' && record.payload.recoveredFrom).toBe('app_restart');
    expect(record?.type === 'session_record' && record.payload.abandonedAtStage).toBe('capturing');
    expect(
      second.agent.store.recentEvents(50).some((event) => event.type === 'session_recovered'),
    ).toBe(true);
    expect(
      (await second.app.inject({ method: 'GET', url: '/station/v1/sessions/active' })).statusCode,
    ).toBe(204);
    cleanups.push(async () => rmSync(dir, { recursive: true, force: true }));
  });
});
