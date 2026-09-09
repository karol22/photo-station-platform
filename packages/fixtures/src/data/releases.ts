/** Releases de software y rollouts. */
import { Release, Rollout } from '@psp/contracts';
import { DEMO_IDS, PILOT_TAG, SOFTWARE_VERSIONS } from '../ids';
import { sha256Hex } from '../sha256';
import { daysAgo } from '../time';
import { audit } from './common';

const ID = DEMO_IDS;

export function buildReleases(): Release[] {
  return [
    Release.parse({ id: ID.release.v010, version: SOFTWARE_VERSIONS.v010, channel: 'production', artifactHash: sha256Hex('station-agent-0.1.0'), notes: 'Primera versión de producción: documental, térmica y entretenimiento.', compatibility: { requiresRestart: true, minHardwareProfileVersion: 1, contractsVersion: 'v1' }, status: 'published', approved: true, publishedAt: '2026-05-01T12:00:00Z', ...audit(ID.user.owner), createdAt: '2026-04-25T12:00:00Z' }),
    Release.parse({ id: ID.release.v020, version: SOFTWARE_VERSIONS.v020, channel: 'stable', artifactHash: sha256Hex('station-agent-0.2.0'), notes: 'Auto-captura estable, panel técnico con simulaciones, rollouts por etiqueta.', compatibility: { requiresRestart: true, minHardwareProfileVersion: 1, compatibleFromVersion: '0.1.0', contractsVersion: 'v1' }, status: 'published', approved: true, publishedAt: daysAgo(10), ...audit(ID.user.owner), createdAt: daysAgo(12) }),
    Release.parse({ id: ID.release.v030pilot, version: SOFTWARE_VERSIONS.v030pilot1, channel: 'pilot', artifactHash: sha256Hex('station-agent-0.3.0-pilot.1'), notes: 'Piloto: modo demo guiado y entrega digital representada.', compatibility: { requiresRestart: false, minHardwareProfileVersion: 1, compatibleFromVersion: '0.2.0', contractsVersion: 'v1' }, status: 'published', approved: false, publishedAt: daysAgo(3), ...audit(ID.user.owner), createdAt: daysAgo(4) }),
  ];
}

export function buildRollouts(): Rollout[] {
  return [
    Rollout.parse({
      id: ID.rollout.v010all, releaseId: ID.release.v010, name: 'Producción 0.1.0 en toda la flota',
      targets: [{ kind: 'organization', organizationId: ID.org.unaDeTodos }, { kind: 'organization', organizationId: ID.org.fotorapida }],
      schedule: { startsAt: '2026-05-01T12:00:00Z', windowStartLocal: '02:00', windowEndLocal: '06:00' }, status: 'completed', isRollback: false,
      stats: { total: 10, pending: 0, downloading: 0, ready: 0, installing: 0, completed: 10, failed: 0, rolledBack: 0, paused: 0 },
      ...audit(ID.user.owner), createdAt: '2026-05-01T12:00:00Z',
    }),
    Rollout.parse({
      id: ID.rollout.v020pilot, releaseId: ID.release.v020, name: 'Piloto 0.2.0: etiqueta piloto + documental universitaria',
      targets: [{ kind: 'tags', tags: [PILOT_TAG] }, { kind: 'machines', machineIds: [ID.machine.doc] }],
      schedule: { startsAt: daysAgo(5), windowStartLocal: '01:00', windowEndLocal: '05:00' }, status: 'in_progress', isRollback: false,
      stats: { total: 3, pending: 0, downloading: 1, ready: 0, installing: 0, completed: 2, failed: 0, rolledBack: 0, paused: 0 },
      ...audit(ID.user.owner), createdAt: daysAgo(5),
    }),
  ];
}
