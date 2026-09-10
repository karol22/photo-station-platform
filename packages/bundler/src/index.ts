// API pública de @psp/bundler (contrato en docs/arquitectura/01-apis-de-paquetes.md).
export {
  BundlerError,
  applicableCampaigns,
  blueprintLayer,
  campaignLayer,
  chainLayers,
  isCampaignActiveAt,
  materializationContext,
  materializeBundle,
  selectProducts,
  type BundleSource,
  type BundlerErrorCode,
  type MaterializationContext,
  type MaterializeOptions,
} from './materialize';
export { bundleChain, bundleTimezone, computeKioskAvailability, type KioskRuntime } from './availability';
export {
  assetIdsFromCampaign,
  assetIdsFromConfig,
  assetIdsFromExperience,
  assetIdsFromProduct,
  assetIdsFromTemplate,
  collectReferencedAssetIds,
} from './assets';
export { CATALOG, PACKAGE_NAME } from './catalog';
