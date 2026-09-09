// API pública de @psp/config-engine (contrato en docs/arquitectura/01-apis-de-paquetes.md).
export { sha256Hex, stableHash, stableStringify, utf8Encode } from './hash';
export { LEVEL_ORDER, compareLevels, layerRank, scopeLevelFor } from './levels';
export {
  LOCK_STRENGTH,
  REJECTION_REASONS,
  VALIDATION_REASONS,
  canApplyLock,
  isRangeContained,
  isWithinRange,
} from './rules';
export {
  isCampaignActive,
  orderCampaigns,
  resolveEffectiveConfig,
  type CampaignOverlayInput,
  type RejectedEntry,
  type ResolveInput,
} from './resolve';
export { explainKey, type ExplainResult } from './explain';
export {
  definitionViolation,
  validateLayer,
  type LayerValidation,
  type LayerViolation,
} from './validate';
export { buildBundle, bundleDiff, type BundleDiff, type BundleInput } from './bundle';
export { CATALOG, PACKAGE_NAME } from './catalog';
