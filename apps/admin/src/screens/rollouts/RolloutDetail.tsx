/** Detalle de despliegue: objetivos, acciones (start/pause/resume/cancel/expand) y máquinas por estado. */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Badge, Button, DataTable, KeyValue, PageHeader, Skeleton } from '@psp/ui';
import type { MachineReleaseState, Rollout } from '@psp/contracts';
import { errorMessage } from '../../api/client';
import { api } from '../../api/resources';
import { rollouts as rolloutsApi } from '../../api/special';
import { createTranslator } from '../../i18n/extra';
import { statusTone } from '../../lib/badges';
import { dateTime } from '../../lib/format';
import { usePrefsStore } from '../../store/prefs';

const ACTIONS = ['start', 'pause', 'resume', 'cancel', 'expand'] as const;

export function RolloutDetail() {
  const { id = '' } = useParams();
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [rollout, setRollout] = useState<Rollout>();
  const [machines, setMachines] = useState<MachineReleaseState[]>([]);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.rollouts.get(id).then(setRollout).catch((err: unknown) => setError(errorMessage(err)));
    rolloutsApi.machines(id).then(setMachines).catch(() => undefined);
  }, [id, reload]);

  async function handleAction(action: (typeof ACTIONS)[number]) {
    try {
      await rolloutsApi.action(id, action);
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleRollback() {
    if (!rollout) return;
    try {
      await api.rollouts.create({ name: `${rollout.name} (rollback)`, releaseId: rollout.releaseId, targets: rollout.targets, schedule: {}, isRollback: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (error !== undefined) return <Alert tone="danger">{error}</Alert>;
  if (!rollout) return <Skeleton variant="rect" height={200} />;

  return (
    <>
      <PageHeader
        title={rollout.name}
        meta={<Badge tone={statusTone(rollout.status, 'rollout')}>{rollout.status}</Badge>}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {ACTIONS.map((action) => (
              <Button key={action} size="sm" onClick={() => void handleAction(action)}>
                {tr.t(`admin.action.${action === 'cancel' ? 'cancelRollout' : action}`)}
              </Button>
            ))}
            <Button size="sm" variant="danger" onClick={() => void handleRollback()}>
              {tr.t('admin.rollouts.createRollback')}
            </Button>
          </div>
        }
      />
      <KeyValue
        columns={2}
        items={[
          { key: 'releaseId', label: tr.t('admin.field.releaseId'), value: rollout.releaseId },
          { key: 'targets', label: tr.t('admin.rollouts.targetsSummary'), value: rollout.targets.map((t) => t.kind).join(', ') },
          { key: 'window', label: tr.t('admin.rollouts.window'), value: `${rollout.schedule.windowStartLocal ?? '—'} – ${rollout.schedule.windowEndLocal ?? '—'}` },
        ]}
      />
      <h3>{tr.t('admin.rollouts.machinesTable')}</h3>
      <DataTable
        columns={[
          { key: 'machineId', header: tr.t('admin.field.machineId'), render: (m) => m.machineId },
          { key: 'status', header: tr.t('admin.field.status'), render: (m) => <Badge tone={statusTone(m.status, 'machineRelease')}>{tr.t(`admin.release.${m.status}`)}</Badge> },
          { key: 'targetVersion', header: tr.t('admin.field.version'), render: (m) => m.targetVersion ?? '—' },
          { key: 'updatedAt', header: tr.t('admin.field.updatedAt'), render: (m) => dateTime(m.updatedAt, tr.locale) },
        ]}
        rows={machines}
        rowKey="machineId"
        empty={{ title: tr.t('admin.common.vacio') }}
      />
    </>
  );
}
