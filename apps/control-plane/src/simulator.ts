/**
 * Simulador de flota en proceso (escenario H): cada `intervalMs` actualiza los heartbeats con
 * pequeñas variaciones y avanza los estados de release pending → downloading → ready →
 * installing → completed (2 % fallan). Determinista con el PRNG inyectado; se detiene al cerrar.
 */
import type { HeartbeatRequest, Machine } from '@psp/contracts';
import type { AppContext } from './context';
import { getReleaseState, listHeartbeats, listReleaseStates, putHeartbeat, putMachineEvent, putReleaseState } from './store';
import { refreshRollout } from './rollouts';

export interface SimulatorHandle {
  start(): void;
  stop(): void;
  /** Ejecuta un ciclo de simulación (útil en pruebas). */
  tick(): { heartbeats: number; releases: number };
  running(): boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSimulator(ctx: AppContext, opts: { intervalMs?: number; seed?: number } = {}): SimulatorHandle {
  const random = mulberry32(opts.seed ?? 42);
  let timer: NodeJS.Timeout | undefined;

  const tick = (): { heartbeats: number; releases: number } => {
    const now = ctx.now();
    const nowIso = now.toISOString();
    let heartbeats = 0;
    let releases = 0;
    const machines = new Map(ctx.repo.list<Machine>('machines').map((m) => [m.id, m]));
    for (const previous of listHeartbeats(ctx.db)) {
      const machine = machines.get(previous.machineId);
      if (!machine || ['retired', 'storage', 'suspended'].includes(machine.status)) continue;
      const jitter = (value: number, delta: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round((value + (random() - 0.5) * delta) * 10) / 10));
      const heartbeat: HeartbeatRequest = {
        ...previous,
        at: nowIso,
        health: {
          ...previous.health,
          cpuPct: jitter(previous.health.cpuPct ?? 15, 10, 1, 95),
          memPct: jitter(previous.health.memPct ?? 40, 6, 5, 95),
          storagePct: jitter(previous.health.storagePct, 1, 1, 99),
          uptimeSec: previous.health.uptimeSec + Math.round((opts.intervalMs ?? 10_000) / 1000),
        },
        printers: previous.printers.map((p) => ({ ...p, paperEstimate: Math.max(0, (p.paperEstimate ?? 200) - (random() < 0.3 ? 1 : 0)) })),
        pendingEvents: random() < 0.05 ? Math.floor(random() * 20) : 0,
      };
      putHeartbeat(ctx.db, heartbeat);
      ctx.repo.put('machines', { ...machine, online: true, lastSeenAt: nowIso, updatedAt: nowIso }, nowIso);
      heartbeats += 1;
    }
    const touched = new Set<string>();
    for (const state of listReleaseStates(ctx.db)) {
      if (!state.rolloutId || !state.targetVersion) continue;
      const current = getReleaseState(ctx.db, state.machineId) ?? state;
      let next = current.status;
      switch (current.status) {
        case 'pending':
          next = 'downloading';
          break;
        case 'downloading':
          next = 'ready';
          break;
        case 'ready':
          next = 'installing';
          break;
        case 'installing':
          next = random() < 0.02 ? 'failed' : 'completed';
          break;
        default:
          continue;
      }
      const completed = next === 'completed';
      putReleaseState(ctx.db, {
        ...current,
        status: next,
        currentVersion: completed ? current.targetVersion ?? current.currentVersion : current.currentVersion,
        ...(completed ? { installedAt: nowIso } : {}),
        ...(next === 'failed' || completed ? { lastResult: { ok: completed, ...(completed ? {} : { message: 'simulated install failure' }), at: nowIso } } : {}),
        updatedAt: nowIso,
      });
      putMachineEvent(ctx.db, { id: ctx.id('evt'), machineId: current.machineId, at: nowIso, type: 'release_status', severity: next === 'failed' ? 'error' : 'info', message: `release ${current.targetVersion}: ${next}` });
      if (completed) {
        const machine = machines.get(current.machineId);
        if (machine) ctx.repo.put('machines', { ...machine, softwareVersion: current.targetVersion, online: true, lastSeenAt: nowIso, updatedAt: nowIso }, nowIso);
      }
      touched.add(current.rolloutId as string);
      releases += 1;
    }
    for (const rolloutId of touched) refreshRollout(ctx, rolloutId);
    ctx.invalidate([]);
    return { heartbeats, releases };
  };

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        try {
          tick();
        } catch {
          /* un ciclo fallido no detiene el simulador */
        }
      }, opts.intervalMs ?? 10_000);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    tick,
    running: () => timer !== undefined,
  };
}
