import { z } from 'zod';
import { AuditFields, Id, LocaleCode, LocalizedText, Scope, Timestamp } from './common';

/** Permisos granulares (requisito 3.2). Lista cerrada. */
export const PermissionKey = z.enum([
  'organizations.view',
  'organizations.create',
  'organizations.edit',
  'franchises.view',
  'franchises.create',
  'franchises.edit',
  'locations.view',
  'locations.create',
  'locations.edit',
  'machines.view',
  'machines.edit',
  'machines.maintenance',
  'machines.commands',
  'pricing.edit',
  'products.manage',
  'campaigns.publish',
  'campaigns.edit_local',
  'templates.manage',
  'presets.manage',
  'assets.manage',
  'photos.view_exceptional',
  'sessions.view',
  'metrics.view',
  'data.export',
  'data.import',
  'users.manage',
  'permissions.edit',
  'features.manage',
  'releases.manage',
  'releases.rollback',
  'audit.view',
  'branding.manage',
  'privacy.edit',
  'config.edit',
  'maintenance.log',
  'incidents.manage',
  'incidents.close',
  'support.grant',
  'announcements.publish',
  'docs.manage',
]);
export type PermissionKey = z.infer<typeof PermissionKey>;

/** Roles internos (requisito 3.1). */
export const RoleKey = z.enum([
  'platform_owner',
  'superadmin',
  'brand_admin',
  'franchise_owner',
  'regional_manager',
  'location_manager',
  'operator',
  'technician',
  'content_designer',
  'analyst',
  'auditor',
  'internal_support',
  'temp_support',
]);
export type RoleKey = z.infer<typeof RoleKey>;

export const Role = z.object({
  key: RoleKey,
  name: LocalizedText,
  description: LocalizedText.optional(),
  permissions: z.array(PermissionKey),
});
export type Role = z.infer<typeof Role>;

export const UserStatus = z.enum(['active', 'invited', 'suspended']);

export const User = z
  .object({
    id: Id,
    email: z.string(),
    name: z.string(),
    status: UserStatus.default('active'),
    locale: LocaleCode.default('es'),
    lastLoginAt: Timestamp.optional(),
  })
  .extend(AuditFields.shape);
export type User = z.infer<typeof User>;

export const RoleAssignment = z.object({
  id: Id,
  userId: Id,
  roleKey: RoleKey,
  scope: Scope,
  grantedBy: Id.optional(),
  grantedAt: Timestamp,
  expiresAt: Timestamp.optional(),
  reason: z.string().optional(),
});
export type RoleAssignment = z.infer<typeof RoleAssignment>;

/** Acceso de soporte acotado (requisito 3.4). */
export const SupportAccess = z.object({
  id: Id,
  userId: Id,
  scope: Scope,
  permissions: z.array(PermissionKey),
  reason: z.string(),
  grantedBy: Id,
  startsAt: Timestamp,
  expiresAt: Timestamp,
  revokedAt: Timestamp.optional(),
  revokedBy: Id.optional(),
});
export type SupportAccess = z.infer<typeof SupportAccess>;

/** Identidad resuelta de una sesión administrativa. */
export const Principal = z.object({
  user: User,
  assignments: z.array(RoleAssignment),
  supportAccesses: z.array(SupportAccess).default([]),
  permissions: z.array(z.object({ key: PermissionKey, scope: Scope })),
});
export type Principal = z.infer<typeof Principal>;
