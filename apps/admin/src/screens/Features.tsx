/** Funciones por alcance (requisito 18): matriz resuelta, overrides, planes y entitlements. */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, DataTable, PageHeader, Skeleton, Tabs } from '@psp/ui';
import type { FeatureState } from '@psp/contracts';
import { errorMessage } from '../api/client';
import { features as featuresApi } from '../api/special';
import { ResourceList } from '../crud/ResourceList';
import { entitlementPlansResource, entitlementsResource, featureOverridesResource } from '../crud/definitions';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';
import { useScopeStore } from '../store/scope';

const TABS = ['matrix', 'overrides', 'plans', 'entitlements'] as const;

function MatrixTab({ tr }: { tr: ReturnType<typeof createTranslator> }) {
  const scope = useScopeStore();
  const level = scope.locationId ? 'location' : scope.regionId ? 'region' : scope.franchiseId ? 'franchise' : scope.organizationId ? 'organization' : 'platform';
  const id = scope.locationId ?? scope.regionId ?? scope.franchiseId ?? scope.organizationId;
  const [states, setStates] = useState<FeatureState[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    featuresApi
      .resolve(level, id)
      .then(setStates)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [level, id]);

  if (error !== undefined) return <Alert tone="danger">{error}</Alert>;
  return (
    <DataTable
      caption={tr.t('admin.features.matrix')}
      columns={[
        { key: 'key', header: tr.t('admin.field.key'), render: (s) => s.key },
        { key: 'mode', header: tr.t('admin.field.mode'), render: (s) => <Badge tone={s.mode === 'enabled' ? 'ok' : s.mode === 'locked' ? 'danger' : s.mode === 'hidden' ? 'neutral' : 'info'}>{tr.t(`admin.features.mode.${s.mode}`)}</Badge> },
        { key: 'source', header: tr.t('admin.features.source'), render: (s) => (typeof s.source === 'string' ? s.source : s.source.level) },
      ]}
      rows={states}
      rowKey="key"
      loading={states.length === 0 && error === undefined}
      empty={{ title: tr.t('admin.common.vacio') }}
    />
  );
}

export function Features() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('matrix');
  return (
    <>
      <PageHeader title={tr.t('admin.nav.features')}>
        <Tabs
          items={[
            { key: 'matrix', label: tr.t('admin.features.matrix') },
            { key: 'overrides', label: tr.t('admin.features.setOverride') },
            { key: 'plans', label: tr.t('admin.nav.entitlements') },
            { key: 'entitlements', label: tr.t('admin.nav.entitlements') },
          ]}
          value={tab}
          onChange={(k) => setTab(k as (typeof TABS)[number])}
        />
      </PageHeader>
      {tab === 'matrix' ? <MatrixTab tr={tr} /> : null}
      {tab === 'overrides' ? <ResourceList definition={featureOverridesResource} /> : null}
      {tab === 'plans' ? <ResourceList definition={entitlementPlansResource} /> : null}
      {tab === 'entitlements' ? <ResourceList definition={entitlementsResource} /> : null}
    </>
  );
}
