/**
 * Materialización del ConfigBundle de una máquina.
 *
 * Función pura: misma fuente + mismo `now` → mismo bundle → misma `version`. Nada aquí lee el
 * reloj ni el disco; el control-plane inyecta `now` y la fuente completa.
 */
import type {
  Asset,
  AssetManifestEntry,
  Blueprint,
  Campaign,
  ConfigBundle,
  ConfigLayer,
  DocumentPreset,
  DocumentPresetVersion,
  EditingPreset,
  Entitlement,
  EntitlementPlan,
  Experience,
  FeatureOverride,
  Franchise,
  HardwareProfile,
  Id,
  JsonValue,
  Location,
  Machine,
  MaintenanceChecklist,
  Organization,
  PriceRule,
  PrintTemplate,
  Product,
  ProductAvailability,
  Promotion,
  Region,
  ResolvedPrice,
  RetentionPolicy,
  Scope,
} from '@psp/contracts';
import { CONFIG_KEYS } from '@psp/contracts';
import {
  buildHierarchyIndex,
  resolveFeatures,
  resolvePrice,
  scopeChain,
  scopeContains,
  stableHash,
  windowMatches,
  type HierarchyIndex,
} from '@psp/domain';
import { buildBundle, resolveEffectiveConfig } from '@psp/config-engine';
import { collectReferencedAssetIds } from './assets';

/** Subconjunto del dataset demo con todo lo que necesita un bundle. */
export interface BundleSource {
  organizations: Organization[];
  franchises: Franchise[];
  regions: Region[];
  locations: Location[];
  machines: Machine[];
  hardwareProfiles: HardwareProfile[];
  blueprints: Blueprint[];
  products: Product[];
  productAvailabilities: ProductAvailability[];
  priceRules: PriceRule[];
  promotions: Promotion[];
  presets: DocumentPreset[];
  presetVersions: DocumentPresetVersion[];
  templates: PrintTemplate[];
  experiences: Experience[];
  editingPresets: EditingPreset[];
  campaigns: Campaign[];
  assets: Asset[];
  retentionPolicies: RetentionPolicy[];
  maintenanceChecklists: MaintenanceChecklist[];
  configLayers: ConfigLayer[];
  featureOverrides: FeatureOverride[];
  entitlementPlans: EntitlementPlan[];
  entitlements: Entitlement[];
}

export interface MaterializeOptions {
  /** Instante de materialización: decide campañas vigentes, precios y features. */
  now: Date;
  /** Base de las URLs del manifiesto de activos: `assetUrlBase + '/' + hash`. */
  assetUrlBase: string;
  /** Revisión del catálogo; por defecto un hash de ids y fechas del catálogo de la organización. */
  catalogRevision?: string;
  /** Marca de tiempo del bundle; por defecto `now`. No participa en la versión. */
  generatedAt?: string;
}

export type BundlerErrorCode =
  | 'machine_not_found'
  | 'organization_not_found'
  | 'hardware_profile_not_found';

export class BundlerError extends Error {
  constructor(
    readonly code: BundlerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BundlerError';
  }
}

/** Resultado intermedio útil para previsualizaciones y pruebas. */
export interface MaterializationContext {
  index: HierarchyIndex;
  chain: Scope[];
  timezone: string;
  applicableCampaigns: Campaign[];
  activeCampaigns: Campaign[];
}

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function sameScope(a: Scope, b: Scope): boolean {
  if (a.level !== b.level) return false;
  return a.level === 'platform' || a.id === b.id;
}

/** Copia sin claves `undefined` para que el hash del bundle no dependa de claves ausentes vs. vacías. */
function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) out[key] = value;
  }
  return out as Pick<T, K>;
}

/** Valores de blueprint (`unknown`) → JSON puro; lo no serializable se descarta. */
function toJsonRecord(values: Record<string, unknown>): Record<string, JsonValue> {
  const serialized = JSON.parse(JSON.stringify(values)) as Record<string, JsonValue> | null;
  return serialized ?? {};
}

/** Capa que materializa el overlay de una campaña; id determinista derivado de la campaña. */
export function campaignLayer(campaign: Campaign): ConfigLayer {
  return {
    id: `cfg_campaign_${campaign.id}`,
    level: 'campaign',
    entityId: campaign.id,
    values: campaign.configOverlay.values,
    locks: campaign.configOverlay.locks.map((lock) => ({ ...lock, setBy: 'campaign', setById: campaign.id })),
    version: 1,
    updatedAt: campaign.updatedAt ?? campaign.createdAt,
  };
}

