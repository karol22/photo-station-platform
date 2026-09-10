/**
 * Recorrido de referencias a activos: todo lo que el bundle menciona por id y que la máquina debe
 * tener en disco antes de activar el bundle.
 */
import type { Campaign, Experience, Id, JsonValue, PrintTemplate, Product, TemplateElement } from '@psp/contracts';
import { CONFIG_KEYS } from '@psp/contracts';

export interface AssetReferenceInput {
  effectiveValues: Record<string, JsonValue>;
  products: Product[];
  templates: PrintTemplate[];
  experiences: Experience[];
  campaigns: Campaign[];
}

const ASSET_KEYS = CONFIG_KEYS.filter((definition) => definition.type === 'asset').map((definition) => definition.key);
const ASSET_LIST_KEYS = CONFIG_KEYS.filter(
  (definition) => definition.type === 'stringList' && definition.key.endsWith('AssetIds'),
).map((definition) => definition.key);

function addIfString(target: Set<Id>, value: unknown): void {
  if (typeof value === 'string' && value.length > 0) target.add(value);
}

/** Ids de activos referenciados por los valores efectivos: claves `asset` y listas `*AssetIds`. */
export function assetIdsFromConfig(values: Record<string, JsonValue>): Set<Id> {
  const ids = new Set<Id>();
  for (const key of ASSET_KEYS) addIfString(ids, values[key]);
  for (const key of ASSET_LIST_KEYS) {
    const list = values[key];
    if (Array.isArray(list)) for (const item of list) addIfString(ids, item);
  }
  return ids;
}

/** Ids de activos usados por los elementos de una plantilla (incluidas sus variantes). */
export function assetIdsFromTemplate(template: PrintTemplate): Set<Id> {
  const ids = new Set<Id>();
  const visit = (elements: TemplateElement[]): void => {
    for (const element of elements) {
      if (element.type === 'image' || element.type === 'frame') ids.add(element.assetId);
      else if (element.type === 'background') addIfString(ids, element.assetId);
    }
  };
  visit(template.elements);
  for (const variant of template.variants) if (variant.elements) visit(variant.elements);
  return ids;
}

export function assetIdsFromExperience(experience: Experience): Set<Id> {
  const ids = new Set<Id>();
  for (const pose of experience.poses) {
    addIfString(ids, pose.exampleAssetId);
    addIfString(ids, pose.silhouetteAssetId);
  }
  for (const id of experience.frameAssetIds) ids.add(id);
  for (const id of experience.stickerAssetIds) ids.add(id);
  for (const id of experience.overlayAssetIds) ids.add(id);
  return ids;
}

export function assetIdsFromCampaign(campaign: Campaign): Set<Id> {
  const ids = new Set<Id>(campaign.assetIds);
  addIfString(ids, campaign.sponsor?.logoAssetId);
  for (const key of ASSET_KEYS) addIfString(ids, campaign.configOverlay.values[key]);
  for (const key of ASSET_LIST_KEYS) {
    const list = campaign.configOverlay.values[key];
    if (Array.isArray(list)) for (const item of list) addIfString(ids, item);
  }
  return ids;
}

export function assetIdsFromProduct(product: Product): Set<Id> {
  const ids = new Set<Id>();
  addIfString(ids, product.coverAssetId);
  addIfString(ids, product.promoVideoAssetId);
  return ids;
}

/** Unión de todas las referencias del bundle. */
export function collectReferencedAssetIds(input: AssetReferenceInput): Set<Id> {
  const ids = assetIdsFromConfig(input.effectiveValues);
  const merge = (other: Set<Id>): void => {
    for (const id of other) ids.add(id);
  };
  for (const product of input.products) merge(assetIdsFromProduct(product));
  for (const template of input.templates) merge(assetIdsFromTemplate(template));
  for (const experience of input.experiences) merge(assetIdsFromExperience(experience));
  for (const campaign of input.campaigns) merge(assetIdsFromCampaign(campaign));
  return ids;
}
