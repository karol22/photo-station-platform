/**
 * Disponibilidad de productos para el kiosco: envoltura de `computeAvailability` de @psp/domain con
 * los datos del bundle (productos ya filtrados por alcance) y el estado en tiempo real de la máquina.
 */
import type { ConfigBundle, Machine, PrinterRuntime, ProductAvailabilityState, Scope } from '@psp/contracts';
import { computeAvailability } from '@psp/domain';

export interface KioskRuntime {
  machine: Machine;
  printers: PrinterRuntime[];
  maintenance: boolean;
  now: Date;
}

/** Cadena mínima reconstruida desde el bundle: plataforma, organización, ubicación y máquina. */
export function bundleChain(bundle: ConfigBundle): Scope[] {
  const chain: Scope[] = [{ level: 'platform' }, { level: 'organization', id: bundle.organizationId }];
  if (bundle.location) chain.push({ level: 'location', id: bundle.location.id });
  chain.push({ level: 'machine', id: bundle.machineId });
  return chain;
}

export function bundleTimezone(bundle: ConfigBundle): string {
  return bundle.machine.timezone ?? bundle.location?.timezone ?? bundle.organization.timezone;
}

export function computeKioskAvailability(bundle: ConfigBundle, runtime: KioskRuntime): ProductAvailabilityState[] {
  return computeAvailability({
    products: bundle.products,
    machine: runtime.machine,
    features: bundle.features,
    printers: runtime.printers,
    availabilities: [],
    chain: bundleChain(bundle),
    now: runtime.now,
    timezone: bundleTimezone(bundle),
    maintenance: runtime.maintenance,
  });
}
