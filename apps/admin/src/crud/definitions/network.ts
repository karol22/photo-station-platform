/** Definiciones genéricas: organizaciones, franquicias, territorios, regiones, ubicaciones, red. */
import { createElement as h } from 'react';
import { Badge } from '@psp/ui';
import { FranchiseStatus, LocationStatus, LocationType, OrganizationStatus } from '@psp/contracts';
import { api } from '../../api/resources';
import { statusTone } from '../../lib/badges';
import type { ResourceDefinition } from '../types';
import { humanize, localizedText, opts, str } from './helpers';

export const organizationsResource: ResourceDefinition = {
  key: 'organizations',
  titleKey: 'admin.nav.organizations',
  resource: api.organizations,
  permissions: { view: 'organizations.view', edit: 'organizations.edit' },
  scopeLevel: 'organization',
  columns: [
    { key: 'name', labelKey: 'admin.field.name' },
    { key: 'slug', labelKey: 'admin.field.slug' },
    { key: 'country', labelKey: 'admin.field.country' },
    { key: 'currency', labelKey: 'admin.field.currency' },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
  ],
  fields: [
    { key: 'name', labelKey: 'admin.field.name', type: 'text', required: true },
    { key: 'slug', labelKey: 'admin.field.slug', type: 'text', required: true },
    { key: 'legalName', labelKey: 'admin.field.legalName', type: 'text' },
    { key: 'country', labelKey: 'admin.field.country', type: 'text', required: true },
    { key: 'currency', labelKey: 'admin.field.currency', type: 'text', required: true },
    { key: 'timezone', labelKey: 'admin.field.timezone', type: 'text', required: true },
    { key: 'defaultLocale', labelKey: 'admin.field.locale', type: 'select', options: opts(['es', 'en']) },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(OrganizationStatus.options) },
  ],
  filters: [{ key: 'status', labelKey: 'admin.field.status', options: opts(OrganizationStatus.options) }],
};

export const franchisesResource: ResourceDefinition = {
  key: 'franchises',
  titleKey: 'admin.nav.franchises',
  resource: api.franchises,
  permissions: { view: 'franchises.view', edit: 'franchises.edit' },
  scopeLevel: 'franchise',
  columns: [
    { key: 'name', labelKey: 'admin.field.name' },
    { key: 'organizationId', labelKey: 'admin.field.organizationId' },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text', required: true },
    { key: 'name', labelKey: 'admin.field.name', type: 'text', required: true },
    { key: 'legalName', labelKey: 'admin.field.legalName', type: 'text' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(FranchiseStatus.options) },
    { key: 'notes', labelKey: 'admin.field.notes', type: 'text' },
  ],
  filters: [{ key: 'status', labelKey: 'admin.field.status', options: opts(FranchiseStatus.options) }],
  exportEntityType: undefined,
  bulkDelete: true,
};

export const territoriesResource: ResourceDefinition = {
  key: 'territories',
  titleKey: 'admin.nav.territories',
  resource: api.territories,
  permissions: { view: 'franchises.view', edit: 'franchises.edit' },
  scopeLevel: 'franchise',
  columns: [
    { key: 'franchiseId', labelKey: 'admin.field.franchiseId' },
    { key: 'country', labelKey: 'admin.field.country' },
    { key: 'city', labelKey: 'admin.field.city' },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
  ],
  fields: [
    { key: 'franchiseId', labelKey: 'admin.field.franchiseId', type: 'text', required: true },
    { key: 'country', labelKey: 'admin.field.country', type: 'text', required: true },
    { key: 'state', labelKey: 'admin.field.state', type: 'text' },
    { key: 'city', labelKey: 'admin.field.city', type: 'text' },
    { key: 'commercialZone', labelKey: 'admin.field.commercialZone', type: 'text' },
    { key: 'startDate', labelKey: 'admin.field.startDate', type: 'text', required: true, placeholder: '2026-01-01T00:00:00Z' },
    { key: 'endDate', labelKey: 'admin.field.endDate', type: 'text' },
    { key: 'exclusive', labelKey: 'admin.field.exclusive', type: 'switch' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(['active', 'inactive']) },
    { key: 'notes', labelKey: 'admin.field.notes', type: 'text' },
  ],
  bulkDelete: true,
};

