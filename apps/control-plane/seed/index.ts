/**
 * Seed del plano de control: inserta todas las colecciones del dataset, el libro de sesiones,
 * credenciales de máquina deterministas (`stableHash('secret:' + machineId)`), credenciales de
 * usuario (sha256 de la contraseña), heartbeats coherentes con `online/lastSeenAt`, estados de
 * release y eventos de ejemplo. Idempotente: borra y reinserta por tipo.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConsumableType, type Consumable, type HeartbeatRequest, type Machine, type MachineReleaseState, type Release, type Rollout, type SessionRecord } from '@psp/contracts';
import { buildHierarchyIndex, resolveRolloutTargets, stableHash } from '@psp/domain';
import { execute, type DatabaseSync } from '@psp/sqlite';
import { EntityRepo, putCommand, putCredential, putHeartbeat, putMachineEvent, putReleaseState, putSessionRecord, transaction, type EntityType } from '../src/store';

/** Dataset aceptado por el seed: cualquier subconjunto de colecciones del `DemoDataset` de fixtures. */
export type SeedDataset = Partial<Record<Exclude<EntityType, 'credentials'>, Array<Record<string, unknown>>>> & {
  sessionRecords?: SessionRecord[];
};

export interface SeedUser {
  id: string;
  email: string;
  passwordHash: string;
}

export interface SeedOptions {
  now: Date;
  /** Usuarios con credencial (DEMO_USERS de fixtures). */
  users?: SeedUser[];
  /** Directorio de activos; si se da junto con `assetContent`, escribe `<assetsDir>/<hash>`. */
  assetsDir?: string;
  assetContent?: (assetId: string) => { mime: string; bytes: Uint8Array };
}

export const SEED_COLLECTIONS: Array<Exclude<EntityType, 'credentials'>> = [
  'organizations',
  'franchises',
  'territories',
  'regions',
  'locations',
  'machines',
  'hardwareProfiles',
  'blueprints',
  'users',
  'roleAssignments',
  'supportAccesses',
  'products',
  'productAvailabilities',
  'priceRules',
  'promotions',
  'presets',
  'presetVersions',
  'templates',
  'experiences',
  'editingPresets',
  'campaigns',
  'assets',
  'retentionPolicies',
  'maintenanceChecklists',
  'configLayers',
  'featureOverrides',
  'entitlementPlans',
  'entitlements',
  'releases',
  'rollouts',
  'internalDocuments',
  'announcements',
  'incidents',
  'maintenanceLogs',
  'consumables',
  'savedViews',
];

const consumableTypeOf = (value: string | undefined): Consumable['type'] =>
  ConsumableType.safeParse(value).success ? (value as Consumable['type']) : 'other';

let seedSeq = 0;
const seedId = (prefix: string, key: string): string => `${prefix}_${stableHash(`seed:${key}:${seedSeq++}`).slice(0, 12)}`;

