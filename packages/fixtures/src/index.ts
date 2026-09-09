/**
 * @psp/fixtures — superficie pública (contrato de `docs/arquitectura/01-apis-de-paquetes.md`).
 *
 * Dataset demo canónico y determinista: dos marcas, dos franquicias, ubicaciones, máquinas,
 * productos, presets, plantillas, campañas, activos generados, usuarios y roles. Generadores de
 * flota y de historial de sesiones con semilla. Todo se valida contra `@psp/contracts`.
 */
import type { CatalogEntry } from '@psp/contracts';
import type { DemoDataset, DemoUser } from './types';
import { buildAssets } from './data/assets';
import { buildCampaigns } from './data/campaigns';
import { buildPriceRules, buildProductAvailabilities, buildProducts, buildPromotions } from './data/catalog';
import { buildConfigLayers, buildEntitlementPlans, buildEntitlements, buildFeatureOverrides, buildMaintenanceChecklists, buildRetentionPolicies } from './data/config';
import { buildEditingPresets, buildExperiences } from './data/experiences';
import { buildBlueprints, buildFranchises, buildHardwareProfiles, buildLocations, buildMachines, buildOrganizations, buildRegions, buildTerritories } from './data/hierarchy';
import { buildAnnouncements, buildConsumables, buildIncidents, buildInternalDocuments, buildMaintenanceLogs } from './data/operations';
import { buildDemoUsers, buildRoleAssignments, buildSupportAccesses, buildUsers } from './data/people';
import { buildPresetVersions, buildPresets } from './data/presets';
import { buildReleases, buildRollouts } from './data/releases';
import { buildTemplates } from './data/templates';
import { generateSessionHistory } from './sessions';

export type { AssetContent, DemoDataset, DemoUser, FleetBase, FleetResult, SessionHistoryBase } from './types';
export { DEMO_IDS, PILOT_TAG, SOFTWARE_VERSIONS } from './ids';
export { DEMO_NOW } from './time';
export { assetContent } from './data/assets';
export { generateFleet } from './fleet';
export { generateSessionHistory } from './sessions';
export { TECH_PANEL_PIN } from './data/config';
export { DEMO_PASSWORD } from './data/people';

/** Días de historial de sesiones que incluye `demoDataset()`. */
export const DEMO_SESSION_DAYS = 14;
/** Semilla del historial de sesiones del dataset demo. */
export const DEMO_SESSION_SEED = 'demo-sessions';

/** Usuarios demo con credencial (`demo`), rol y alcance. */
export const DEMO_USERS: DemoUser[] = buildDemoUsers();

/** Dataset sin historial de sesiones (útil para el seed y para generar historiales a medida). */
export function demoDatasetWithoutSessions(): Omit<DemoDataset, 'sessionRecords'> {
  const products = buildProducts();
  const machines = buildMachines();
  return {
    organizations: buildOrganizations(),
    franchises: buildFranchises(),
    territories: buildTerritories(),
    regions: buildRegions(),
    locations: buildLocations(),
    machines,
    hardwareProfiles: buildHardwareProfiles(),
    blueprints: buildBlueprints(),
    users: buildUsers(),
    roleAssignments: buildRoleAssignments(),
    supportAccesses: buildSupportAccesses(),
    products,
    productAvailabilities: buildProductAvailabilities(),
    priceRules: buildPriceRules(products),
    promotions: buildPromotions(),
    presets: buildPresets(),
    presetVersions: buildPresetVersions(),
    templates: buildTemplates(),
    experiences: buildExperiences(),
    editingPresets: buildEditingPresets(),
    campaigns: buildCampaigns(),
    assets: buildAssets(),
    retentionPolicies: buildRetentionPolicies(),
    maintenanceChecklists: buildMaintenanceChecklists(),
    configLayers: buildConfigLayers(),
    featureOverrides: buildFeatureOverrides(),
    entitlementPlans: buildEntitlementPlans(),
    entitlements: buildEntitlements(),
    releases: buildReleases(),
    rollouts: buildRollouts(),
    internalDocuments: buildInternalDocuments(),
    announcements: buildAnnouncements(),
    incidents: buildIncidents(),
    maintenanceLogs: buildMaintenanceLogs(),
    consumables: buildConsumables(machines),
  };
}

/** Dataset demo completo con 14 días de historial de sesiones. Determinista: misma salida en cada llamada. */
export function demoDataset(): DemoDataset {
  const base = demoDatasetWithoutSessions();
  return { ...base, sessionRecords: generateSessionHistory(base, DEMO_SESSION_DAYS, DEMO_SESSION_SEED) };
}

export const CATALOG: CatalogEntry[] = [
  { kind: 'package', key: '@psp/fixtures', name: 'Dataset demo', description: 'Dataset demo determinista validado contra los contratos, con generadores de flota y de historial de sesiones.', package: '@psp/fixtures', status: 'stable', docs: 'packages/fixtures/README.md' },
];
