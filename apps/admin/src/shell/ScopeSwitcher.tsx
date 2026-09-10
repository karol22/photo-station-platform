/**
 * Selector de alcance de la barra superior: organización → franquicia → región → ubicación. Si el
 * principal ve un único alcance no-plataforma (p. ej. un franquiciatario), ese nivel queda fijo y
 * los niveles superiores se ocultan: el portal de franquicia es la misma app con el alcance atado.
 */
import { useEffect, useMemo, useState } from 'react';
import { Select } from '@psp/ui';
import { visibleScopes } from '@psp/domain';
import type { Franchise, Location, Organization, Region, ScopeLevel } from '@psp/contracts';
import { api } from '../api/resources';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';
import { useScopeStore } from '../store/scope';
import { useSessionStore } from '../store/session';

const RANK: Partial<Record<ScopeLevel, number>> = { organization: 1, franchise: 2, region: 3, location: 4 };

export function ScopeSwitcher() {
  const principal = useSessionStore((s) => s.principal);
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const scope = useScopeStore();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (!principal) return;
    void api.organizations.listAll({}, 500).then(setOrgs).catch(() => undefined);
    void api.franchises.listAll({}, 1000).then(setFranchises).catch(() => undefined);
    void api.regions.listAll({}, 1000).then(setRegions).catch(() => undefined);
    void api.locations.listAll({}, 2000).then(setLocations).catch(() => undefined);
  }, [principal]);

  const fixed = useMemo(() => {
    if (!principal) return undefined;
    const scopes = visibleScopes(principal);
    return scopes.length === 1 && scopes[0]!.level !== 'platform' ? scopes[0] : undefined;
  }, [principal]);

  useEffect(() => {
    if (!fixed?.id) return;
    if (fixed.level === 'organization') scope.setOrganization(fixed.id);
    else if (fixed.level === 'franchise') scope.setFranchise(fixed.id);
    else if (fixed.level === 'region') scope.setRegion(fixed.id);
    else if (fixed.level === 'location') scope.setLocation(fixed.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixed?.level, fixed?.id]);

  const fixedRank = fixed ? (RANK[fixed.level] ?? 0) : 0;
  const hidden = (level: ScopeLevel) => fixedRank > 0 && (RANK[level] ?? 0) < fixedRank;
  const locked = (level: ScopeLevel) => fixed?.level === level;

  const franchiseOptions = franchises.filter((f) => !scope.organizationId || f.organizationId === scope.organizationId);
  const regionOptions = regions.filter((r) => (!scope.organizationId || r.organizationId === scope.organizationId) && (!scope.franchiseId || r.franchiseId === scope.franchiseId));
  const locationOptions = locations.filter(
    (l) => (!scope.organizationId || l.organizationId === scope.organizationId) && (!scope.franchiseId || l.franchiseId === scope.franchiseId) && (!scope.regionId || l.regionId === scope.regionId),
  );

  if (!principal) return null;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {!hidden('organization') ? (
        <Select
          aria-label={tr.t('admin.field.organizationId')}
          placeholder={tr.t('admin.scope.selectOrganization')}
          options={orgs.map((o) => ({ value: o.id, label: o.name }))}
          value={scope.organizationId ?? ''}
          disabled={locked('organization')}
          onChange={(e) => scope.setOrganization(e.target.value || undefined)}
        />
      ) : null}
      {!hidden('franchise') ? (
        <Select
          aria-label={tr.t('admin.field.franchiseId')}
          placeholder={tr.t('admin.scope.selectFranchise')}
          options={franchiseOptions.map((f) => ({ value: f.id, label: f.name }))}
          value={scope.franchiseId ?? ''}
          disabled={locked('franchise')}
          onChange={(e) => scope.setFranchise(e.target.value || undefined)}
        />
      ) : null}
      {!hidden('region') ? (
        <Select
          aria-label={tr.t('admin.field.regionId')}
          placeholder={tr.t('admin.scope.selectRegion')}
          options={regionOptions.map((r) => ({ value: r.id, label: r.name }))}
          value={scope.regionId ?? ''}
          disabled={locked('region')}
          onChange={(e) => scope.setRegion(e.target.value || undefined)}
        />
      ) : null}
      {!hidden('location') ? (
        <Select
          aria-label={tr.t('admin.field.locationId')}
          placeholder={tr.t('admin.scope.selectLocation')}
          options={locationOptions.map((l) => ({ value: l.id, label: l.publicName }))}
          value={scope.locationId ?? ''}
          disabled={locked('location')}
          onChange={(e) => scope.setLocation(e.target.value || undefined)}
        />
      ) : null}
    </div>
  );
}
