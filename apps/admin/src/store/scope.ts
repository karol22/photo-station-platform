/**
 * Selector de alcance de la barra superior (organización → franquicia → región → ubicación).
 * Cambiar un nivel limpia los niveles inferiores. Se envía como `ScopeFilter` en todos los
 * listados (requisito 35) y fija el alcance visible del portal de franquicia.
 */
import { create } from 'zustand';
import type { ScopeFilter } from '@psp/contracts';

interface ScopeState {
  organizationId: string | undefined;
  franchiseId: string | undefined;
  regionId: string | undefined;
  locationId: string | undefined;
  setOrganization: (id: string | undefined) => void;
  setFranchise: (id: string | undefined) => void;
  setRegion: (id: string | undefined) => void;
  setLocation: (id: string | undefined) => void;
  setAll: (scope: ScopeFilter) => void;
  reset: () => void;
}

export const useScopeStore = create<ScopeState>((set) => ({
  organizationId: undefined,
  franchiseId: undefined,
  regionId: undefined,
  locationId: undefined,
  setOrganization: (id) => set({ organizationId: id, franchiseId: undefined, regionId: undefined, locationId: undefined }),
  setFranchise: (id) => set({ franchiseId: id, regionId: undefined, locationId: undefined }),
  setRegion: (id) => set({ regionId: id, locationId: undefined }),
  setLocation: (id) => set({ locationId: id }),
  setAll: (scope) => set({ organizationId: scope.organizationId, franchiseId: scope.franchiseId, regionId: scope.regionId, locationId: scope.locationId }),
  reset: () => set({ organizationId: undefined, franchiseId: undefined, regionId: undefined, locationId: undefined }),
}));

/** Alcance actual como `ScopeFilter` (sin `machineId`: eso lo fija cada pantalla de detalle). */
export function currentScopeFilter(): ScopeFilter {
  const { organizationId, franchiseId, regionId, locationId } = useScopeStore.getState();
  const filter: ScopeFilter = {};
  if (organizationId) filter.organizationId = organizationId;
  if (franchiseId) filter.franchiseId = franchiseId;
  if (regionId) filter.regionId = regionId;
  if (locationId) filter.locationId = locationId;
  return filter;
}

/** Hook de conveniencia: el alcance actual, recalculado cuando cambia. */
export function useScopeFilter(): ScopeFilter {
  const organizationId = useScopeStore((s) => s.organizationId);
  const franchiseId = useScopeStore((s) => s.franchiseId);
  const regionId = useScopeStore((s) => s.regionId);
  const locationId = useScopeStore((s) => s.locationId);
  const filter: ScopeFilter = {};
  if (organizationId) filter.organizationId = organizationId;
  if (franchiseId) filter.franchiseId = franchiseId;
  if (regionId) filter.regionId = regionId;
  if (locationId) filter.locationId = locationId;
  return filter;
}
