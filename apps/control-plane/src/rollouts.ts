/**
 * Despliegues: acciones de rollout (start/pause/resume/cancel/expand), estados por máquina,
 * estadísticas y objetivo de release para el heartbeat. Las transiciones respetan
 * `nextReleaseStatus` de @psp/domain (docs/protocolos/fleet-sync-v1.md §7).
 */
import type { FleetCommand, Machine, MachineReleaseState, Release, ReleaseTarget, Rollout, RolloutTarget } from '@psp/contracts';
import { inMaintenanceWindow, resolveRolloutTargets } from '@psp/domain';
import type { AppContext } from './context';
import { conflict, notFound } from './context';
import { getReleaseState, listReleaseStates, putCommand, putReleaseState } from './store';

export function rolloutStats(ctx: AppContext, rolloutId: string): NonNullable<Rollout['stats']> {
  const states = listReleaseStates(ctx.db, rolloutId);
  const count = (status: MachineReleaseState['status']): number => states.filter((s) => s.status === status).length;
  return {
    total: states.length,
    pending: count('pending'),
    downloading: count('downloading'),
    ready: count('ready'),
    installing: count('installing'),
    completed: count('completed'),
    failed: count('failed'),
    rolledBack: count('rolled_back'),
    paused: count('paused'),
  };
}

/** Recalcula stats y cierra el rollout cuando todas las máquinas terminaron. */
export function refreshRollout(ctx: AppContext, rolloutId: string): Rollout | undefined {
  const rollout = ctx.repo.get<Rollout>('rollouts', rolloutId);
  if (!rollout) return undefined;
  const stats = rolloutStats(ctx, rolloutId);
  let status = rollout.status;
  if (status === 'in_progress' && stats.total > 0 && stats.completed + stats.failed + stats.rolledBack === stats.total) {
    status = stats.failed + stats.rolledBack === stats.total ? 'failed' : 'completed';
  }
  const now = ctx.nowIso();
  const updated: Rollout = { ...rollout, stats, status, updatedAt: now };
  ctx.repo.put('rollouts', updated, now);
  return updated;
}

function applyReleaseCommand(ctx: AppContext, machine: Machine, rollout: Rollout, release: Release): FleetCommand {
  const command: FleetCommand = {
    id: ctx.id('cmd'),
    type: 'apply_release',
    issuedAt: ctx.nowIso(),
    releaseId: release.id,
    rolloutId: rollout.id,
    version: release.version,
    artifactHash: release.artifactHash,
    requiresRestart: release.compatibility.requiresRestart,
    ...(rollout.schedule.windowStartLocal !== undefined ? { windowStartLocal: rollout.schedule.windowStartLocal } : {}),
    ...(rollout.schedule.windowEndLocal !== undefined ? { windowEndLocal: rollout.schedule.windowEndLocal } : {}),
  };
  putCommand(ctx.db, command, machine.id);
  return command;
}

/** Asigna la release a las máquinas objetivo: estado `pending` + comando `apply_release`. */
function assignTargets(ctx: AppContext, rollout: Rollout, release: Release, machines: Machine[]): number {
  let assigned = 0;
  for (const machine of machines) {
    const current = getReleaseState(ctx.db, machine.id);
    if (current && current.rolloutId === rollout.id && !['failed', 'paused', 'up_to_date'].includes(current.status)) continue;
    if ((current?.currentVersion ?? machine.softwareVersion) === release.version) continue;
    putReleaseState(ctx.db, {
      machineId: machine.id,
      currentVersion: current?.currentVersion ?? machine.softwareVersion ?? '0.0.0',
      targetVersion: release.version,
      rolloutId: rollout.id,
      status: 'pending',
      requiresRestart: release.compatibility.requiresRestart,
      updatedAt: ctx.nowIso(),
    });
    applyReleaseCommand(ctx, machine, rollout, release);
    ctx.repo.put('machines', { ...machine, targetSoftwareVersion: release.version, updatedAt: ctx.nowIso() }, ctx.nowIso());
    assigned += 1;
  }
  return assigned;
}

export function targetMachines(ctx: AppContext, targets: RolloutTarget[]): Machine[] {
  return resolveRolloutTargets(ctx.index(), targets).filter((m) => !['retired', 'storage'].includes(m.status));
}

