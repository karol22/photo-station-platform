/** Definiciones genéricas: operación (incidencias, mantenimiento, sesiones, usuarios, campañas...). */
import { createElement as h } from 'react';
import { Badge } from '@psp/ui';
import { IncidentCategory, IncidentSeverity, IncidentStatus, MaintenanceType, ConsumableType, RoleKey, ScopeLevel, UserStatus, CampaignStatus, AssetCategory, FeatureKey, FeatureMode } from '@psp/contracts';
import { api } from '../../api/resources';
import { assets as assetsApi } from '../../api/special';
import { statusTone } from '../../lib/badges';
import type { ResourceDefinition } from '../types';
import { localizedText, opts, str } from './helpers';

const SCOPE_FIELDS: ResourceDefinition['fields'] = [
  { key: 'scope.level', labelKey: 'admin.field.scopeLevel', type: 'select', options: opts(ScopeLevel.options), required: true },
  { key: 'scope.id', labelKey: 'admin.field.scopeId', type: 'text' },
];

export const usersResource: ResourceDefinition = {
  key: 'users',
  titleKey: 'admin.nav.users',
  resource: api.users,
  permissions: { view: 'users.manage', edit: 'users.manage' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name' },
    { key: 'email', labelKey: 'admin.field.email' },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
    { key: 'locale', labelKey: 'admin.field.locale' },
  ],
  fields: [
    { key: 'email', labelKey: 'admin.field.email', type: 'text', required: true },
    { key: 'name', labelKey: 'admin.field.name', type: 'text', required: true },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(UserStatus.options) },
    { key: 'locale', labelKey: 'admin.field.locale', type: 'select', options: opts(['es', 'en']) },
  ],
  filters: [{ key: 'status', labelKey: 'admin.field.status', options: opts(UserStatus.options) }],
  bulkDelete: true,
};

export const roleAssignmentsResource: ResourceDefinition = {
  key: 'role-assignments',
  titleKey: 'admin.users.assignments',
  resource: api.roleAssignments,
  permissions: { view: 'permissions.edit', edit: 'permissions.edit' },
  columns: [
    { key: 'userId', labelKey: 'admin.field.userId' },
    { key: 'roleKey', labelKey: 'admin.field.roleKey' },
    { key: 'scope', labelKey: 'admin.field.scopeLevel', render: (row) => str((row['scope'] as Record<string, unknown> | undefined)?.['level']) },
    { key: 'expiresAt', labelKey: 'admin.field.expiresAt' },
  ],
  fields: [
    { key: 'userId', labelKey: 'admin.field.userId', type: 'text', required: true },
    { key: 'roleKey', labelKey: 'admin.field.roleKey', type: 'select', options: opts(RoleKey.options), required: true },
    ...SCOPE_FIELDS,
    { key: 'grantedAt', labelKey: 'admin.field.grantedAt', type: 'text', required: true },
    { key: 'expiresAt', labelKey: 'admin.field.expiresAt', type: 'text' },
    { key: 'reason', labelKey: 'admin.field.reason', type: 'text' },
  ],
  bulkDelete: true,
};

export const supportAccessesResource: ResourceDefinition = {
  key: 'support-accesses',
  titleKey: 'admin.users.support',
  resource: api.supportAccesses,
  permissions: { view: 'support.grant', edit: 'support.grant' },
  columns: [
    { key: 'userId', labelKey: 'admin.field.userId' },
    { key: 'reason', labelKey: 'admin.field.reason' },
    { key: 'startsAt', labelKey: 'admin.field.startsAt' },
    { key: 'expiresAt', labelKey: 'admin.field.expiresAt' },
    { key: 'revokedAt', labelKey: 'admin.field.expiresAt', render: (row) => (row['revokedAt'] ? '✓' : '—') },
  ],
  fields: [
    { key: 'userId', labelKey: 'admin.field.userId', type: 'text', required: true },
    ...SCOPE_FIELDS,
    { key: 'permissions', labelKey: 'admin.users.supportPermissions', type: 'tags', required: true },
    { key: 'reason', labelKey: 'admin.field.reason', type: 'text', required: true },
    { key: 'startsAt', labelKey: 'admin.field.startsAt', type: 'text', required: true },
    { key: 'expiresAt', labelKey: 'admin.field.expiresAt', type: 'text', required: true },
    { key: 'revokedAt', labelKey: 'admin.field.expiresAt', type: 'text', hintKey: 'admin.action.revoke' },
  ],
  bulkDelete: true,
};