export function seedDatabase(db: DatabaseSync, dataset: SeedDataset, opts: SeedOptions): Record<string, number> {
  const repo = new EntityRepo(db);
  const now = opts.now.toISOString();
  const counts: Record<string, number> = {};
  seedSeq = 0;
  transaction(db, () => {
    for (const type of SEED_COLLECTIONS) {
      repo.deleteAll(type);
      const items = dataset[type] ?? [];
      for (const item of items) {
        const entity = type === 'presetVersions' && typeof item['id'] !== 'string' ? { ...item, id: `${String(item['presetId'])}:${String(item['version'])}` } : item;
        repo.put(type, entity as { id: string }, String(entity['updatedAt'] ?? entity['createdAt'] ?? now));
      }
      counts[type] = items.length;
    }

    repo.deleteAll('credentials');
    for (const user of opts.users ?? []) repo.put('credentials', { id: user.id, userId: user.id, email: user.email, passwordHash: user.passwordHash }, now);
    counts['credentials'] = (opts.users ?? []).length;

    execute(db, 'DELETE FROM session_records');
    for (const record of dataset.sessionRecords ?? []) putSessionRecord(db, record);
    counts['sessionRecords'] = (dataset.sessionRecords ?? []).length;

    for (const table of ['machine_events', 'heartbeats', 'fleet_events_seen', 'machine_release_states', 'commands', 'machine_credentials', 'auth_tokens', 'bundles']) execute(db, `DELETE FROM ${table}`);

    const machines = (dataset.machines ?? []) as unknown as Machine[];
    const releases = new Map(((dataset.releases ?? []) as unknown as Release[]).map((r) => [r.id, r]));
    const rollouts = (dataset.rollouts ?? []) as unknown as Rollout[];
    const index = buildHierarchyIndex({
      organizations: (dataset.organizations ?? []) as never,
      franchises: (dataset.franchises ?? []) as never,
      regions: (dataset.regions ?? []) as never,
      locations: (dataset.locations ?? []) as never,
      machines,
    });
    const targets = new Map<string, { rollout: Rollout; release: Release }>();
    for (const rollout of rollouts) {
      if (rollout.status !== 'in_progress') continue;
      const release = releases.get(rollout.releaseId);
      if (!release) continue;
      for (const machine of resolveRolloutTargets(index, rollout.targets)) targets.set(machine.id, { rollout, release });
    }

    for (const machine of machines) {
      putCredential(db, machine.id, stableHash(`secret:${machine.id}`));
      const seenAt = machine.lastSeenAt ?? now;
      const target = targets.get(machine.id);
      const currentVersion = machine.softwareVersion ?? '0.0.0';
      const releaseState: MachineReleaseState = target && target.release.version !== currentVersion
        ? { machineId: machine.id, currentVersion, targetVersion: target.release.version, rolloutId: target.rollout.id, status: 'pending', requiresRestart: target.release.compatibility.requiresRestart, updatedAt: now }
        : { machineId: machine.id, currentVersion, status: 'up_to_date', requiresRestart: false, updatedAt: now };
      putReleaseState(db, releaseState);
      if (releaseState.status === 'pending' && target) {
        putCommand(db, { id: seedId('cmd', machine.id), type: 'apply_release', issuedAt: now, releaseId: target.release.id, rolloutId: target.rollout.id, version: target.release.version, artifactHash: target.release.artifactHash, requiresRestart: target.release.compatibility.requiresRestart }, machine.id);
      }
      if (machine.status === 'configuring' && !machine.online) continue;
      const heartbeat: HeartbeatRequest = {
        machineId: machine.id,
        at: seenAt,
        localTime: '12:00',
        timezone: machine.timezone ?? 'UTC',
        softwareVersion: currentVersion,
        ...(machine.bundleVersion !== undefined ? { bundleVersion: machine.bundleVersion } : {}),
        status: machine.status,
        capabilities: machine.capabilities,
        printers: machine.printers.map((p, i) => ({ ...p, status: 'ready', paperEstimate: 120 + ((stableHash(machine.id + i).charCodeAt(0) * 7) % 200) })),
        consumables: machine.printers.map((p) => ({ type: consumableTypeOf(p.consumableType), estimatedRemaining: 120 + (stableHash(machine.id + p.id).charCodeAt(1) % 200), unit: 'prints' })),
        health: { cpuPct: 10 + (stableHash(machine.id).charCodeAt(2) % 40), memPct: 35 + (stableHash(machine.id).charCodeAt(3) % 30), diskFreeMb: 40000, storagePct: 20 + (stableHash(machine.id).charCodeAt(4) % 50), uptimeSec: 3600 * (1 + (stableHash(machine.id).charCodeAt(5) % 72)), cloudReachable: machine.online },
        release: { currentVersion, ...(releaseState.targetVersion !== undefined ? { targetVersion: releaseState.targetVersion } : {}), ...(releaseState.rolloutId !== undefined ? { rolloutId: releaseState.rolloutId } : {}), status: releaseState.status, requiresRestart: releaseState.requiresRestart },
        pendingEvents: machine.online ? 0 : 12,
        maintenance: { on: machine.status === 'maintenance' },
      };
      putHeartbeat(db, heartbeat);
      putMachineEvent(db, { id: seedId('evt', machine.id), machineId: machine.id, at: seenAt, type: machine.online ? 'online' : 'offline', severity: machine.online ? 'info' : 'warning', message: machine.online ? 'Heartbeat received' : 'No heartbeat since last contact' });
      putMachineEvent(db, { id: seedId('evt', machine.id), machineId: machine.id, at: seenAt, type: 'heartbeat', severity: 'info', message: `Heartbeat ${currentVersion}` });
    }
    counts['machineCredentials'] = machines.length;

    if (opts.assetsDir && opts.assetContent) {
      mkdirSync(opts.assetsDir, { recursive: true });
      let written = 0;
      for (const asset of (dataset.assets ?? []) as Array<{ id: string; hash: string }>) {
        try {
          const content = opts.assetContent(asset.id);
          writeFileSync(join(opts.assetsDir, asset.hash), content.bytes);
          written += 1;
        } catch {
          /* activo sin contenido generado */
        }
      }
      counts['assetFiles'] = written;
    }
  });
  return counts;
}
