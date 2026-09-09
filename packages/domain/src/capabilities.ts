/**
 * Capacidades de hardware y disponibilidad de productos en una máquina (requisitos 1.3, 9.2, 9.3, 14).
 */
import {
  FEATURE_INDEX,
  type CapabilityKey,
  type FeatureKey,
  type FeatureMode,
  type FeatureState,
  type Machine,
  type MachineCapabilityState,
  type PrinterRuntime,
  type Product,
  type ProductAvailability,
  type ProductAvailabilityState,
  type ProductKind,
  type Scope,
  type UnavailabilityReason,
} from '@psp/contracts';
import { sameScope } from './hierarchy';
import { scheduleMatches, windowMatches } from './time';

/** Mapa clave → estado declarado por la máquina. La última declaración de una clave gana. */
export function capabilityMap(machine: Machine): Partial<Record<CapabilityKey, MachineCapabilityState>> {
  const map: Partial<Record<CapabilityKey, MachineCapabilityState>> = {};
  for (const state of machine.capabilities ?? []) map[state.key] = state;
  return map;
}

/** `missing`: no presentes; `notOperational`: presentes pero fuera de servicio. */
export function checkCapabilities(
  required: CapabilityKey[],
  machine: Machine,
): { missing: CapabilityKey[]; notOperational: CapabilityKey[] } {
  const map = capabilityMap(machine);
  const missing: CapabilityKey[] = [];
  const notOperational: CapabilityKey[] = [];
  for (const key of Array.from(new Set(required))) {
    const state = map[key];
    if (!state || !state.present) missing.push(key);
    else if (!state.operational) notOperational.push(key);
  }
  return { missing, notOperational };
}

/** Feature implícita por tipo de producto: un producto documental necesita el modo documentos. */
export const IMPLICIT_FEATURE_BY_KIND: Partial<Record<ProductKind, FeatureKey>> = {
  document: 'documents.mode',
  entertainment: 'entertainment.mode',
  ai: 'ai.experiences',
};

/** Motivos que ocultan el producto en lugar de mostrarlo como no disponible. */
const HIDDEN_REASONS = new Set<UnavailabilityReason>([
  'inactive',
  'not_available_here',
  'feature_hidden',
  'feature_disabled',
  'missing_capability',
  'out_of_window',
]);

/** Modo de una feature en la lista; sin estado explícito, el default de su definición. */
function modeOf(features: FeatureState[], key: FeatureKey): FeatureMode | undefined {
  return features.find((f) => f.key === key)?.mode ?? FEATURE_INDEX[key]?.defaultMode;
}

function featureReason(mode: FeatureMode | undefined): UnavailabilityReason | undefined {
  switch (mode) {
    case 'enabled':
      return undefined;
    case 'hidden':
      return 'feature_hidden';
    case 'locked':
      return 'feature_locked';
    case 'coming_soon':
      return 'feature_coming_soon';
    default:
      return 'feature_disabled';
  }
}

/** Disponibilidad declarada más específica en la cadena (vigente); empate: la más reciente. */
export function effectiveAvailability(
  availabilities: ProductAvailability[],
  productId: string,
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

/** Impresoras compatibles con la salida del producto: tipo (si se pide) y tamaño de papel. */
export function compatiblePrinters(product: Product, printers: PrinterRuntime[]): PrinterRuntime[] {
  const wantedType = product.output.printerType;
  return printers.filter(
    (printer) => (wantedType === undefined || printer.type === wantedType) && printer.paperSizes.includes(product.output.paperSize),
  );
}

function printerReasons(product: Product, printers: PrinterRuntime[]): UnavailabilityReason[] {
  if (product.printCount <= 0) return [];
  const compatible = compatiblePrinters(product, printers);
  if (compatible.length === 0) return ['printer_unavailable'];
  const usable = compatible.filter((p) => (p.status === 'ready' || p.status === 'busy') && p.paperEstimate !== 0);
  if (usable.length > 0) return [];
  const outOfPaper = compatible.every((p) => p.status === 'no_paper' || p.paperEstimate === 0);
  return outOfPaper ? ['no_paper'] : ['printer_unavailable'];
}

function presentationFor(reasons: UnavailabilityReason[]): ProductAvailabilityState['presentation'] {
  if (reasons.some((r) => HIDDEN_REASONS.has(r))) return 'hidden';
  if (reasons.includes('feature_locked')) return 'locked';
  if (reasons.includes('feature_coming_soon')) return 'coming_soon';
  return 'show';
}

/**
 * Disponibilidad de cada producto en esta máquina y en este instante.
 *
 * Disponible = sin motivos. Presentación: `hidden` si la feature está oculta o faltan capacidades
 * de hardware (o el producto no aplica aquí), `locked` si la feature está bloqueada, `coming_soon`
 * si es futura y `show` (con motivos) cuando la causa es temporal: impresora, papel, horario,
 * mantenimiento o hardware fuera de servicio.
 */
export function computeAvailability(input: {
  products: Product[];
  machine: Machine;
  features: FeatureState[];
  printers: PrinterRuntime[];
  availabilities: ProductAvailability[];
  chain: Scope[];
  now: Date;
  timezone: string;
  maintenance: boolean;
}): ProductAvailabilityState[] {
  const { products, machine, features, printers, availabilities, chain, now, timezone, maintenance } = input;
  const organizationScope = chain.find((scope) => scope.level === 'organization');

  return products.map((product) => {
    const reasons: UnavailabilityReason[] = [];
    const add = (reason: UnavailabilityReason): void => {
      if (!reasons.includes(reason)) reasons.push(reason);
    };

    if (product.status !== 'active') add('inactive');
    if (organizationScope !== undefined && organizationScope.id !== product.organizationId) add('not_available_here');
    const declared = effectiveAvailability(availabilities, product.id, chain, now);
    if (declared !== undefined && !declared.enabled) add('not_available_here');

    if (product.startsAt !== undefined || product.endsAt !== undefined) {
      const window = { start: product.startsAt ?? '1970-01-01T00:00:00Z', ...(product.endsAt !== undefined ? { end: product.endsAt } : {}) };
      if (!windowMatches(window, now)) add('out_of_window');
    }
    if (!scheduleMatches(product.schedule ?? [], now, timezone)) add('out_of_schedule');

    const requiredFeatures = new Set<FeatureKey>(product.requiredFeatures ?? []);
    const implicit = IMPLICIT_FEATURE_BY_KIND[product.kind];
    if (implicit !== undefined) requiredFeatures.add(implicit);
    for (const key of requiredFeatures) {
      const reason = featureReason(modeOf(features, key));
      if (reason !== undefined) add(reason);
    }

    const { missing, notOperational } = checkCapabilities(product.hardwareRequirements ?? [], machine);
    if (missing.length > 0) add('missing_capability');
    if (notOperational.length > 0) add('capability_not_operational');

    for (const reason of printerReasons(product, printers)) add(reason);
    if (maintenance) add('maintenance');

    return {
      productId: product.id,
      available: reasons.length === 0,
      presentation: presentationFor(reasons),
      reasons,
    };
  });
}