export const incidentsResource: ResourceDefinition = {
  key: 'incidents',
  titleKey: 'admin.nav.incidents',
  resource: api.incidents,
  permissions: { view: 'incidents.manage', edit: 'incidents.manage' },
  columns: [
    { key: 'code', labelKey: 'admin.field.code' },
    { key: 'title', labelKey: 'admin.field.title' },
    { key: 'severity', labelKey: 'admin.field.severity', render: (row) => h(Badge, { tone: statusTone(str(row['severity']), 'severity'), children: str(row['severity']) }) },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status']), 'incident'), children: str(row['status']) }) },
    { key: 'machineId', labelKey: 'admin.field.machineId' },
  ],
  fields: [
    { key: 'code', labelKey: 'admin.field.code', type: 'text', required: true },
    { key: 'machineId', labelKey: 'admin.field.machineId', type: 'text', required: true },
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text', required: true },
    { key: 'severity', labelKey: 'admin.field.severity', type: 'select', options: opts(IncidentSeverity.options), required: true },
    { key: 'category', labelKey: 'admin.field.category', type: 'select', options: opts(IncidentCategory.options), required: true },
    { key: 'title', labelKey: 'admin.field.title', type: 'text', required: true },
    { key: 'description', labelKey: 'admin.field.description', type: 'text' },
    { key: 'reportedAt', labelKey: 'admin.field.startsAt', type: 'text', required: true },
    { key: 'reportedBy', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'assigneeId', labelKey: 'admin.incidents.assignee', type: 'text' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(IncidentStatus.options) },
    { key: 'notes', labelKey: 'admin.field.json', type: 'json' },
    { key: 'resolution', labelKey: 'admin.incidents.resolution', type: 'text' },
    { key: 'source', labelKey: 'admin.field.type', type: 'select', options: opts(['auto', 'manual']), required: true },
  ],
  filters: [
    { key: 'status', labelKey: 'admin.field.status', options: opts(IncidentStatus.options) },
    { key: 'severity', labelKey: 'admin.field.severity', options: opts(IncidentSeverity.options) },
  ],
  bulkDelete: true,
};

export const maintenanceLogsResource: ResourceDefinition = {
  key: 'maintenance-logs',
  titleKey: 'admin.nav.maintenance',
  resource: api.maintenanceLogs,
  permissions: { view: 'maintenance.log', edit: 'maintenance.log' },
  columns: [
    { key: 'machineId', labelKey: 'admin.field.machineId' },
    { key: 'type', labelKey: 'admin.field.type' },
    { key: 'performedAt', labelKey: 'admin.field.startsAt' },
  ],
  fields: [
    { key: 'machineId', labelKey: 'admin.field.machineId', type: 'text', required: true },
    { key: 'type', labelKey: 'admin.field.type', type: 'select', options: opts(MaintenanceType.options), required: true },
    { key: 'performedAt', labelKey: 'admin.field.startsAt', type: 'text', required: true },
    { key: 'performedBy', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'checklistId', labelKey: 'admin.field.key', type: 'text' },
    { key: 'checklistResults', labelKey: 'admin.field.json', type: 'json' },
    { key: 'notes', labelKey: 'admin.field.notes', type: 'text' },
    { key: 'consumablesUsed', labelKey: 'admin.field.json', type: 'json' },
    { key: 'incidentId', labelKey: 'admin.field.key', type: 'text' },
  ],
  bulkDelete: true,
};

