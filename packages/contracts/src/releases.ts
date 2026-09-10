import { z } from 'zod';
import { AuditFields, Id, Timestamp } from './common';
import { ReleaseChannel } from './hierarchy';

export { ReleaseChannel };

export const Release = z
  .object({
    id: Id,
    version: z.string(),
    channel: ReleaseChannel,
    artifactHash: z.string(),
    notes: z.string().optional(),
    compatibility: z.object({
      requiresRestart: z.boolean().default(false),
      minHardwareProfileVersion: z.number().int().optional(),
      compatibleFromVersion: z.string().optional(),
      contractsVersion: z.string().default('v1'),
    }),
    status: z.enum(['draft', 'published', 'withdrawn']).default('draft'),
    approved: z.boolean().default(false),
    publishedAt: Timestamp.optional(),
  })
  .extend(AuditFields.shape);
export type Release = z.infer<typeof Release>;

export const RolloutTarget = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('machines'), machineIds: z.array(Id).min(1) }),
  z.object({ kind: z.literal('location'), locationId: Id }),
  z.object({ kind: z.literal('franchise'), franchiseId: Id }),
  z.object({ kind: z.literal('region'), regionId: Id }),
  z.object({ kind: z.literal('organization'), organizationId: Id }),
  z.object({ kind: z.literal('hardwareProfile'), hardwareProfileId: Id }),
  z.object({ kind: z.literal('channel'), channel: ReleaseChannel }),
  z.object({ kind: z.literal('tags'), tags: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal('percentage'), percent: z.number().min(1).max(100), seed: z.string() }),
]);
export type RolloutTarget = z.infer<typeof RolloutTarget>;

export const RolloutStatus = z.enum(['draft', 'scheduled', 'in_progress', 'paused', 'completed', 'failed', 'cancelled']);
export type RolloutStatus = z.infer<typeof RolloutStatus>;

export const Rollout = z
  .object({
    id: Id,
    releaseId: Id,
    name: z.string(),
    targets: z.array(RolloutTarget).min(1),
    schedule: z
      .object({
        startsAt: Timestamp.optional(),
        windowStartLocal: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        windowEndLocal: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      })
      .default({}),
    status: RolloutStatus.default('draft'),
    isRollback: z.boolean().default(false),
    stats: z
      .object({
        total: z.number().int(),
        pending: z.number().int(),
        downloading: z.number().int(),
        ready: z.number().int(),
        installing: z.number().int(),
        completed: z.number().int(),
        failed: z.number().int(),
        rolledBack: z.number().int(),
        paused: z.number().int(),
      })
      .optional(),
  })
  .extend(AuditFields.shape);
export type Rollout = z.infer<typeof Rollout>;

/** Estado de una máquina respecto a una release (requisito 19.5). */
export const MachineReleaseStatus = z.enum([
  'pending',
  'downloading',
  'ready',
  'installing',
  'completed',
  'failed',
  'rolled_back',
  'paused',
  'up_to_date',
]);
export type MachineReleaseStatus = z.infer<typeof MachineReleaseStatus>;

export const MachineReleaseState = z.object({
  machineId: Id,
  currentVersion: z.string(),
  targetVersion: z.string().optional(),
  rolloutId: Id.optional(),
  status: MachineReleaseStatus,
  requiresRestart: z.boolean().default(false),
  installedAt: Timestamp.optional(),
  lastResult: z.object({ ok: z.boolean(), message: z.string().optional(), at: Timestamp }).optional(),
  updatedAt: Timestamp,
});
export type MachineReleaseState = z.infer<typeof MachineReleaseState>;
