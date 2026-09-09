/** Releases y despliegues (requisito 19): versiones, rollouts con objetivos y acciones. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, DataTable, Field, Input, NumberInput, PageHeader, Select, Tabs } from '@psp/ui';
import type { Rollout, RolloutTarget } from '@psp/contracts';
import { errorMessage } from '../api/client';
import { api } from '../api/resources';
import { ResourceList } from '../crud/ResourceList';
import { releasesResource } from '../crud/definitions';
import { createTranslator } from '../i18n/extra';
import { statusTone } from '../lib/badges';
import { usePrefsStore } from '../store/prefs';

const TARGET_KINDS = ['machines', 'location', 'franchise', 'region', 'organization', 'hardwareProfile', 'channel', 'tags', 'percentage'] as const;

function RolloutsTab({ tr }: { tr: ReturnType<typeof createTranslator> }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Rollout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const [name, setName] = useState('');
  const [releaseId, setReleaseId] = useState('');
  const [targetKind, setTargetKind] = useState<(typeof TARGET_KINDS)[number]>('machines');
  const [targetValue, setTargetValue] = useState('');
  const [percent, setPercent] = useState<number | null>(20);

  useEffect(() => {
    api.rollouts
      .list({ page: 1, pageSize: 100 })
      .then((res) => {
        setRows(res.items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(errorMessage(err));
        setLoading(false);
      });
  }, [reload]);

  function buildTarget(): RolloutTarget {
    switch (targetKind) {
      case 'machines':
        return { kind: 'machines', machineIds: targetValue.split(',').map((s) => s.trim()).filter(Boolean) };
      case 'location':
        return { kind: 'location', locationId: targetValue.trim() };
      case 'franchise':
        return { kind: 'franchise', franchiseId: targetValue.trim() };
      case 'region':
        return { kind: 'region', regionId: targetValue.trim() };
      case 'organization':
        return { kind: 'organization', organizationId: targetValue.trim() };
      case 'hardwareProfile':
        return { kind: 'hardwareProfile', hardwareProfileId: targetValue.trim() };
      case 'channel':
        return { kind: 'channel', channel: targetValue.trim() as never };
      case 'tags':
        return { kind: 'tags', tags: targetValue.split(',').map((s) => s.trim()).filter(Boolean) };
      case 'percentage':
      default:
        return { kind: 'percentage', percent: percent ?? 10, seed: releaseId || 'seed' };
    }
  }

  async function handleCreate() {
    try {
      await api.rollouts.create({ name, releaseId, targets: [buildTarget()], schedule: {} });
      setName('');
      setTargetValue('');
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      {error !== undefined ? (
        <Alert tone="danger" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <Field label={tr.t('admin.field.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={tr.t('admin.field.releaseId')}>
          <Input value={releaseId} onChange={(e) => setReleaseId(e.target.value)} />
        </Field>
        <Field label={tr.t('admin.rollouts.targetKind')}>
          <Select options={TARGET_KINDS.map((k) => ({ value: k, label: k }))} value={targetKind} onChange={(e) => setTargetKind(e.target.value as (typeof TARGET_KINDS)[number])} />
        </Field>
        {targetKind === 'percentage' ? (
          <Field label={tr.t('admin.rollouts.percent')}>
            <NumberInput value={percent} min={1} max={100} onChange={setPercent} />
          </Field>
        ) : (
          <Field label={tr.t('admin.field.scopeId')}>
            <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="id1, id2" />
          </Field>
        )}
        <Button variant="primary" onClick={() => void handleCreate()}>
          {tr.t('admin.rollouts.newRollout')}
        </Button>
      </div>
      <DataTable
        columns={[
          { key: 'name', header: tr.t('admin.field.name'), render: (r) => r.name },
          { key: 'releaseId', header: tr.t('admin.field.releaseId'), render: (r) => r.releaseId },
          { key: 'status', header: tr.t('admin.field.status'), render: (r) => <Badge tone={statusTone(r.status, 'rollout')}>{r.status}</Badge> },
          { key: 'isRollback', header: tr.t('admin.rollouts.isRollback'), render: (r) => (r.isRollback ? '✓' : '—') },
        ]}
        rows={rows}
        rowKey="id"
        loading={loading}
        empty={{ title: tr.t('admin.common.vacio') }}
        onRowClick={(r) => navigate(`/releases/rollouts/${r.id}`)}
      />
    </>
  );
}

export function Releases() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [tab, setTab] = useState<'releases' | 'rollouts'>('releases');
  return (
    <>
      <PageHeader title={tr.t('admin.nav.releases')}>
        <Tabs
          items={[
            { key: 'releases', label: tr.t('admin.nav.releases') },
            { key: 'rollouts', label: tr.t('admin.nav.rollouts') },
          ]}
          value={tab}
          onChange={(k) => setTab(k as 'releases' | 'rollouts')}
        />
      </PageHeader>
      {tab === 'releases' ? <ResourceList definition={releasesResource} /> : <RolloutsTab tr={tr} />}
    </>
  );
}