export const consumablesResource: ResourceDefinition = {
  key: 'consumables',
  titleKey: 'admin.nav.consumables',
  resource: api.consumables,
  permissions: { view: 'machines.view', edit: 'maintenance.log' },
  columns: [
    { key: 'machineId', labelKey: 'admin.field.machineId' },
    { key: 'type', labelKey: 'admin.field.consumableType' },
    { key: 'estimatedRemaining', labelKey: 'admin.field.qty' },
  ],
  fields: [
    { key: 'machineId', labelKey: 'admin.field.machineId', type: 'text', required: true },
    { key: 'type', labelKey: 'admin.field.consumableType', type: 'select', options: opts(ConsumableType.options), required: true },
    { key: 'compatibility', labelKey: 'admin.field.type', type: 'text' },
    { key: 'unit', labelKey: 'admin.field.unit', type: 'text' },
    { key: 'installedQty', labelKey: 'admin.field.qty', type: 'number', required: true },
    { key: 'estimatedRemaining', labelKey: 'admin.field.qty', type: 'number', required: true },
    { key: 'changedAt', labelKey: 'admin.field.startsAt', type: 'text', required: true },
    { key: 'changedBy', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'localStock', labelKey: 'admin.field.qty', type: 'number' },
  ],
  bulkDelete: true,
};

/** Lectura únicamente (sin `permissions.edit`): el servidor no ofrece escritura de sesiones. */
export const sessionsResource: ResourceDefinition = {
  key: 'sessions',
  titleKey: 'admin.nav.sessions',
  resource: api.sessions,
  permissions: { view: 'sessions.view' },
  columns: [
    { key: 'code', labelKey: 'admin.field.code' },
    { key: 'machineId', labelKey: 'admin.field.machineId' },
    { key: 'productName', labelKey: 'admin.field.productId' },
    { key: 'stage', labelKey: 'admin.sessions.stage' },
    { key: 'commercial', labelKey: 'admin.sessions.commercialState', render: (row) => { const c = row['commercial'] as Record<string, unknown> | undefined; return h(Badge, { tone: 'info', children: `${str(c?.['state'])} (${str(row['isDemo'] ? 'demo' : 'simulado')})` }); } },
    { key: 'startedAt', labelKey: 'admin.field.startsAt' },
  ],
  fields: [],
  filters: [{ key: 'stage', labelKey: 'admin.sessions.stage', options: opts(['started', 'capturing', 'editing', 'printing', 'done', 'cancelled', 'failed', 'expired', 'abandoned']) }],
  exportEntityType: 'sessions',
};

export const campaignsResource: ResourceDefinition = {
  key: 'campaigns',
  titleKey: 'admin.nav.campaigns',
  resource: api.campaigns,
  permissions: { view: 'campaigns.publish', edit: 'campaigns.publish' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'startsAt', labelKey: 'admin.field.startsAt' },
    { key: 'endsAt', labelKey: 'admin.field.endsAt' },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status']), 'campaign'), children: str(row['status']) }) },
    {
      key: 'id',
      labelKey: 'admin.action.preview',
      render: (row) =>
        h(
          'a',
          { href: `/campaigns/${String(row['id'])}`, onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() },
          str(row['id']),
        ),
    },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text', required: true },
    { key: 'franchiseId', labelKey: 'admin.field.franchiseId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'description', labelKey: 'admin.field.description', type: 'localized' },
    { key: 'startsAt', labelKey: 'admin.field.startsAt', type: 'text', required: true },
    { key: 'endsAt', labelKey: 'admin.field.endsAt', type: 'text', required: true },
    { key: 'targets', labelKey: 'admin.campaigns.targets', type: 'json', required: true },
    { key: 'productIds', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'priceOverrides', labelKey: 'admin.field.json', type: 'json' },
    { key: 'templateIds', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'assetIds', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'texts', labelKey: 'admin.field.json', type: 'json' },
    { key: 'sponsor', labelKey: 'admin.field.json', type: 'json' },
    { key: 'priority', labelKey: 'admin.field.priority', type: 'number' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(CampaignStatus.options) },
    { key: 'configOverlay', labelKey: 'admin.field.json', type: 'json' },
    { key: 'franchiseEditableKeys', labelKey: 'admin.campaigns.editableKeys', type: 'tags' },
    { key: 'mandatory', labelKey: 'admin.field.mandatory', type: 'switch' },
  ],
  filters: [{ key: 'status', labelKey: 'admin.field.status', options: opts(CampaignStatus.options) }],
  bulkDelete: true,
};

