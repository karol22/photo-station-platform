/** Definiciones genéricas: oferta (productos, precios, promociones, presets, plantillas...). */
import { createElement as h } from 'react';
import { Badge } from '@psp/ui';
import {
  DocumentCategory,
  ExperienceTheme,
  PaperSize,
  ProductCategory,
  ProductKind,
  ProductStatus,
  PromotionType,
  ScopeLevel,
  TemplateKind,
} from '@psp/contracts';
import { api } from '../../api/resources';
import { statusTone } from '../../lib/badges';
import type { ResourceDefinition } from '../types';
import { humanize, localizedText, opts, str } from './helpers';

const SCOPE_FIELDS: ResourceDefinition['fields'] = [
  { key: 'scope.level', labelKey: 'admin.field.scopeLevel', type: 'select', options: opts(ScopeLevel.options), required: true },
  { key: 'scope.id', labelKey: 'admin.field.scopeId', type: 'text' },
];

export const productsResource: ResourceDefinition = {
  key: 'products',
  titleKey: 'admin.nav.products',
  resource: api.products,
  permissions: { view: 'products.manage', edit: 'products.manage' },
  columns: [
    { key: 'internalName', labelKey: 'admin.field.internalName' },
    { key: 'displayName', labelKey: 'admin.field.displayName', render: (row) => localizedText(row['displayName']) },
    { key: 'category', labelKey: 'admin.field.category', render: (row) => humanize(str(row['category'])) },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text', required: true },
    { key: 'internalName', labelKey: 'admin.field.internalName', type: 'text', required: true },
    { key: 'displayName', labelKey: 'admin.field.displayName', type: 'localized', required: true },
    { key: 'category', labelKey: 'admin.field.category', type: 'select', options: opts(ProductCategory.options), required: true },
    { key: 'kind', labelKey: 'admin.field.kind', type: 'select', options: opts(ProductKind.options), required: true },
    { key: 'description', labelKey: 'admin.field.description', type: 'localized' },
    { key: 'whatYouGet', labelKey: 'admin.field.description', type: 'localized' },
    { key: 'estimatedDurationSec', labelKey: 'admin.field.priority', type: 'number' },
    { key: 'captureCount', labelKey: 'admin.field.priority', type: 'number', required: true },
    { key: 'printCount', labelKey: 'admin.field.priority', type: 'number' },
    { key: 'output', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'basePrice', labelKey: 'admin.field.basePrice', type: 'money', required: true },
    { key: 'editing', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'retakes', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'hardwareRequirements', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'requiredFeatures', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(ProductStatus.options) },
    { key: 'priority', labelKey: 'admin.field.priority', type: 'number' },
    { key: 'tags', labelKey: 'admin.field.tags', type: 'tags' },
  ],
  filters: [
    { key: 'category', labelKey: 'admin.field.category', options: opts(ProductCategory.options) },
    { key: 'status', labelKey: 'admin.field.status', options: opts(ProductStatus.options) },
  ],
  exportEntityType: 'products',
  bulkDelete: true,
};

export const productAvailabilitiesResource: ResourceDefinition = {
  key: 'product-availabilities',
  titleKey: 'admin.nav.products',
  resource: api.productAvailabilities,
  permissions: { view: 'products.manage', edit: 'products.manage' },
  columns: [
    { key: 'productId', labelKey: 'admin.field.productId' },
    { key: 'scope', labelKey: 'admin.field.scopeLevel', render: (row) => str((row['scope'] as Record<string, unknown> | undefined)?.['level']) },
    { key: 'enabled', labelKey: 'admin.field.enabled', render: (row) => (row['enabled'] ? '✓' : '—') },
  ],
  fields: [
    { key: 'productId', labelKey: 'admin.field.productId', type: 'text', required: true },
    ...SCOPE_FIELDS,
    { key: 'enabled', labelKey: 'admin.field.enabled', type: 'switch' },
    { key: 'priorityOverride', labelKey: 'admin.field.priority', type: 'number' },
    { key: 'temporaryUntil', labelKey: 'admin.field.endDate', type: 'text' },
  ],
  bulkDelete: true,
};

