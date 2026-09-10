/**
 * Tema y activos del bundle. Las URLs de activos se resuelven localmente: `assetBaseUrl/hash`
 * buscando la entrada por `assetId` en el manifiesto; nunca se pide nada a la nube.
 */
import type { KioskBundle } from '@psp/contracts';
import { applyBrandingTheme } from '@psp/ui';

type AssetSource = Pick<KioskBundle, 'assetBaseUrl' | 'assets'>;
/** Cualquier objeto con valores efectivos (bundle real o recorte en pruebas). */
export type ConfigSource = { effective: { values: Record<string, unknown> } };

export function resolveAssetUrl(bundle: AssetSource | undefined, assetId: string | null | undefined): string | undefined {
  if (!bundle || !assetId) return undefined;
  const entry = bundle.assets.find((a) => a.assetId === assetId);
  if (!entry) return undefined;
  const base = bundle.assetBaseUrl.replace(/\/+$/, '');
  return `${base}/${entry.hash}`;
}

export function configString(bundle: ConfigSource | undefined, key: string): string | undefined {
  const value = bundle?.effective.values[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function configNumber(bundle: ConfigSource | undefined, key: string, fallback: number): number {
  const value = bundle?.effective.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function configBool(bundle: ConfigSource | undefined, key: string, fallback = false): boolean {
  const value = bundle?.effective.values[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function configList(bundle: ConfigSource | undefined, key: string): string[] {
  const value = bundle?.effective.values[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Aplica la paleta `branding.palette.*` del bundle a las variables CSS del documento. */
export function applyBundleTheme(bundle: ConfigSource | undefined): void {
  if (!bundle) return;
  applyBrandingTheme(bundle.effective.values);
}
