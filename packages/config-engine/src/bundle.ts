import type { ConfigBundle, FeatureKey, Id } from '@psp/contracts';
import { CONTRACTS_VERSION } from '@psp/contracts';
import { stableHash, stableStringify } from './hash';

export type BundleInput = Omit<ConfigBundle, 'version' | 'contractsVersion'>;

export interface BundleDiff {
  /** Claves cuyo valor efectivo o bloqueo efectivo cambia. */
  configKeys: string[];
  productsAdded: Id[];
  productsRemoved: Id[];
  /** Productos presentes en ambos bundles cuyo precio resuelto cambia. */
  pricesChanged: Id[];
  /** Campañas agregadas, quitadas o modificadas. */
  campaignsChanged: Id[];
  featuresChanged: FeatureKey[];
  templatesChanged: Id[];
  /** Presets agregados, quitados o con cambios en la entidad o en sus versiones. */
  presetsChanged: Id[];
  experiencesChanged: Id[];
  /** Activos del manifiesto agregados, quitados o con otro hash/URL. */
  assetsChanged: Id[];
}

/** Campos que no participan en el hash del bundle. */
const EXCLUDED_FROM_VERSION = new Set(['version', 'generatedAt']);

/**
 * Materializa un bundle inmutable: agrega `contractsVersion` y calcula `version` como el hash
 * estable de todo el contenido salvo `generatedAt` (y `version`). El mismo contenido produce la
 * misma versión aunque se genere en otro momento.
 */
export function buildBundle(input: BundleInput): ConfigBundle {
  const content: Record<string, unknown> = { contractsVersion: CONTRACTS_VERSION };
  for (const [key, value] of Object.entries(input)) {
    if (!EXCLUDED_FROM_VERSION.has(key)) content[key] = value;
  }
  const version = stableHash(content);
  return { ...input, version, contractsVersion: CONTRACTS_VERSION };
}

function changedIds<T>(a: readonly T[], b: readonly T[], idOf: (item: T) => string): string[] {
  const left = new Map(a.map((item) => [idOf(item), stableStringify(item)]));
  const right = new Map(b.map((item) => [idOf(item), stableStringify(item)]));
  const changed = new Set<string>();
  for (const [id, serialized] of left) if (right.get(id) !== serialized) changed.add(id);
  for (const [id, serialized] of right) if (left.get(id) !== serialized) changed.add(id);
  return [...changed].sort();
}

function missingIds<T>(
  from: readonly T[],
  inOther: readonly T[],
  idOf: (item: T) => string,
): string[] {
  const present = new Set(inOther.map(idOf));
  return [...new Set(from.map(idOf).filter((id) => !present.has(id)))].sort();
}

/** Diferencia entre dos bundles, pensada para mostrar "qué cambia" antes de confirmar. */
export function bundleDiff(a: ConfigBundle, b: ConfigBundle): BundleDiff {
  const configKeys = new Set<string>();
  const keys = new Set([
    ...Object.keys(a.effective.values),
    ...Object.keys(b.effective.values),
    ...Object.keys(a.effective.locks),
    ...Object.keys(b.effective.locks),
  ]);
  for (const key of keys) {
    const valueChanged =
      stableStringify(a.effective.values[key]) !== stableStringify(b.effective.values[key]);
    const lockChanged =
      stableStringify(a.effective.locks[key]) !== stableStringify(b.effective.locks[key]);
    if (valueChanged || lockChanged) configKeys.add(key);
  }

  const productId = (item: { id: string }) => item.id;
  const productsAdded = missingIds(b.products, a.products, productId);
  const productsRemoved = missingIds(a.products, b.products, productId);
  const notShared = new Set([...productsAdded, ...productsRemoved]);
  const pricesChanged = changedIds(a.prices, b.prices, (price) => price.productId).filter(
    (id) => !notShared.has(id),
  );

  const byId = (item: { id: string }) => item.id;
  const presetComposite = (bundle: ConfigBundle) =>
    bundle.presets.map((preset) => ({
      preset,
      versions: bundle.presetVersions
        .filter((version) => version.presetId === preset.id)
        .sort((x, y) => x.version - y.version),
    }));

  return {
    configKeys: [...configKeys].sort(),
    productsAdded,
    productsRemoved,
    pricesChanged,
    campaignsChanged: changedIds(a.campaigns, b.campaigns, byId),
    featuresChanged: changedIds(a.features, b.features, (feature) => feature.key) as FeatureKey[],
    templatesChanged: changedIds(a.templates, b.templates, byId),
    presetsChanged: changedIds(presetComposite(a), presetComposite(b), (entry) => entry.preset.id),
    experiencesChanged: changedIds(a.experiences, b.experiences, byId),
    assetsChanged: changedIds(a.assets, b.assets, (asset) => asset.assetId),
  };
}