export const regionsResource: ResourceDefinition = {
  key: 'regions',
  titleKey: 'admin.nav.regions',
  resource: api.regions,
  permissions: { view: 'franchises.view', edit: 'franchises.edit' },
  scopeLevel: 'region',
  columns: [
    { key: 'name', labelKey: 'admin.field.name' },
    { key: 'organizationId', labelKey: 'admin.field.organizationId' },
    { key: 'franchiseId', labelKey: 'admin.field.franchiseId' },
    { key: 'country', labelKey: 'admin.field.country' },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text', required: true },
    { key: 'franchiseId', labelKey: 'admin.field.franchiseId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'text', required: true },
    { key: 'country', labelKey: 'admin.field.country', type: 'text' },
    { key: 'timezone', labelKey: 'admin.field.timezone', type: 'text' },
  ],
  bulkDelete: true,
};

export const locationsResource: ResourceDefinition = {
  key: 'locations',
  titleKey: 'admin.nav.locations',
  resource: api.locations,
  permissions: { view: 'locations.view', edit: 'locations.edit' },
  scopeLevel: 'location',
  columns: [
    { key: 'publicName', labelKey: 'admin.field.publicName' },
    { key: 'internalName', labelKey: 'admin.field.internalName' },
    { key: 'address', labelKey: 'admin.field.city', render: (row) => str((row['address'] as Record<string, unknown> | undefined)?.['city']) },
    { key: 'type', labelKey: 'admin.field.type', render: (row) => humanize(str(row['type'])) },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text', required: true },
    { key: 'franchiseId', labelKey: 'admin.field.franchiseId', type: 'text' },
    { key: 'regionId', labelKey: 'admin.field.regionId', type: 'text' },
    { key: 'internalName', labelKey: 'admin.field.internalName', type: 'text', required: true },
    { key: 'publicName', labelKey: 'admin.field.publicName', type: 'text', required: true },
    { key: 'type', labelKey: 'admin.field.type', type: 'select', options: opts(LocationType.options), required: true },
    { key: 'address.line1', labelKey: 'admin.field.city', type: 'text' },
    { key: 'address.city', labelKey: 'admin.field.city', type: 'text', required: true },
    { key: 'address.country', labelKey: 'admin.field.country', type: 'text', required: true },
    { key: 'timezone', labelKey: 'admin.field.timezone', type: 'text', required: true },
    { key: 'accessNotes', labelKey: 'admin.field.notes', type: 'text' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(LocationStatus.options) },
    { key: 'tags', labelKey: 'admin.field.tags', type: 'tags' },
  ],
  filters: [
    { key: 'status', labelKey: 'admin.field.status', options: opts(LocationStatus.options) },
    { key: 'type', labelKey: 'admin.field.type', options: opts(LocationType.options) },
  ],
  exportEntityType: 'locations',
  bulkDelete: true,
};

export const hardwareProfilesResource: ResourceDefinition = {
  key: 'hardware-profiles',
  titleKey: 'admin.nav.hardwareProfiles',
  resource: api.hardwareProfiles,
  permissions: { view: 'machines.view', edit: 'machines.edit' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name' },
    { key: 'storageMinGb', labelKey: 'admin.field.storageMinGb' },
    { key: 'paymentReader', labelKey: 'admin.field.type', render: (row) => (row['paymentReader'] ? '✓' : '—') },
    { key: 'version', labelKey: 'admin.field.version' },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'text', required: true },
    { key: 'description', labelKey: 'admin.field.description', type: 'text' },
    { key: 'storageMinGb', labelKey: 'admin.field.storageMinGb', type: 'number' },
    { key: 'paymentReader', labelKey: 'admin.field.type', type: 'switch' },
    { key: 'audio', labelKey: 'admin.field.type', type: 'switch' },
    { key: 'lighting', labelKey: 'admin.field.type', type: 'switch' },
    { key: 'version', labelKey: 'admin.field.version', type: 'number' },
    { key: 'camera', labelKey: 'admin.field.json', type: 'json', hintKey: 'admin.field.json' },
    { key: 'printers', labelKey: 'admin.field.json', type: 'json' },
    { key: 'paperSizes', labelKey: 'admin.field.json', type: 'json' },
    { key: 'display', labelKey: 'admin.field.json', type: 'json' },
    { key: 'peripherals', labelKey: 'admin.field.peripherals', type: 'tags' },
    { key: 'sensors', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'expectedCapabilities', labelKey: 'admin.field.tags', type: 'tags' },
  ],
  bulkDelete: true,
};

export const blueprintsResource: ResourceDefinition = {
  key: 'blueprints',
  titleKey: 'admin.nav.blueprints',
  resource: api.blueprints,
  permissions: { view: 'machines.view', edit: 'machines.edit' },
  columns: [
    { key: 'key', labelKey: 'admin.field.key' },
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'hardwareProfileId', labelKey: 'admin.field.hardwareProfileId' },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'key', labelKey: 'admin.field.key', type: 'text', required: true },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'description', labelKey: 'admin.field.description', type: 'localized' },
    { key: 'hardwareProfileId', labelKey: 'admin.field.hardwareProfileId', type: 'text', required: true },
    { key: 'productIds', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'configValues', labelKey: 'admin.field.json', type: 'json' },
    { key: 'featureModes', labelKey: 'admin.field.json', type: 'json' },
    { key: 'maintenanceChecklistId', labelKey: 'admin.field.key', type: 'text' },
    { key: 'baseCampaignIds', labelKey: 'admin.field.tags', type: 'tags' },
  ],
  bulkDelete: true,
};

export const NETWORK_RESOURCES: ResourceDefinition[] = [
  organizationsResource,
  franchisesResource,
  territoriesResource,
  regionsResource,
  locationsResource,
  hardwareProfilesResource,
  blueprintsResource,
];