/** Capa de blueprint: la declarada en `configLayers` si existe; si no, la sintetizada de `configValues`. */
export function blueprintLayer(blueprint: Blueprint, layers: ConfigLayer[]): ConfigLayer {
  const declared = layers
    .filter((layer) => layer.level === 'blueprint' && layer.entityId === blueprint.id)
    .sort((a, b) => a.version - b.version || byId(a, b))
    .at(-1);
  if (declared) return declared;
  return {
    id: `cfg_blueprint_${blueprint.id}`,
    level: 'blueprint',
    entityId: blueprint.id,
    values: toJsonRecord(blueprint.configValues),
    locks: [],
    version: 1,
    updatedAt: blueprint.updatedAt ?? blueprint.createdAt,
  };
}

/** Capas de la cadena de alcance en orden (platform → machine); a igual nivel, mayor versión al final. */
export function chainLayers(layers: ConfigLayer[], chain: Scope[]): ConfigLayer[] {
  const out: ConfigLayer[] = [];
  for (const scope of chain) {
    const matching = layers
      .filter((layer) => {
        if (layer.level !== scope.level) return false;
        return scope.level === 'platform' ? layer.entityId === undefined : layer.entityId === scope.id;
      })
      .sort((a, b) => a.version - b.version || byId(a, b));
    out.push(...matching);
  }
  return out;
}

/** ¿La campaña está vigente en `now`? Estado `active` o `scheduled` dentro de su ventana. */
export function isCampaignActiveAt(campaign: Campaign, now: Date): boolean {
  if (campaign.status !== 'active' && campaign.status !== 'scheduled') return false;
  return windowMatches({ start: campaign.startsAt, end: campaign.endsAt }, now);
}

/**
 * Campañas que aplican a la máquina: de su organización, activas o programadas, de su franquicia si
 * son locales, y cuyo objetivo contiene algún alcance de la cadena o comparte etiquetas con la
 * máquina o su ubicación. Orden: prioridad ascendente, después id.
 */
export function applicableCampaigns(
  campaigns: Campaign[],
  index: HierarchyIndex,
  machine: Machine,
  location: Location | undefined,
  chain: Scope[],
): Campaign[] {
  const machineScope: Scope = { level: 'machine', id: machine.id };
  const tags = new Set([...machine.tags, ...(location?.tags ?? [])]);
  const franchiseIds = new Set(chain.filter((s) => s.level === 'franchise').map((s) => s.id));
  return campaigns
    .filter((campaign) => {
      if (campaign.organizationId !== machine.organizationId) return false;
      if (campaign.status !== 'active' && campaign.status !== 'scheduled') return false;
      if (campaign.franchiseId !== undefined && !franchiseIds.has(campaign.franchiseId)) return false;
      const byScope = campaign.targets.scopes.some((target) => scopeContains(index, target, machineScope));
      const byTag = campaign.targets.tags.some((tag) => tags.has(tag));
      return byScope || byTag;
    })
    .sort((a, b) => a.priority - b.priority || byId(a, b));
}

/** Disponibilidad declarada más específica de la cadena (vigente); empate: la más reciente. */
function effectiveAvailability(
  availabilities: ProductAvailability[],
  productId: Id,
  chain: Scope[],
  now: Date,
): ProductAvailability | undefined {
  let best: ProductAvailability | undefined;
  let bestDepth = -1;
  for (const availability of availabilities) {
    if (availability.productId !== productId) continue;
    if (availability.temporaryUntil !== undefined) {
      const until = Date.parse(availability.temporaryUntil);
      if (Number.isNaN(until) || until <= now.getTime()) continue;
    }
    const depth = chain.findIndex((scope) => sameScope(scope, availability.scope));
    if (depth < 0) continue;
    if (depth > bestDepth || (depth === bestDepth && best !== undefined && availability.updatedAt > best.updatedAt)) {
      best = availability;
      bestDepth = depth;
    }
  }
  return best;
}

/** Productos activos de la organización no desactivados en la cadena, ordenados por prioridad. */
export function selectProducts(source: BundleSource, organizationId: Id, chain: Scope[], now: Date): Product[] {
  const ranked: Array<{ product: Product; priority: number }> = [];
  for (const product of source.products) {
    if (product.organizationId !== organizationId || product.status !== 'active') continue;
    const availability = effectiveAvailability(source.productAvailabilities, product.id, chain, now);
    if (availability !== undefined && !availability.enabled) continue;
    ranked.push({ product, priority: availability?.priorityOverride ?? product.priority });
  }
  return ranked
    .sort((a, b) => a.priority - b.priority || byId(a.product, b.product))
    .map((entry) => entry.product);
}

function belongsTo(entity: { organizationId?: Id }, organizationId: Id): boolean {
  return entity.organizationId === undefined || entity.organizationId === organizationId;
}

