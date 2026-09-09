/** Comparaciones de métricas por máquina/ubicación/franquicia/producto/periodo (requisito 21). */
import { useMemo, useState } from 'react';
import { Alert, Button, DataTable, Field, PageHeader, Select } from '@psp/ui';
import { MetricsGroupBy as MetricsGroupByEnum } from '@psp/contracts';
import type { MetricsResponse } from '@psp/contracts';

type MetricsGroupBy = (typeof MetricsGroupByEnum.options)[number];
import { errorMessage } from '../api/client';
import { metrics as metricsApi } from '../api/special';
import { createTranslator } from '../i18n/extra';
import { daysAgoIso } from '../lib/format';
import { usePrefsStore } from '../store/prefs';
import { useScopeFilter } from '../store/scope';

const GROUP_BY: MetricsGroupBy[] = ['machine', 'location', 'city', 'franchise', 'organization', 'product', 'campaign', 'period'];

export function Metrics() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const scope = useScopeFilter();
  const [groupBy, setGroupBy] = useState<MetricsGroupBy>('location');
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<MetricsResponse>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(undefined);
    try {
      const now = new Date();
      const res = await metricsApi.query({ ...scope, from: daysAgoIso(days, now), to: now.toISOString(), granularity: 'day', groupBy, includeDemo: true });
      setResult(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const max = Math.max(1, ...(result?.series.map((s) => s.sessions.started) ?? [1]));

  return (
    <>
      <PageHeader title={tr.t('admin.nav.metrics')} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
        <Field label={tr.t('admin.metrics.groupBy')}>
          <Select options={GROUP_BY.map((g) => ({ value: g, label: g }))} value={groupBy} onChange={(e) => setGroupBy(e.target.value as MetricsGroupBy)} />
        </Field>
        <Field label={tr.t('admin.dashboard.period')}>
          <Select options={[{ value: '1', label: tr.t('admin.dashboard.last24h') }, { value: '7', label: tr.t('admin.dashboard.last7d') }, { value: '30', label: tr.t('admin.dashboard.last30d') }]} value={String(days)} onChange={(e) => setDays(Number(e.target.value))} />
        </Field>
        <Button variant="primary" loading={loading} onClick={() => void run()}>
          {tr.t('admin.action.apply')}
        </Button>
      </div>
      {error !== undefined ? <Alert tone="danger">{error}</Alert> : null}
      {result ? (
        <>
          <p>
            {tr.t('admin.metrics.totals')}: {result.totals.sessions.started} · {tr.t('admin.dashboard.sessionsCompleted')}: {result.totals.sessions.completed}
          </p>
          <svg viewBox={`0 0 ${Math.max(1, result.series.length) * 60} 140`} width="100%" height="140" role="img" aria-label={tr.t('admin.metrics.series')}>
            {result.series.map((point, i) => {
              const h = (point.sessions.started / max) * 100;
              return (
                <g key={point.key} transform={`translate(${i * 60}, 0)`}>
                  <rect x={10} y={120 - h} width={30} height={h} fill="#1E5EFF" />
                  <text x={25} y={135} fontSize={10} textAnchor="middle">
                    {point.label.slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </svg>
          <DataTable
            caption={tr.t('admin.metrics.byProduct')}
            columns={[
              { key: 'productName', header: tr.t('admin.field.productId'), render: (p) => p.productName },
              { key: 'sessions', header: tr.t('admin.dashboard.sessionsToday'), render: (p) => p.sessions },
              { key: 'completed', header: tr.t('admin.dashboard.sessionsCompleted'), render: (p) => p.completed },
              { key: 'registeredValue', header: tr.t('admin.field.value'), render: (p) => tr.formatMoney(p.registeredValue) },
            ]}
            rows={result.products}
            rowKey="productId"
            empty={{ title: tr.t('admin.common.vacio') }}
          />
        </>
      ) : null}
    </>
  );
}
