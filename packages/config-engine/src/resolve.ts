import type {
  Campaign,
  ConfigKeyDefinition,
  ConfigLayer,
  EffectiveConfig,
  Id,
  JsonValue,
  ProvenanceEntry,
} from '@psp/contracts';
import { CONFIG_KEYS } from '@psp/contracts';
import { stableHash } from './hash';
import { layerRank } from './levels';
import {
  applyLayerLocks,
  indexDefinitions,
  rejectionReason,
  sortRecord,
  type LockMap,
} from './rules';

/** Campaña con la capa que materializa su `configOverlay`. */
export interface CampaignOverlayInput {
  campaign: Campaign;
  layer: ConfigLayer;
}

export interface ResolveInput {
  /** Capas de la jerarquía (platform → machine). Se ordenan por nivel; a igual nivel, la última gana. */
  layers: ConfigLayer[];
  /** Defaults del blueprint de la máquina; se aplica entre organización y franquicia. */
  blueprint?: ConfigLayer;
  /** Overlays de campaña; sólo se aplican los vigentes en `now`, en orden de prioridad. */
  campaigns?: CampaignOverlayInput[];
  /** Registro de claves; por defecto `CONFIG_KEYS` de contratos. */
  definitions?: ConfigKeyDefinition[];
  /** Instante de resolución (inyectado: nunca `Date.now()` dentro del motor). */
  now: Date;
  /** Zona horaria de la máquina. Reservada para activación por hora local; hoy no altera el resultado. */
  timezone: string;
}

export type RejectedEntry = EffectiveConfig['rejected'][number];

interface OrderedLayer {
  layer: ConfigLayer;
  entityId: Id | undefined;
}

/** Una campaña está vigente cuando `startsAt <= now < endsAt` (instantes UTC). */
export function isCampaignActive(
  campaign: Pick<Campaign, 'startsAt' | 'endsAt'>,
  now: Date,
): boolean {
  const nowMs = epochMs(now);
  const startsAt = Date.parse(campaign.startsAt);
  const endsAt = Date.parse(campaign.endsAt);
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return false;
  return startsAt <= nowMs && nowMs < endsAt;
}

/**
 * Orden de aplicación de campañas: prioridad ascendente, de modo que la de mayor prioridad se
 * aplica al final y gana. Empates: `startsAt` más reciente gana; después `id` mayor.
 */
export function orderCampaigns<T extends { campaign: Campaign }>(overlays: readonly T[]): T[] {
  return [...overlays].sort((a, b) => {
    const byPriority = a.campaign.priority - b.campaign.priority;
    if (byPriority !== 0) return byPriority;
    const byStart = Date.parse(a.campaign.startsAt) - Date.parse(b.campaign.startsAt);
    if (byStart !== 0 && !Number.isNaN(byStart)) return byStart;
    return a.campaign.id < b.campaign.id ? -1 : a.campaign.id > b.campaign.id ? 1 : 0;
  });
}

function epochMs(now: Date): number {
  const ms = now.getTime();
  if (Number.isNaN(ms))
    throw new RangeError('resolveEffectiveConfig: `now` no es una fecha válida');
  return ms;
}

function orderLayers(input: ResolveInput): OrderedLayer[] {
  const entries: Array<OrderedLayer & { rank: number; seq: number }> = [];
  let seq = 0;
  for (const layer of input.layers) {
    entries.push({ layer, entityId: layer.entityId, rank: layerRank(layer.level), seq: seq++ });
  }
  if (input.blueprint) {
    const layer: ConfigLayer = { ...input.blueprint, level: 'blueprint' };
    entries.push({ layer, entityId: layer.entityId, rank: layerRank('blueprint'), seq: seq++ });
  }
  const active = (input.campaigns ?? []).filter((overlay) =>
    isCampaignActive(overlay.campaign, input.now),
  );
  for (const overlay of orderCampaigns(active)) {
    const layer: ConfigLayer = {
      ...overlay.layer,
      level: 'campaign',
      entityId: overlay.campaign.id,
    };
    entries.push({ layer, entityId: overlay.campaign.id, rank: layerRank('campaign'), seq: seq++ });
  }
  entries.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
  return entries.map(({ layer, entityId }) => ({ layer, entityId }));
}

/**
 * Resuelve la configuración efectiva de una máquina.
 *
 * 1. Parte de los defaults del registro (`provenance.isDefault = true`).
 * 2. Aplica las capas en orden: platform → organization → blueprint → franchise → region →
 *    location → machine → campañas vigentes por prioridad.
 * 3. Cada escritura se acepta sólo si la definición lo permite en ese nivel (`editableAt`) y
 *    ningún nivel superior bloqueó la clave (`mandatory`/`hidden` rechazan; `range` valida).
 * 4. Los bloqueos de una capa rigen para los niveles inferiores; uno inferior no debilita a uno
 *    superior (se ignora y se reporta como `lock_ignored`).
 * 5. `hash` = `stableHash({ values, locks })`: mismo insumo, mismo hash.
 */
export function resolveEffectiveConfig(input: ResolveInput): EffectiveConfig {
  epochMs(input.now);
  const definitions = input.definitions ?? CONFIG_KEYS;
  const index = indexDefinitions(definitions);

  const values: Record<string, JsonValue> = {};
  const provenance: Record<string, ProvenanceEntry> = {};
  const locks: LockMap = {};
  const rejected: RejectedEntry[] = [];

  for (const definition of definitions) {
    values[definition.key] = definition.default;
    provenance[definition.key] = { level: 'platform', isDefault: true };
  }

  for (const { layer, entityId } of orderLayers(input)) {
    const withEntity = entityId !== undefined ? { entityId } : {};
    for (const key of Object.keys(layer.values).sort()) {
      const value = layer.values[key];
      if (value === undefined) continue;
      const reason = rejectionReason({
        key,
        value,
        level: layer.level,
        lock: locks[key],
        definition: index.get(key),
      });
      if (reason !== undefined) {
        rejected.push({ key, level: layer.level, ...withEntity, reason });
        continue;
      }
      values[key] = value;
      provenance[key] = { level: layer.level, ...withEntity, layerId: layer.id, isDefault: false };
    }
    applyLayerLocks(locks, layer, entityId, (lock) => {
      rejected.push({ key: lock.key, level: layer.level, ...withEntity, reason: 'lock_ignored' });
    });
  }

  const sortedValues = sortRecord(values);
  const sortedLocks = sortRecord(locks);
  return {
    values: sortedValues,
    provenance: sortRecord(provenance),
    locks: sortedLocks,
    rejected,
    hash: stableHash({ values: sortedValues, locks: sortedLocks }),
  };
}