function catalogRevisionOf(source: BundleSource, organizationId: Id): string {
  const stamp = (items: Array<{ id: string; updatedAt?: string; createdAt?: string; organizationId?: Id }>) =>
    items
      .filter((item) => belongsTo(item, organizationId))
      .map((item) => [item.id, item.updatedAt ?? item.createdAt ?? ''])
      .sort((a, b) => ((a[0] ?? '') < (b[0] ?? '') ? -1 : 1));
  return stableHash({
    products: stamp(source.products),
    priceRules: source.priceRules.map((rule) => [rule.id, rule.updatedAt]).sort(),
    promotions: stamp(source.promotions),
    presets: stamp(source.presets),
    presetVersions: source.presetVersions.map((version) => [version.presetId, version.version]).sort(),
    templates: stamp(source.templates),
    experiences: stamp(source.experiences),
    editingPresets: stamp(source.editingPresets),
    campaigns: stamp(source.campaigns),
  }).slice(0, 16);
}

/** Contexto de materialización (cadena, zona horaria, campañas) sin construir el bundle completo. */
export function materializationContext(source: BundleSource, machineId: Id, now: Date): MaterializationContext {
  const index = buildHierarchyIndex(source);
  const machine = index.machines.get(machineId);
  if (!machine) throw new BundlerError('machine_not_found', `machine not found: ${machineId}`);
  const organization = index.organizations.get(machine.organizationId);
  if (!organization) throw new BundlerError('organization_not_found', `organization not found: ${machine.organizationId}`);
  const location = machine.locationId === undefined ? undefined : index.locations.get(machine.locationId);
  const chain = scopeChain(index, { level: 'machine', id: machine.id });
  const timezone = machine.timezone ?? location?.timezone ?? organization.timezone;
  const applicable = applicableCampaigns(source.campaigns, index, machine, location, chain);
  return {
    index,
    chain,
    timezone,
    applicableCampaigns: applicable,
    activeCampaigns: applicable.filter((campaign) => isCampaignActiveAt(campaign, now)),
  };
}

/**
 * Materializa el bundle de `machineId`.
 *
 * Pasos: cadena de alcance → capas (platform, organización, blueprint, franquicia, región,
 * ubicación, máquina) → campañas aplicables (todas van al bundle; sólo las vigentes en `now`
 * entran al overlay de configuración y a los precios) → configuración efectiva → features →
 * productos filtrados por disponibilidad → precios → presets (versión actual), plantillas,
 * experiencias y presets de edición referenciados → manifiesto de activos → `buildBundle`.
 */