export const assetsResource: ResourceDefinition = {
  key: 'assets',
  titleKey: 'admin.nav.assets',
  resource: api.assets,
  permissions: { view: 'assets.manage', edit: 'assets.manage' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name' },
    { key: 'category', labelKey: 'admin.field.category' },
    { key: 'mime', labelKey: 'admin.field.type' },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'text', required: true },
    { key: 'category', labelKey: 'admin.field.category', type: 'select', options: opts(AssetCategory.options), required: true },
    { key: 'ownerScope.level', labelKey: 'admin.field.scopeLevel', type: 'select', options: opts(ScopeLevel.options), required: true },
    { key: 'ownerScope.id', labelKey: 'admin.field.scopeId', type: 'text' },
    { key: 'tags', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(['active', 'archived', 'draft']) },
    { key: 'mime', labelKey: 'admin.field.type', type: 'text', required: true },
    { key: 'bytes', labelKey: 'admin.field.qty', type: 'number', required: true },
    { key: 'hash', labelKey: 'admin.field.code', type: 'text', required: true },
    { key: 'path', labelKey: 'admin.field.url', type: 'text', required: true },
  ],
  filters: [{ key: 'category', labelKey: 'admin.field.category', options: opts(AssetCategory.options) }],
  bulkDelete: true,
  async warnBeforeDelete(id) {
    const usage = await assetsApi.usage(id);
    return usage.usedBy.length > 0 ? usage.usedBy.map((u) => u.name ?? `${u.type}:${u.id}`) : undefined;
  },
};

export const featureOverridesResource: ResourceDefinition = {
  key: 'feature-overrides',
  titleKey: 'admin.nav.features',
  resource: api.featureOverrides,
  permissions: { view: 'features.manage', edit: 'features.manage' },
  columns: [
    { key: 'key', labelKey: 'admin.field.key' },
    { key: 'scope', labelKey: 'admin.field.scopeLevel', render: (row) => str((row['scope'] as Record<string, unknown> | undefined)?.['level']) },
    { key: 'mode', labelKey: 'admin.field.mode', render: (row) => h(Badge, { tone: str(row['mode']) === 'enabled' ? 'ok' : str(row['mode']) === 'locked' ? 'danger' : 'warn', children: str(row['mode']) }) },
  ],
  fields: [
    { key: 'key', labelKey: 'admin.field.key', type: 'select', options: opts(FeatureKey.options), required: true },
    ...SCOPE_FIELDS,
    { key: 'mode', labelKey: 'admin.field.mode', type: 'select', options: opts(FeatureMode.options), required: true },
    { key: 'reason', labelKey: 'admin.field.reason', type: 'text' },
    { key: 'setAt', labelKey: 'admin.field.startsAt', type: 'text', required: true },
  ],
  bulkDelete: true,
};

export const OPS_RESOURCES: ResourceDefinition[] = [
  usersResource,
  roleAssignmentsResource,
  supportAccessesResource,
  incidentsResource,
  maintenanceLogsResource,
  consumablesResource,
  sessionsResource,
  campaignsResource,
  assetsResource,
  featureOverridesResource,
];