export const priceRulesResource: ResourceDefinition = {
  key: 'price-rules',
  titleKey: 'admin.nav.prices',
  resource: api.priceRules,
  permissions: { view: 'pricing.edit', edit: 'pricing.edit' },
  columns: [
    { key: 'productId', labelKey: 'admin.field.productId' },
    { key: 'scope', labelKey: 'admin.field.scopeLevel', render: (row) => str((row['scope'] as Record<string, unknown> | undefined)?.['level']) },
    { key: 'price', labelKey: 'admin.field.price', render: (row) => { const p = row['price'] as Record<string, unknown> | undefined; return p ? `${(Number(p['amount']) / 100).toFixed(2)} ${str(p['currency'])}` : '—'; } },
    { key: 'priority', labelKey: 'admin.field.priority' },
  ],
  fields: [
    { key: 'productId', labelKey: 'admin.field.productId', type: 'text', required: true },
    ...SCOPE_FIELDS,
    { key: 'price', labelKey: 'admin.field.price', type: 'money', required: true },
    { key: 'priority', labelKey: 'admin.field.priority', type: 'number' },
    { key: 'schedule', labelKey: 'admin.field.json', type: 'json' },
    { key: 'lock', labelKey: 'admin.field.json', type: 'json' },
  ],
  bulkDelete: true,
};

export const promotionsResource: ResourceDefinition = {
  key: 'promotions',
  titleKey: 'admin.nav.promotions',
  resource: api.promotions,
  permissions: { view: 'pricing.edit', edit: 'pricing.edit' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'type', labelKey: 'admin.field.type', render: (row) => humanize(str(row['type'])) },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text', required: true },
    { key: 'franchiseId', labelKey: 'admin.field.franchiseId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'type', labelKey: 'admin.field.type', type: 'select', options: opts(PromotionType.options), required: true },
    { key: 'value', labelKey: 'admin.field.value', type: 'number' },
    { key: 'promoPrice', labelKey: 'admin.field.price', type: 'money' },
    { key: 'productIds', labelKey: 'admin.field.tags', type: 'tags' },
    ...SCOPE_FIELDS,
    { key: 'code', labelKey: 'admin.field.code', type: 'text' },
    { key: 'priority', labelKey: 'admin.field.priority', type: 'number' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(['draft', 'active', 'inactive']) },
  ],
  filters: [{ key: 'status', labelKey: 'admin.field.status', options: opts(['draft', 'active', 'inactive']) }],
  bulkDelete: true,
};

export const presetsResource: ResourceDefinition = {
  key: 'presets',
  titleKey: 'admin.nav.presets',
  resource: api.presets,
  permissions: { view: 'presets.manage', edit: 'presets.manage' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'category', labelKey: 'admin.field.category', render: (row) => humanize(str(row['category'])) },
    { key: 'country', labelKey: 'admin.field.country' },
    { key: 'currentVersion', labelKey: 'admin.presets.currentVersion' },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
    {
      key: 'id',
      labelKey: 'admin.presets.versions',
      render: (row) =>
        h(
          'a',
          { href: `/presets/${String(row['id'])}`, onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() },
          str(row['id']),
        ),
    },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'institution', labelKey: 'admin.field.institution', type: 'text' },
    { key: 'country', labelKey: 'admin.field.country', type: 'text', required: true },
    { key: 'region', labelKey: 'admin.field.state', type: 'text' },
    { key: 'category', labelKey: 'admin.field.category', type: 'select', options: opts(DocumentCategory.options), required: true },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(['active', 'deprecated', 'draft']) },
    { key: 'tags', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'searchTerms', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'acceptanceDisclaimer', labelKey: 'admin.field.description', type: 'localized' },
  ],
  filters: [{ key: 'category', labelKey: 'admin.field.category', options: opts(DocumentCategory.options) }],
  bulkDelete: true,
};