export function materializeBundle(source: BundleSource, machineId: Id, opts: MaterializeOptions): ConfigBundle {
  const { now } = opts;
  const { index, chain, timezone, applicableCampaigns: applicable, activeCampaigns } = materializationContext(
    source,
    machineId,
    now,
  );
  const machine = index.machines.get(machineId) as Machine;
  const organization = index.organizations.get(machine.organizationId) as Organization;
  const location = machine.locationId === undefined ? undefined : index.locations.get(machine.locationId);
  const hardwareProfile = source.hardwareProfiles.find((profile) => profile.id === machine.hardwareProfileId);
  if (!hardwareProfile) {
    throw new BundlerError('hardware_profile_not_found', `hardware profile not found: ${machine.hardwareProfileId}`);
  }

  /* ---------- configuración efectiva ---------- */
  const layers = chainLayers(source.configLayers, chain);
  const blueprint = machine.blueprintId === undefined ? undefined : source.blueprints.find((b) => b.id === machine.blueprintId);
  const blueprintCfg = blueprint === undefined ? undefined : blueprintLayer(blueprint, source.configLayers);
  const overlays = activeCampaigns.map((campaign) => ({ campaign, layer: campaignLayer(campaign) }));
  const effective = resolveEffectiveConfig({
    layers,
    ...(blueprintCfg !== undefined ? { blueprint: blueprintCfg } : {}),
    campaigns: overlays,
    definitions: CONFIG_KEYS,
    now,
    timezone,
  });

  /* ---------- features ---------- */
  const features = resolveFeatures({
    chain,
    overrides: source.featureOverrides,
    entitlements: source.entitlements,
    plans: source.entitlementPlans,
    machine,
    now,
  });

  /* ---------- catálogo y precios ---------- */
  const products = selectProducts(source, organization.id, chain, now);
  const machineScope: Scope = { level: 'machine', id: machine.id };
  const franchiseIds = new Set(chain.filter((s) => s.level === 'franchise').map((s) => s.id));
  const promotions = source.promotions
    .filter((promotion) => {
      if (promotion.organizationId !== organization.id || promotion.status !== 'active') return false;
      if (promotion.franchiseId !== undefined && !franchiseIds.has(promotion.franchiseId)) return false;
      if (!scopeContains(index, promotion.scope, machineScope)) return false;
      if (promotion.window !== undefined) {
        const end = Date.parse(promotion.window.end);
        if (Number.isNaN(end) || end <= now.getTime()) return false;
      }
      return true;
    })
    .sort((a, b) => a.priority - b.priority || byId(a, b));
  const businessModeValue = effective.values['payment.businessMode'];
  const businessMode = typeof businessModeValue === 'string' ? businessModeValue : 'paid';
  const prices: ResolvedPrice[] = products.map((product) =>
    resolvePrice({
      product,
      rules: source.priceRules.filter((rule) => rule.productId === product.id),
      promotions,
      campaigns: activeCampaigns,
      chain,
      now,
      timezone,
      businessMode,
    }),
  );

  /* ---------- presets, plantillas, experiencias ---------- */
  const presetIds = new Set(products.map((p) => p.presetId).filter((id): id is Id => id !== undefined));
  const presets = source.presets
    .filter((preset) => presetIds.has(preset.id) && belongsTo(preset, organization.id))
    .sort(byId);
  const presetVersions: DocumentPresetVersion[] = [];
  for (const preset of presets) {
    const versions = source.presetVersions.filter((version) => version.presetId === preset.id);
    const current = versions.find((version) => version.version === preset.currentVersion) ??
      versions.sort((a, b) => a.version - b.version).at(-1);
    if (current) presetVersions.push(current);
  }

  const experienceIds = new Set<Id>();
  for (const product of products) if (product.experienceId !== undefined) experienceIds.add(product.experienceId);
  for (const campaign of applicable) if (campaign.experienceId !== undefined) experienceIds.add(campaign.experienceId);
  const experiences = source.experiences
    .filter((experience) => experienceIds.has(experience.id) && belongsTo(experience, organization.id))
    .sort(byId);

  const templateIds = new Set<Id>();
  for (const product of products) templateIds.add(product.output.templateId);
  for (const version of presetVersions) templateIds.add(version.spec.sheetTemplateId);
  for (const experience of experiences) templateIds.add(experience.templateId);
  for (const campaign of applicable) for (const id of campaign.templateIds) templateIds.add(id);
  const templates = source.templates
    .filter((template) => templateIds.has(template.id) && belongsTo(template, organization.id))
    .sort(byId);

  const editingPresetIds = new Set<Id>();
  for (const product of products) for (const id of product.editing.allowedPresetIds) editingPresetIds.add(id);
  for (const experience of experiences) for (const id of experience.editingPresetIds) editingPresetIds.add(id);
  const editingPresets = source.editingPresets
    .filter((preset) => editingPresetIds.has(preset.id) && belongsTo(preset, organization.id))
    .sort(byId);

  const retentionPolicies = source.retentionPolicies.filter((policy) => belongsTo(policy, organization.id)).sort(byId);
  const maintenanceChecklists = source.maintenanceChecklists
    .filter(
      (checklist) =>
        belongsTo(checklist, organization.id) &&
        (checklist.hardwareProfileId === undefined || checklist.hardwareProfileId === hardwareProfile.id),
    )
    .sort(byId);

  /* ---------- activos ---------- */
  const referenced = collectReferencedAssetIds({
    effectiveValues: effective.values,
    products,
    templates,
    experiences,
    campaigns: applicable,
  });
  const assetsById = new Map(source.assets.map((asset) => [asset.id, asset]));
  const assets: AssetManifestEntry[] = [];
  for (const assetId of [...referenced].sort()) {
    const asset = assetsById.get(assetId);
    if (!asset) continue;
    assets.push({ assetId: asset.id, hash: asset.hash, mime: asset.mime, bytes: asset.bytes, url: `${opts.assetUrlBase}/${asset.hash}` });
  }

  /* ---------- bundle ---------- */
  const layerIds = [...layers.map((layer) => layer.id), ...(blueprintCfg ? [blueprintCfg.id] : [])];
  return buildBundle({
    machineId: machine.id,
    organizationId: organization.id,
    generatedAt: opts.generatedAt ?? now.toISOString(),
    basedOn: {
      layerIds,
      campaignIds: applicable.map((campaign) => campaign.id),
      catalogRevision: opts.catalogRevision ?? catalogRevisionOf(source, organization.id),
    },
    organization: pick(organization, ['id', 'name', 'slug', 'currency', 'defaultLocale', 'locales', 'timezone', 'country', 'support']),
    ...(location ? { location: pick(location, ['id', 'publicName', 'internalName', 'timezone', 'type', 'address']) } : {}),
    machine: pick(machine, ['id', 'code', 'name', 'timezone', 'releaseChannel', 'printers']),
    hardwareProfile,
    effective,
    products,
    prices,
    promotions,
    presets,
    presetVersions,
    templates,
    experiences,
    editingPresets,
    campaigns: applicable,
    features,
    retentionPolicies,
    maintenanceChecklists,
    assets,
  });
}
