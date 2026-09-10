/**
 * Features y entitlements (requisito 18): default → plan → overrides por alcance → dependencias →
 * capacidades de la máquina. Una función no autorizada nunca es un error: se oculta, se bloquea
 * con explicación o se muestra como próximamente.
 */
import {
  FEATURE_DEFINITIONS,
  FEATURE_INDEX,
  type Entitlement,
  type EntitlementPlan,
  type FeatureDefinition,
  type FeatureKey,
  type FeatureMode,
  type FeatureOverride,
  type FeatureState,
  type LocalizedText,
  type Machine,
  type Scope,
} from '@psp/contracts';
import { checkCapabilities } from './capabilities';
import { sameScope } from './hierarchy';

function depthOf(scope: Scope, chain: Scope[]): number {
  return chain.findIndex((s) => sameScope(s, scope));
}

function isEntitlementActive(entitlement: Entitlement, now: Date): boolean {
  const starts = Date.parse(entitlement.startsAt);
  if (Number.isNaN(starts) || starts > now.getTime()) return false;
  if (entitlement.endsAt === undefined) return true;
  const ends = Date.parse(entitlement.endsAt);
  return !Number.isNaN(ends) && now.getTime() < ends;
}

/** Entitlement vigente más específico de la cadena; empate: el que empieza más tarde. */
export function activeEntitlement(entitlements: Entitlement[], chain: Scope[], now: Date): Entitlement | undefined {
  let best: Entitlement | undefined;
  let bestDepth = -1;
  for (const entitlement of entitlements) {
    if (!isEntitlementActive(entitlement, now)) continue;
    const depth = depthOf(entitlement.scope, chain);
    if (depth < 0) continue;
    if (depth > bestDepth || (depth === bestDepth && best !== undefined && entitlement.startsAt > best.startsAt)) {
      best = entitlement;
      bestDepth = depth;
    }
  }
  return best;
}

function planName(plan: EntitlementPlan): LocalizedText {
  return { es: plan.name.es, en: plan.name.en ?? plan.name.es };
}

function dependencyReason(dependency: FeatureDefinition): LocalizedText {
  return { es: `Requiere «${dependency.name.es}»`, en: `Requires "${dependency.name.en ?? dependency.name.es}"` };
}

/**
 * Resuelve el modo de cada feature para una cadena de alcance (y opcionalmente una máquina).
 *
 * 1. default de `FEATURE_DEFINITIONS`;
 * 2. plan del entitlement vigente más específico: si no incluye la feature → `locked`;
 * 3. overrides por alcance de lo general a lo específico (gana el más específico) siempre que el
 *    nivel esté en `appliesTo` de la definición;
 * 4. dependencias (`dependsOn` no habilitada → `hidden`);
 * 5. capacidades requeridas, si hay máquina (faltan → `hidden`, fuente `capability`).
 */
export function resolveFeatures(input: {
  chain: Scope[];
  overrides: FeatureOverride[];
  entitlements: Entitlement[];
  plans: EntitlementPlan[];
  machine?: Machine;
  now: Date;
}): FeatureState[] {
  const { chain, overrides, entitlements, plans, machine, now } = input;
  const entitlement = activeEntitlement(entitlements, chain, now);
  const plan = entitlement === undefined ? undefined : plans.find((p) => p.id === entitlement.planId);
  const states = new Map<FeatureKey, FeatureState>();

  for (const definition of FEATURE_DEFINITIONS) {
    let state: FeatureState = { key: definition.key, mode: definition.defaultMode, source: 'default' };

    if (plan !== undefined && !plan.features.includes(definition.key)) {
      const name = planName(plan);
      state = {
        key: definition.key,
        mode: 'locked',
        source: 'plan',
        reason: { es: `No incluida en el plan «${name.es}»`, en: `Not included in plan "${name.en}"` },
      };
    }

    const applicable = overrides
      .filter((o) => o.key === definition.key && definition.appliesTo.includes(o.scope.level))
      .map((override) => ({ override, depth: depthOf(override.scope, chain) }))
      .filter((entry) => entry.depth >= 0)
      .sort((a, b) => a.depth - b.depth || a.override.setAt.localeCompare(b.override.setAt));
    const winner = applicable[applicable.length - 1]?.override;
    if (winner !== undefined) {
      state = { key: definition.key, mode: winner.mode, source: winner.scope };
      if (winner.reason !== undefined) state.reason = { es: winner.reason };
    }
    states.set(definition.key, state);
  }

  // Dependencias: iterar hasta estabilizar (las cadenas de dependencias son cortas).
  let changed = true;
  for (let round = 0; changed && round <= FEATURE_DEFINITIONS.length; round++) {
    changed = false;
    for (const definition of FEATURE_DEFINITIONS) {
      const state = states.get(definition.key);
      if (state === undefined || state.mode === 'hidden') continue;
      for (const dependencyKey of definition.dependsOn) {
        const dependency = states.get(dependencyKey);
        const dependencyDefinition = FEATURE_INDEX[dependencyKey];
        if (dependency === undefined || dependency.mode === 'enabled' || dependencyDefinition === undefined) continue;
        states.set(definition.key, {
          key: definition.key,
          mode: 'hidden',
          source: dependency.source,
          reason: dependencyReason(dependencyDefinition),
        });
        changed = true;
        break;
      }
    }
  }

  if (machine !== undefined) {
    for (const definition of FEATURE_DEFINITIONS) {
      if (definition.requiresCapabilities.length === 0) continue;
      const { missing } = checkCapabilities(definition.requiresCapabilities, machine);
      if (missing.length === 0) continue;
      states.set(definition.key, {
        key: definition.key,
        mode: 'hidden',
        source: 'capability',
        reason: { es: `Falta hardware: ${missing.join(', ')}`, en: `Missing hardware: ${missing.join(', ')}` },
      });
    }
  }

  return FEATURE_DEFINITIONS.map((definition) => states.get(definition.key) as FeatureState);
}

/** Modo de una feature en una lista resuelta; si falta, el default de su definición. */
export function featureMode(features: FeatureState[], key: FeatureKey): FeatureMode {
  return features.find((f) => f.key === key)?.mode ?? FEATURE_INDEX[key]?.defaultMode ?? 'hidden';
}