export const templatesResource: ResourceDefinition = {
  key: 'templates',
  titleKey: 'admin.nav.templates',
  resource: api.templates,
  permissions: { view: 'templates.manage', edit: 'templates.manage' },
  columns: [
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'kind', labelKey: 'admin.field.kind', render: (row) => humanize(str(row['kind'])) },
    { key: 'paperSize', labelKey: 'admin.field.type' },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
    { key: 'version', labelKey: 'admin.field.version' },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'kind', labelKey: 'admin.field.kind', type: 'select', options: opts(TemplateKind.options), required: true },
    { key: 'paperSize', labelKey: 'admin.field.type', type: 'select', options: opts(PaperSize.options), required: true },
    { key: 'orientation', labelKey: 'admin.field.type', type: 'select', options: opts(['portrait', 'landscape']), required: true },
    { key: 'photoSlots', labelKey: 'admin.field.priority', type: 'number', required: true },
    { key: 'canvas', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'elements', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'variants', labelKey: 'admin.field.json', type: 'json' },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(['draft', 'published', 'archived']) },
    { key: 'tags', labelKey: 'admin.field.tags', type: 'tags' },
  ],
  filters: [{ key: 'kind', labelKey: 'admin.field.kind', options: opts(TemplateKind.options) }],
  bulkDelete: true,
};

export const experiencesResource: ResourceDefinition = {
  key: 'experiences',
  titleKey: 'admin.nav.experiences',
  resource: api.experiences,
  permissions: { view: 'templates.manage', edit: 'templates.manage' },
  columns: [
    { key: 'key', labelKey: 'admin.field.key' },
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'theme', labelKey: 'admin.field.type', render: (row) => humanize(str(row['theme'])) },
    { key: 'status', labelKey: 'admin.field.status', render: (row) => h(Badge, { tone: statusTone(str(row['status'])), children: str(row['status']) }) },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'key', labelKey: 'admin.field.key', type: 'text', required: true },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'theme', labelKey: 'admin.field.type', type: 'select', options: opts(ExperienceTheme.options), required: true },
    { key: 'description', labelKey: 'admin.field.description', type: 'localized', required: true },
    { key: 'guidanceEnabled', labelKey: 'admin.field.enabled', type: 'switch' },
    { key: 'poses', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'selection', labelKey: 'admin.field.json', type: 'json', required: true },
    { key: 'templateId', labelKey: 'admin.field.templateId', type: 'text', required: true },
    { key: 'status', labelKey: 'admin.field.status', type: 'select', options: opts(['draft', 'active', 'inactive']) },
  ],
  bulkDelete: true,
};

export const editingPresetsResource: ResourceDefinition = {
  key: 'editing-presets',
  titleKey: 'admin.nav.presets',
  resource: api.editingPresets,
  permissions: { view: 'presets.manage', edit: 'presets.manage' },
  columns: [
    { key: 'key', labelKey: 'admin.field.key' },
    { key: 'name', labelKey: 'admin.field.name', render: (row) => localizedText(row['name']) },
    { key: 'documentSafe', labelKey: 'admin.field.type', render: (row) => (row['documentSafe'] ? '✓' : '—') },
  ],
  fields: [
    { key: 'organizationId', labelKey: 'admin.field.organizationId', type: 'text' },
    { key: 'key', labelKey: 'admin.field.key', type: 'text', required: true },
    { key: 'name', labelKey: 'admin.field.name', type: 'localized', required: true },
    { key: 'documentSafe', labelKey: 'admin.field.type', type: 'switch' },
    { key: 'tags', labelKey: 'admin.field.tags', type: 'tags' },
    { key: 'ops', labelKey: 'admin.field.json', type: 'json', required: true },
  ],
  bulkDelete: true,
};

export const OFFER_RESOURCES: ResourceDefinition[] = [
  productsResource,
  productAvailabilitiesResource,
  priceRulesResource,
  promotionsResource,
  presetsResource,
  templatesResource,
  experiencesResource,
  editingPresetsResource,
];
