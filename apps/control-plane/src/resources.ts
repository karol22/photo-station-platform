/**
 * Tabla de recursos administrativos: recurso HTTP → tipo de entidad → esquema zod → permisos →
 * nivel de alcance. Todo CRUD genérico de `/admin/v1` sale de aquí; lo que no está en la tabla
 * no existe como recurso.
 */
import type { z } from 'zod';
import {
  Announcement,
  Asset,
  Blueprint,
  Campaign,
  Consumable,
  DocumentPreset,
  EditingPreset,
  Entitlement,
  EntitlementPlan,
  Experience,
  FeatureOverride,
  Franchise,
  HardwareProfile,
  Incident,
  InternalDocument,
  Location,
  Machine,
  MaintenanceChecklist,
  MaintenanceLog,
  Organization,
  PriceRule,
  PrintTemplate,
  Product,
  ProductAvailability,
  Promotion,
  Region,
  Release,
  RetentionPolicy,
  RoleAssignment,
  Rollout,
  SavedView,
  SupportAccess,
  Territory,
  User,
  type PermissionKey,
  type ScopeLevel,
} from '@psp/contracts';
import type { EntityType } from './store';

export interface ResourceDef {
  /** Nombre en la ruta (`/admin/v1/<resource>`). */
  resource: string;
  type: EntityType;
  schema: z.ZodTypeAny;
  view: PermissionKey;
  write: PermissionKey;
  /** Nivel de alcance con el que se filtra el listado (para entidades de jerarquía, el propio). */
  level: ScopeLevel | 'auto';
  idPrefix: string;
  /** Campos donde busca `q`. */
  searchFields: string[];
}

const r = (
  resource: string,
  type: EntityType,
  schema: z.ZodTypeAny,
  view: PermissionKey,
  write: PermissionKey,
  level: ScopeLevel | 'auto',
  idPrefix: string,
  searchFields: string[] = ['name', 'internalName', 'code', 'email', 'title'],
): ResourceDef => ({ resource, type, schema, view, write, level, idPrefix, searchFields });

export const RESOURCES: ResourceDef[] = [
  r('organizations', 'organizations', Organization, 'organizations.view', 'organizations.edit', 'organization', 'org'),
  r('franchises', 'franchises', Franchise, 'franchises.view', 'franchises.edit', 'franchise', 'fr'),
  r('territories', 'territories', Territory, 'franchises.view', 'franchises.edit', 'auto', 'ter', ['city', 'state', 'country']),
  r('regions', 'regions', Region, 'locations.view', 'locations.edit', 'region', 'reg'),
  r('locations', 'locations', Location, 'locations.view', 'locations.edit', 'location', 'loc', ['internalName', 'publicName']),
  r('machines', 'machines', Machine, 'machines.view', 'machines.edit', 'machine', 'mch'),
  r('hardware-profiles', 'hardwareProfiles', HardwareProfile, 'machines.view', 'machines.edit', 'auto', 'hwp'),
  r('blueprints', 'blueprints', Blueprint, 'machines.view', 'machines.edit', 'auto', 'bpt', ['key']),
  r('users', 'users', User, 'users.manage', 'users.manage', 'auto', 'usr'),
  r('role-assignments', 'roleAssignments', RoleAssignment, 'users.manage', 'permissions.edit', 'auto', 'ras'),
  r('support-accesses', 'supportAccesses', SupportAccess, 'support.grant', 'support.grant', 'auto', 'sup'),
  r('products', 'products', Product, 'organizations.view', 'products.manage', 'auto', 'prd', ['internalName']),
  r('product-availabilities', 'productAvailabilities', ProductAvailability, 'organizations.view', 'products.manage', 'auto', 'pav'),
  r('price-rules', 'priceRules', PriceRule, 'pricing.edit', 'pricing.edit', 'auto', 'prc'),
  r('promotions', 'promotions', Promotion, 'organizations.view', 'pricing.edit', 'auto', 'prm'),
  r('presets', 'presets', DocumentPreset, 'organizations.view', 'presets.manage', 'auto', 'pst', ['institution', 'country']),
  r('templates', 'templates', PrintTemplate, 'organizations.view', 'templates.manage', 'auto', 'tpl'),
  r('experiences', 'experiences', Experience, 'organizations.view', 'templates.manage', 'auto', 'exp', ['key']),
  r('editing-presets', 'editingPresets', EditingPreset, 'organizations.view', 'templates.manage', 'auto', 'edp', ['key']),
  r('campaigns', 'campaigns', Campaign, 'organizations.view', 'campaigns.publish', 'auto', 'cmp'),
  r('assets', 'assets', Asset, 'organizations.view', 'assets.manage', 'auto', 'ast'),
  r('retention-policies', 'retentionPolicies', RetentionPolicy, 'organizations.view', 'privacy.edit', 'auto', 'ret'),
  r('maintenance-checklists', 'maintenanceChecklists', MaintenanceChecklist, 'machines.maintenance', 'machines.maintenance', 'auto', 'mcl'),
  r('feature-overrides', 'featureOverrides', FeatureOverride, 'features.manage', 'features.manage', 'auto', 'fov', ['key']),
  r('entitlement-plans', 'entitlementPlans', EntitlementPlan, 'organizations.view', 'features.manage', 'auto', 'pln', ['key']),
  r('entitlements', 'entitlements', Entitlement, 'organizations.view', 'features.manage', 'auto', 'ent'),
  r('releases', 'releases', Release, 'releases.manage', 'releases.manage', 'auto', 'rel', ['version']),
  r('rollouts', 'rollouts', Rollout, 'releases.manage', 'releases.manage', 'auto', 'rlt'),
  r('incidents', 'incidents', Incident, 'incidents.manage', 'incidents.manage', 'auto', 'inc', ['code', 'title']),
  r('maintenance-logs', 'maintenanceLogs', MaintenanceLog, 'machines.maintenance', 'maintenance.log', 'auto', 'mlg', ['notes']),
  r('consumables', 'consumables', Consumable, 'machines.view', 'machines.maintenance', 'auto', 'csm', ['type']),
  r('announcements', 'announcements', Announcement, 'organizations.view', 'announcements.publish', 'auto', 'ann'),
  r('internal-documents', 'internalDocuments', InternalDocument, 'docs.manage', 'docs.manage', 'auto', 'doc'),
  r('saved-views', 'savedViews', SavedView, 'metrics.view', 'metrics.view', 'auto', 'svw', ['name', 'route']),
];

export const RESOURCE_BY_NAME: Record<string, ResourceDef> = Object.fromEntries(RESOURCES.map((d) => [d.resource, d]));
export const RESOURCE_BY_TYPE: Partial<Record<EntityType, ResourceDef>> = Object.fromEntries(RESOURCES.map((d) => [d.type, d]));
