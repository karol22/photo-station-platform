import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { EventBatchRequest, HeartbeatRequest } from '@psp/contracts';
import {
  EventBatchRequest as EventBatchRequestSchema,
  HeartbeatRequest as HeartbeatRequestSchema,
} from '@psp/contracts';
import { StationAgent } from './agent';
import { standaloneBundle } from './bundle/standalone';
import type { FetchLike } from './sync/cloud-client';
import { manualClock, sequentialIdFactory } from './support';

const MACHINE = 'mch_sync_01';
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() ?? '', { recursive: true, force: true });
});

/** Nube falsa: registra cuerpos, responde `unchanged`, un comando y acepta todo lote. */
function fakeCloud(opts: { online: boolean }) {
  const heartbeats: HeartbeatRequest[] = [];
  const batches: EventBatchRequest[] = [];
  const fetch: FetchLike = async (url, init) => {
    if (!opts.online) throw new Error('ECONNREFUSED');
    const respond = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => 'application/json' },
    });
    expect(init?.headers?.['Authorization']).toMatch(new RegExp(`^Machine ${MACHINE}:`));
    if (url.endsWith('/fleet/v1/bundle')) {
      // Primer arranque (sin versión): la nube devuelve el bundle completo.
      const bundle = standaloneBundle(MACHINE, {
        now: new Date('2026-09-09T11:00:00Z'),
        assetUrlBase: '/station/v1/assets',
      });
      return respond({ kind: 'bundle', bundle });
    }
    if (url.includes('/fleet/v1/bundle?')) return respond({ kind: 'unchanged', version: 'same' });
    if (url.endsWith('/fleet/v1/heartbeat')) {
      const parsed = HeartbeatRequestSchema.safeParse(JSON.parse(init?.body ?? '{}'));
      expect(parsed.success).toBe(true);
      if (parsed.success) heartbeats.push(parsed.data);
      return respond({
        serverTime: '2026-09-09T12:00:01Z',
        heartbeatIntervalSec: 45,
        commands:
          heartbeats.length === 1
            ? [
                {
                  id: 'cmd_1',
                  type: 'set_maintenance',
                  issuedAt: '2026-09-09T11:59:00Z',
                  on: true,
                  message: 'Cambio de papel',
                },
                { id: 'cmd_2', type: 'run_test', issuedAt: '2026-09-09T11:59:01Z', kind: 'print' },
              ]
            : [
                {
                  id: 'cmd_1',
                  type: 'set_maintenance',
                  issuedAt: '2026-09-09T11:59:00Z',
                  on: true,
                },
              ],
      });
    }
    if (url.endsWith('/fleet/v1/events')) {
      const parsed = EventBatchRequestSchema.safeParse(JSON.parse(init?.body ?? '{}'));
      expect(parsed.success).toBe(true);
      if (parsed.success) batches.push(parsed.data);
      return respond({
        accepted: parsed.success ? parsed.data.events.map((event) => event.id) : [],
        duplicates: [],
        rejected: [],
      });
    }
    throw new Error(`unexpected url ${url}`);
  };
  return { fetch, heartbeats, batches };
}

async function agentWith(cloud: ReturnType<typeof fakeCloud>): Promise<StationAgent> {
  const dir = mkdtempSync(join(tmpdir(), 'psp-sync-'));
  dirs.push(dir);
  const agent = new StationAgent({
    config: { machineId: MACHINE, varDir: dir, softwareVersion: '0.1.0-test' },
    clock: manualClock('2026-09-09T12:00:00Z'),
    ids: sequentialIdFactory(),
    dbPath: ':memory:',
    fetch: cloud.fetch,
    printerStepDelayMs: 0,
    fallback: (machineId, now) =>
      standaloneBundle(machineId, { now, assetUrlBase: '/station/v1/assets' }),
  });
  await agent.init();
  return agent;
}

describe('sincronización con la nube', () => {
  it('sin nube arranca en standalone y sigue operando', async () => {
    const cloud = fakeCloud({ online: false });
    const agent = await agentWith(cloud);
    expect(agent.bundles.source).toBe('standalone');
    expect(agent.status().cloudReachable).toBe(false);
    expect(await agent.heartbeat.run()).toBeUndefined();
    expect(agent.outbox.summary().pending).toBeGreaterThan(0);
    expect(
      agent.sessions.create({
        productId: 'prd_standalone_doc',
        locale: 'es',
        isDemo: false,
        operatorStarted: false,
        accessible: false,
      }).stage,
    ).toBe('product_selected');
    await agent.stop();
  });

  it('heartbeat envía estado real, ejecuta comandos una sola vez, confirma y vacía el outbox', async () => {
    const cloud = fakeCloud({ online: true });
    const agent = await agentWith(cloud);
    expect(agent.status().cloudReachable).toBe(true);
    expect(agent.bundles.source).toBe('cloud');
    expect(agent.store.getKv('bundle.active')).toBeDefined();
    const response = await agent.heartbeat.run();
    expect(response?.heartbeatIntervalSec).toBe(45);
    expect(agent.heartbeat.intervalSec).toBe(45);
    expect(cloud.heartbeats[0]?.status).toBe('active');
    expect(agent.state.maintenance).toEqual({ on: true, message: 'Cambio de papel' });
    expect(agent.status().status).toBe('maintenance');
    expect(agent.store.recentTests(5)[0]?.kind).toBe('print');
    const acks = agent.store.outboxByType('command_ack');
    expect(
      acks.map((event) => (event.type === 'command_ack' ? event.payload.commandId : '')),
    ).toEqual(['cmd_1', 'cmd_2']);
    expect(agent.outbox.summary().pending).toBe(0);
    expect(cloud.batches.length).toBeGreaterThan(0);
    // Segundo latido: el comando repetido no se vuelve a ejecutar ni a confirmar.
    await agent.heartbeat.run();
    expect(agent.store.outboxByType('command_ack')).toHaveLength(2);
    expect(agent.status().lastSyncAt).toBeDefined();
    await agent.stop();
  });
});
