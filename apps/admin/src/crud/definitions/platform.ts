/** Definiciones genéricas: plataforma (retención, checklists, entitlements, releases, anuncios). */
import { createElement as h } from 'react';
import { Badge } from '@psp/ui';
import { ReleaseChannel, RetentionMode, ScopeLevel } from '@psp/contracts';
import { api } from '../../api/resources';
import { statusTone } from '../../lib/badges';
import type { ResourceDefinition } from '../types';
import { localizedText, opts, str } from './helpers';

export const retentionPoliciesResource: ResourceDefinition = {
  key: 'retention-policies',
  titleKey: 'admin.field.retentionMode',
  resource: api.retentionPolicies,
  permissions: { view: 'privacy.edit', edit: 'privacy.edit' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'mode', labelKey: 'admin.field.retentionMode' },
    { key: 'durationMinutes', labelKey: 'admin.field.durationMinutes' },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'mode', labelKey: 'admin.field.retentionMode', type: 'select', options: opts(RetentionMode.options), required: true },
    { key: 'durationMinutes', labelKey: 'admin.field.durationMinutes', type: 'number' },
    { key: 'deleteIncomplete', labelKey: 'admin.field.deleteIncomplete', type: 'switch' },
    { key: 'appliesToKinds', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'customerText', labelKey: 'admin.field.customerText', type: 'localized', required: true },
    { key: 'leavesDevice', labelKey: 'admin.field.leavesDevice', type: 'switch' },
  ],
  bulkDelete: true,
};

export const maintenanceChecklistsResource: ResourceDefinition = {
  key: 'maintenance-checklists',
  titleKey: 'admin.nav.maintenance',
  resource: api.maintenanceChecklists,
  permissions: { view: 'machines.maintenance', edit: 'machines.maintenance' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'hardwareProfileId', labelKey: 'admin.field.hardwareProfileId' },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'hardwareProfileId', labelKey: 'admin.field.hardwareProfileId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'items', labelKey: 'admin.field.json', type: 'json', required: true },
  ],
  bulkDelete: true,
};

export const entitlementPlansResource: ResourceDefinition = {
  key: 'entitlement-plans',
  titleKey: 'admin.nav.entitlements',
  resource: api.entitlementPlans,
  permissions: { view: 'features.manage', edit: 'features.manage' },
  columns: [
    { key: 'key', labelKey: 'admin.field.key' },
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
  ],
  fields: [
    { key: 'key', labelKey: 'admin.field.key', type: 'text', required: true },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'features', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'limits', labelKey: 'admin.field.json', type: 'json' },
  ],
  bulkDelete: true,
};

export const entitlementsResource: ResourceDefinition = {
  key: 'entitlements',
  titleKey: 'admin.nav.entitlements',
  resource: api.entitlements,
  permissions: { view: 'features.manage', edit: 'features.manage' },
  columns: [
    { key: 'scope', labelKey: 'admin.field.scopeLevel', render: (row) => str((row['scope'] as Record<string, unknown> | undefined)?.['level']) },
    { key: 'planId', labelKey: 'admin.field.key' },
    { key: 'startsAt', labelKey: 'admin.field.startsAt' },
    { key: 'endsAt', labelKey: 'admin.field.endsAt' },
  ],
  fields: [
    { key: 'scope.level', labelKey: 'admin.field.scopeLevel', type: 'select', options: opts(ScopeLevel.options), required: true },
    { key: 'scope.id', labelKey: 'admin.field.scopeId', type: 'text' },
    { key: 'planId', labelKey: 'admin.field.key', type: 'text', required: true },
    { key: 'startsAt', labelKey: 'admin.field.startsAt', type: 'text', required: true },
    { key: 'endsAt', labelKey: 'admin.field.endsAt', type: 'text' },
    { key: 'notes', labelKey: 'admin.field.notes', type: 'text' },
  ],
  bulkDelete: true,
};

export const releasesResource: ResourceDefinition = {
  key: 'releases',
  titleKey: 'admin.nav.releases',
  resource: api.releases,
  permissions: { view: 'releases.manage', edit: 'releases.manage' },
  columns: [
    { key: 'version', labelKey: 'admin.field.version' },
    { key: 'channel', labelKey: 'admin.field.releaseChannel', render: (row) => str(row['channel']) },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
    { key: 'approved', labelKey: 'admin.field.approved', render: (row) => (row['approved'] ? '✓' : '—') },
  ],
  fields: [
    { key: 'version', labelKey: 'admin.field.version', type: 'text', required: true },
    { key: 'channel', labelKey: 'admin.field.releaseChannel', type: 'select', options: opts(ReleaseChannel.options), required: true },
    { key: 'artifactHash', labelKey: 'admin.field.artifactHash', type: 'text', required: true },
    { key: 'notes', labelKey: 'admin.field.notes', type: 'text' },
    { key: 'compatibility', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(['draft', 'published', 'withdrawn']) },
    { key: 'approved', labelKey: 'admin.field.approved', type: 'switch' },
  ],
  filters: [{ key: 'channel', labelKey: 'admin.field.releaseChannel', options: opts(ReleaseChannel.options) }],
  bulkDelete: true,
};

export const announcementsResource: ResourceDefinition = {
  key: 'announcements',
  titleKey: 'admin.nav.announcements',
  resource: api.announcements,
  permissions: { view: 'announcements.publish', edit: 'announcements.publish' },
  columns: [
    { key: 'title', labelKey: 'admin.field.title', render: (row) => localizedText(row['title']) },
    { key: 'publishedAt', labelKey: 'admin.field.startsAt' },
    { key: 'pinned', labelKey: 'admin.field.pinned', render: (row) => (row['pinned'] ? '✓' : '—') },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text', required: true },
    { key: 'title', labelKey: 'admin.field.title', type: 'localized', required: true },
    { key: 'body', labelKey: 'admin.field.body', type: 'localized', required: true },
    { key: 'publishedAt', labelKey: 'admin.field.startsAt', type: 'text', required: true },
    { key: 'expiresAt', labelKey: 'admin.field.endsAt', type: 'text' },
    { key: 'audienceFranchiseIds', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'pinned', labelKey: 'admin.field.pinned', type: 'switch' },
  ],
  bulkDelete: true,
};

/** Vistas guardadas: no tiene permiso propio en el RBAC cerrado; se gatea con `machines.view` (amplio). */
export const savedViewsResource: ResourceDefinition = {
  key: 'saved-views',
  titleKey: 'admin.savedViews.title',
  resource: api.savedViews,
  permissions: { view: 'machines.view', edit: 'machines.view' },
  columns: [
    { key: 'name', labelKey: 'admin.savedViews.nameLabel' },
    { key: 'route', labelKey: 'admin.savedViews.route' },
    { key: 'shared', labelKey: 'admin.savedViews.shared', render: (row) => (row['shared'] ? '✓' : '—') },
  ],
  fields: [
    { key: 'userId', labelKey: 'admin.field.userId', type: 'text', required: true },
    { key: 'name', labelKey: 'admin.savedViews.nameLabel', type: 'text', required: true },
    { key: 'route', labelKey: 'admin.savedViews.route', type: 'text', required: true },
    { key: 'query', labelKey: 'admin.field.json', type: 'json' },
    { key: 'shared', labelKey: 'admin.savedViews.shared', type: 'switch' },
  ],
  bulkDelete: true,
};

export const PLATFORM_RESOURCES: ResourceDefinition[] = [
  retentionPoliciesResource,
  maintenanceChecklistsResource,
  entitlementPlansResource,
  entitlementsResource,
  releasesResource,
  announcementsResource,
  savedViewsResource,
];