export function runRolloutAction(
  ctx: AppContext,
  rollout: Rollout,
  action: 'start' | 'pause' | 'resume' | 'cancel' | 'expand',
  expandTargets: RolloutTarget[] = [],
): Rollout {
  const release = ctx.repo.get<Release>('releases', rollout.releaseId);
  if (!release) throw notFound('release', rollout.releaseId);
  const now = ctx.nowIso();
  switch (action) {
    case 'start': {
      if (rollout.status === 'in_progress') throw conflict('Rollout already in progress');
      if (rollout.status === 'completed' || rollout.status === 'cancelled') throw conflict(`Rollout is ${rollout.status}`);
      const machines = targetMachines(ctx, rollout.targets);
      ctx.repo.put('rollouts', { ...rollout, status: 'in_progress', updatedAt: now }, now);
      assignTargets(ctx, { ...rollout, status: 'in_progress' }, release, machines);
      break;
    }
    case 'pause': {
      if (rollout.status !== 'in_progress') throw conflict('Rollout is not in progress');
      for (const state of listReleaseStates(ctx.db, rollout.id)) {
        if (!['pending', 'downloading', 'ready'].includes(state.status)) continue;
        putReleaseState(ctx.db, { ...state, status: 'paused', updatedAt: now });
        putCommand(ctx.db, { id: ctx.id('cmd'), type: 'pause_release', issuedAt: now, rolloutId: rollout.id }, state.machineId);
      }
      ctx.repo.put('rollouts', { ...rollout, status: 'paused', updatedAt: now }, now);
      break;
    }
    case 'resume': {
      if (rollout.status !== 'paused') throw conflict('Rollout is not paused');
      ctx.repo.put('rollouts', { ...rollout, status: 'in_progress', updatedAt: now }, now);
      for (const state of listReleaseStates(ctx.db, rollout.id)) {
        if (state.status !== 'paused') continue;
        const machine = ctx.index().machines.get(state.machineId);
        putReleaseState(ctx.db, { ...state, status: 'pending', updatedAt: now });
        if (machine) applyReleaseCommand(ctx, machine, rollout, release);
      }
      break;
    }
    case 'cancel': {
      if (rollout.status === 'completed' || rollout.status === 'cancelled') throw conflict(`Rollout is ${rollout.status}`);
      for (const state of listReleaseStates(ctx.db, rollout.id)) {
        if (state.status === 'completed') continue;
        const { targetVersion: _target, ...rest } = state;
        void _target;
        putReleaseState(ctx.db, { ...rest, status: 'up_to_date', updatedAt: now });
        putCommand(ctx.db, { id: ctx.id('cmd'), type: 'pause_release', issuedAt: now, rolloutId: rollout.id }, state.machineId);
      }
      ctx.repo.put('rollouts', { ...rollout, status: 'cancelled', updatedAt: now }, now);
      break;
    }
    case 'expand': {
      if (expandTargets.length === 0) throw conflict('expandTargets is required');
      const targets = [...rollout.targets, ...expandTargets];
      const updated: Rollout = { ...rollout, targets, updatedAt: now };
      ctx.repo.put('rollouts', updated, now);
      if (rollout.status === 'in_progress') assignTargets(ctx, updated, release, targetMachines(ctx, expandTargets));
      break;
    }
  }
  const refreshed = refreshRollout(ctx, rollout.id);
  if (!refreshed) throw notFound('rollout', rollout.id);
  return refreshed;
}

/** Objetivo de release vigente para la máquina (pending/downloading/ready/installing dentro de ventana). */
export function releaseTargetFor(ctx: AppContext, machineId: string, localTime: string | undefined): ReleaseTarget | undefined {
  const state = getReleaseState(ctx.db, machineId);
  if (!state || !state.rolloutId || !state.targetVersion) return undefined;
  if (!['pending', 'downloading', 'ready', 'installing'].includes(state.status)) return undefined;
  const rollout = ctx.repo.get<Rollout>('rollouts', state.rolloutId);
  if (!rollout || (rollout.status !== 'in_progress' && rollout.status !== 'scheduled')) return undefined;
  const release = ctx.repo.get<Release>('releases', rollout.releaseId);
  if (!release) return undefined;
  const { windowStartLocal, windowEndLocal } = rollout.schedule;
  if (localTime !== undefined && state.status === 'pending' && !inMaintenanceWindow(localTime, windowStartLocal, windowEndLocal)) return undefined;
  return {
    releaseId: release.id,
    rolloutId: rollout.id,
    version: release.version,
    channel: release.channel,
    artifactHash: release.artifactHash,
    requiresRestart: release.compatibility.requiresRestart,
    ...(windowStartLocal !== undefined ? { windowStartLocal } : {}),
    ...(windowEndLocal !== undefined ? { windowEndLocal } : {}),
  };
}
