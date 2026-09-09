/**
 * Clientes CRUD por recurso. Cada uno valida la lista paginada y la entidad con su esquema.
 */
import { z } from 'zod';
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
  SessionRecord,
  SupportAccess,
  Territory,
  User,
  paginated,
} from '@psp/contracts';
import { Unknown, request, type RequestOptions } from './client';
import { adminQueryToSearchParams, type ListQueryInput } from '../lib/listQuery';

export interface ListResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ResourceClient<T> {
  readonly path: string;
  readonly schema: z.ZodType<T>;
  list(query?: ListQueryInput, options?: RequestOptions): Promise<ListResult<T>>;
  /** Recorre páginas hasta `max` elementos (para selectores e índices). */
  listAll(query?: ListQueryInput, max?: number, options?: RequestOptions): Promise<T[]>;
  get(id: string, options?: RequestOptions): Promise<T>;
  create(body: Record<string, unknown>, options?: RequestOptions): Promise<T>;
  update(id: string, body: Record<string, unknown>, options?: RequestOptions): Promise<T>;
  remove(id: string, options?: RequestOptions): Promise<void>;
}

export function resourceClient<T>(path: string, schema: z.ZodType<T>): ResourceClient<T> {
  const listSchema = paginated(schema as z.ZodTypeAny) as unknown as z.ZodType<ListResult<T>>;
  const client: ResourceClient<T> = {
    path,
    schema,
    async list(query = {}, options) {
      const params = adminQueryToSearchParams(query);
      const qs = params.toString();
      return request(listSchema, 'GET', `/${path}${qs ? `?${qs}` : ''}`, undefined, options);
    },
    async listAll(query = {}, max = 2000, options) {
      const pageSize = 500;
      const out: T[] = [];
      let page = 1;
      for (;;) {
        const result = await client.list({ ...query, page, pageSize }, options);
        out.push(...result.items);
        if (out.length >= result.total || result.items.length === 0 || out.length >= max) break;
        page += 1;
      }
      return out.slice(0, max);
    },
    get(id, options) {
      return request(schema, 'GET', `/${path}/${encodeURIComponent(id)}`, undefined, options);
    },
    create(body, options) {
      return request(schema, 'POST', `/${path}`, body, options);
    },
    update(id, body, options) {
      return request(schema, 'PATCH', `/${path}/${encodeURIComponent(id)}`, body, options);
    },
    async remove(id, options) {
      await request(Unknown, 'DELETE', `/${path}/${encodeURIComponent(id)}`, undefined, options);
    },
  };
  return client;
}

export const api = {
  organizations: resourceClient('organizations', Organization),
  franchises: resourceClient('franchises', Franchise),
  territories: resourceClient('territories', Territory),
  regions: resourceClient('regions', Region),
  locations: resourceClient('locations', Location),
  machines: resourceClient('machines', Machine),
  hardwareProfiles: resourceClient('hardware-profiles', HardwareProfile),
  blueprints: resourceClient('blueprints', Blueprint),
  users: resourceClient('users', User),
  roleAssignments: resourceClient('role-assignments', RoleAssignment),
  supportAccesses: resourceClient('support-accesses', SupportAccess),
  products: resourceClient('products', Product),
  productAvailabilities: resourceClient('product-availabilities', ProductAvailability),
  priceRules: resourceClient('price-rules', PriceRule),
  promotions: resourceClient('promotions', Promotion),
  presets: resourceClient('presets', DocumentPreset),
  templates: resourceClient('templates', PrintTemplate),
  experiences: resourceClient('experiences', Experience),
  editingPresets: resourceClient('editing-presets', EditingPreset),
  campaigns: resourceClient('campaigns', Campaign),
  assets: resourceClient('assets', Asset),
  retentionPolicies: resourceClient('retention-policies', RetentionPolicy),
  maintenanceChecklists: resourceClient('maintenance-checklists', MaintenanceChecklist),
  featureOverrides: resourceClient('feature-overrides', FeatureOverride),
  entitlementPlans: resourceClient('entitlement-plans', EntitlementPlan),
  entitlements: resourceClient('entitlements', Entitlement),
  releases: resourceClient('releases', Release),
  rollouts: resourceClient('rollouts', Rollout),
  sessions: resourceClient('sessions', SessionRecord),
  incidents: resourceClient('incidents', Incident),
  maintenanceLogs: resourceClient('maintenance-logs', MaintenanceLog),
  consumables: resourceClient('consumables', Consumable),
  announcements: resourceClient('announcements', Announcement),
  internalDocuments: resourceClient('internal-documents', InternalDocument),
  savedViews: resourceClient('saved-views', SavedView),
} as const;

export type ResourceKey = keyof typeof api;
