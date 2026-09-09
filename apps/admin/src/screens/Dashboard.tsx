/** Tablero operativo (requisito 20): StatCards, listas de atención y filtro por alcance. */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, EmptyState, PageHeader, Skeleton, StatCard } from '@psp/ui';
import type { DashboardSummary } from '@psp/contracts';
import { errorMessage } from '../api/client';
import { dashboard } from '../api/special';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';
import { useScopeFilter } from '../store/scope';

function ListPanel({ title, items }: { title: ReactNode; items: string[] }) {
  return (
    <div style={{ border: '1px solid #e2e2e2', borderRadius: 8, padding: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: 14 }}>{title}</h3>
      {items.length === 0 ? <p style={{ opacity: 0.6 }}>—</p> : <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
    </div>
  );
}

export function Dashboard() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const scope = useScopeFilter();
  const [summary, setSummary] = useState<DashboardSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    dashboard
      .summary(scope)
      .then((res) => {
        if (!cancelled) {
          setSummary(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scope.organizationId, scope.franchiseId, scope.regionId, scope.locationId]);

  return (
    <>
      <PageHeader title={tr.t('admin.dashboard.titulo')} subtitle={tr.t('admin.dashboard.filtrarPor')} />
      {error !== undefined ? (
        <Alert tone="danger" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      ) : null}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} variant="rect" height={96} />
          ))}
        </div>
      ) : summary ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard label={tr.t('admin.dashboard.activeMachines')} value={summary.machines.active} tone="ok" />
            <StatCard label={tr.t('admin.dashboard.offlineMachines')} value={summary.machines.offline} tone="danger" />
            <StatCard label={tr.t('admin.dashboard.machinesWithWarnings')} value={summary.machines.warnings} tone="warn" />
            <StatCard label={tr.t('admin.dashboard.machinesInMaintenance')} value={summary.machines.maintenance} tone="info" />
            <StatCard
              label={tr.t('admin.dashboard.sessionsToday')}
              value={summary.sessionsToday.started}
              hint={`${tr.t('admin.dashboard.sessionsCompleted')}: ${summary.sessionsToday.completed} · ${tr.t('admin.dashboard.sessionsDemo')}: ${summary.sessionsToday.demo}`}
            />
            <StatCard label={tr.t('admin.dashboard.openIncidents')} value={summary.openIncidents.length} tone={summary.openIncidents.length > 0 ? 'danger' : 'ok'} />
            <StatCard label={tr.t('admin.dashboard.pendingRollouts')} value={summary.pendingRollouts.length} tone="info" />
            <StatCard label={tr.t('admin.dashboard.machinesIdle')} value={summary.machines.idle.length} tone="warn" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <ListPanel title={tr.t('admin.dashboard.needAttention')} items={summary.machines.needAttention.map((m) => `${m.name} — ${m.reason}`)} />
            <ListPanel title={tr.t('admin.dashboard.topProducts')} items={summary.topProducts.map((p) => `${p.name} (${p.sessions})`)} />
            <ListPanel title={tr.t('admin.dashboard.topLocations')} items={summary.topLocations.map((l) => `${l.name} (${l.sessions})`)} />
            <ListPanel title={tr.t('admin.dashboard.machinesWithoutSessions')} items={summary.machines.idle.map((m) => m.name)} />
            <ListPanel title={tr.t('admin.dashboard.consumablesAttention')} items={summary.consumablesAttention.map((c) => `${c.name} — ${c.type} (${c.estimatedRemaining})`)} />
            <ListPanel title={tr.t('admin.dashboard.pendingRollouts')} items={summary.pendingRollouts.map((r) => `${r.name} ${r.version} (${r.completed}/${r.total})`)} />
            <ListPanel title={tr.t('admin.dashboard.openIncidents')} items={summary.openIncidents.map((i) => `${i.code} — ${i.title} (${i.severity})`)} />
          </div>
        </>
      ) : (
        <EmptyState title={tr.t('admin.dashboard.noData')} />
      )}
    </>
  );
}
