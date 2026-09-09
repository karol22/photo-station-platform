/**
 * Flota simulada: N máquinas `mch_sim_0001…` repartidas entre franquicias, regiones y perfiles, con
 * ubicaciones ficticias nuevas en ciudades mexicanas. Misma semilla → misma flota.
 */
import { ConfigLayer, Location, Machine, type HardwareProfile } from '@psp/contracts';
import { DEMO_IDS, PILOT_TAG, SOFTWARE_VERSIONS } from './ids';
import { Rng } from './prng';
import { DEMO_NOW, daysAgo, hoursAgo, minutesAgo } from './time';
import type { FleetBase, FleetResult } from './types';

interface City { city: string; state: string; timezone: string; regionId: string; franchiseId?: string }

const CITIES: readonly City[] = [
  { city: 'Monterrey', state: 'Nuevo León', timezone: 'America/Monterrey', regionId: DEMO_IDS.region.norte, franchiseId: DEMO_IDS.franchise.norte },
  { city: 'Saltillo', state: 'Coahuila', timezone: 'America/Monterrey', regionId: DEMO_IDS.region.norte, franchiseId: DEMO_IDS.franchise.norte },
  { city: 'Torreón', state: 'Coahuila', timezone: 'America/Monterrey', regionId: DEMO_IDS.region.norte, franchiseId: DEMO_IDS.franchise.norte },
  { city: 'Querétaro', state: 'Querétaro', timezone: 'America/Mexico_City', regionId: DEMO_IDS.region.bajio, franchiseId: DEMO_IDS.franchise.bajio },
  { city: 'León', state: 'Guanajuato', timezone: 'America/Mexico_City', regionId: DEMO_IDS.region.bajio, franchiseId: DEMO_IDS.franchise.bajio },
  { city: 'Aguascalientes', state: 'Aguascalientes', timezone: 'America/Mexico_City', regionId: DEMO_IDS.region.bajio, franchiseId: DEMO_IDS.franchise.bajio },
  { city: 'San Luis Potosí', state: 'San Luis Potosí', timezone: 'America/Mexico_City', regionId: DEMO_IDS.region.bajio, franchiseId: DEMO_IDS.franchise.bajio },
  { city: 'Ciudad de México', state: 'CDMX', timezone: 'America/Mexico_City', regionId: DEMO_IDS.region.centro },
  { city: 'Puebla', state: 'Puebla', timezone: 'America/Mexico_City', regionId: DEMO_IDS.region.centro },
  { city: 'Toluca', state: 'Estado de México', timezone: 'America/Mexico_City', regionId: DEMO_IDS.region.centro },
  { city: 'Cuernavaca', state: 'Morelos', timezone: 'America/Mexico_City', regionId: DEMO_IDS.region.centro },
  { city: 'Mérida', state: 'Yucatán', timezone: 'America/Merida', regionId: DEMO_IDS.region.centro },
];

const LOCATION_TYPES = ['mall', 'cinema', 'cafe', 'university', 'hotel', 'transport_terminal', 'store'] as const;
const STREETS = ['Av. Reforma', 'Blvd. Constitución', 'Calle Hidalgo', 'Av. Juárez', 'Calzada Independencia', 'Av. Universidad'];

export function generateFleet(base: FleetBase, count: number, seed: string): FleetResult {
  const rng = new Rng(`fleet/${seed}`);
  const profiles = base.hardwareProfiles.filter((p): p is HardwareProfile => p.organizationId === undefined || p.organizationId === DEMO_IDS.org.lumina);
  if (profiles.length === 0) throw new Error('generateFleet: sin perfiles de hardware');
  const blueprintFor = (profileId: string): string | undefined => base.blueprints.find((b) => b.hardwareProfileId === profileId && b.organizationId === DEMO_IDS.org.lumina)?.id;
  const regionIds = new Set(base.regions.map((r) => r.id));
  const cities = CITIES.filter((c) => regionIds.has(c.regionId));
  const machines: Machine[] = [];
  const locations: Location[] = [];
  const configLayers: ConfigLayer[] = [];
  const locationCount = Math.max(1, Math.ceil(count / 2));

  for (let i = 0; i < locationCount; i += 1) {
    const city = rng.pick(cities.length > 0 ? cities : CITIES);
    const type = rng.pick(LOCATION_TYPES);
    const n = String(i + 1).padStart(4, '0');
    locations.push(
      Location.parse({
        id: `loc_sim_${n}`, organizationId: DEMO_IDS.org.lumina, franchiseId: city.franchiseId, regionId: city.regionId,
        internalName: `SIM-${city.city.slice(0, 3).toUpperCase()}-${n}`, publicName: `${type === 'mall' ? 'Plaza' : type === 'cinema' ? 'Cinema' : type === 'cafe' ? 'Café' : type === 'university' ? 'Universidad' : type === 'hotel' ? 'Hotel' : type === 'transport_terminal' ? 'Terminal' : 'Tienda'} ${city.city} ${n}`,
        type, address: { line1: `${rng.pick(STREETS)} ${rng.int(10, 999)}`, city: city.city, state: city.state, country: 'MX' }, timezone: city.timezone,
        openingHours: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '10:00', to: '21:00' }], status: 'active', installedAt: daysAgo(rng.int(10, 200)), tags: ['simulada'], createdAt: DEMO_NOW,
      }),
    );
  }

  for (let i = 0; i < count; i += 1) {
    const n = String(i + 1).padStart(4, '0');
    const location = locations[i % locations.length];
    if (location === undefined) continue;
    const profile = rng.weighted(profiles.map((p): readonly [HardwareProfile, number] => [p, p.id === DEMO_IDS.hardwareProfile.premiumBooth ? 1 : 2]));
    const status = rng.weighted([['active', 80], ['active_with_warnings', 8], ['maintenance', 4], ['disconnected', 5], ['out_of_service', 3]] as const);
    const pilot = rng.chance(0.1);
    const version = rng.weighted([[SOFTWARE_VERSIONS.v010, 6], [SOFTWARE_VERSIONS.v020, 3], [SOFTWARE_VERSIONS.v030pilot1, pilot ? 1 : 0]] as const);
    const online = status !== 'disconnected';
    machines.push(
      Machine.parse({
        id: `mch_sim_${n}`, code: `SIM-${n}`, name: `Simulada ${n} · ${location.publicName}`, organizationId: DEMO_IDS.org.lumina, franchiseId: location.franchiseId, regionId: location.regionId, locationId: location.id,
        hardwareProfileId: profile.id, blueprintId: blueprintFor(profile.id), status,
        capabilities: profile.expectedCapabilities.map((key) => ({ key, present: true, operational: status !== 'out_of_service', updatedAt: hoursAgo(1) })),
        printers: profile.printers, softwareVersion: version, releaseChannel: version === SOFTWARE_VERSIONS.v030pilot1 ? 'pilot' : 'stable', online,
        lastSeenAt: online ? minutesAgo(rng.int(0, 10)) : daysAgo(rng.int(1, 5)), installedAt: location.installedAt, timezone: location.timezone,
        tags: pilot ? [PILOT_TAG, 'simulada'] : ['simulada'], createdAt: DEMO_NOW,
      }),
    );
    if (rng.chance(0.1)) {
      configLayers.push(ConfigLayer.parse({ id: `cfg_mch_sim_${n}`, level: 'machine', entityId: `mch_sim_${n}`, values: { 'timing.captureCountdownSec': rng.int(2, 5) }, locks: [], version: 1, updatedAt: DEMO_NOW }));
    }
  }
  return { machines, locations, configLayers };
}
