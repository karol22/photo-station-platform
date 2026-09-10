/** Inventario de máquinas (requisito 13.1): filtros, agrupar, acciones masivas con previsualización. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, ConfirmDialog, DataTable, FilterBar, Input, PageHeader, Select } from '@psp/ui';
import type { DataTableColumn } from '@psp/ui';
import type { Machine } from '@psp/contracts';
import { MachineStatus } from '@psp/contracts';
import { errorMessage } from '../../api/client';
import { api } from '../../api/resources';
import { bulk } from '../../api/special';
import { createTranslator } from '../../i18n/extra';
import { onlineTone, statusTone } from '../../lib/badges';
import { relativeTime } from '../../lib/format';
import { hasAnyPermission } from '../../lib/navFilter';
import { usePrefsStore } from '../../store/prefs';
import { useScopeFilter } from '../../store/scope';
import { useSessionStore } from '../../store/session';

const COMMANDS = ['set_maintenance', 'sync_now', 'print_test', 'restart_app', 'reload_bundle'] as const;

export function MachinesList() {
  const principal = useSessionStore((s) => s.principal);
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const scope = useScopeFilter();
  const navigate = useNavigate();
  const canAct = hasAnyPermission(principal, ['machines.commands', 'machines.maintenance']);

  const [rows, setRows] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [reload, setReload] = useState(0);
  const [command, setCommand] = useState<(typeof COMMANDS)[number]>('sync_now');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{ count: number; confirmToken: string; affected: string[] } | undefined>();
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    api.machines
      .list({ q, page: 1, pageSize: 200, filters: status ? { status } : {}, organizationId: scope.organizationId, franchiseId: scope.franchiseId, regionId: scope.regionId, locationId: scope.locationId })
      .then((res) => {
        if (!cancelled) {
          setRows(res.items);
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
  }, [q, status, scope.organizationId, scope.franchiseId, scope.regionId, scope.locationId, reload]);

  const sorted = useMemo(() => {
    if (!groupBy) return rows;
    const keyOf = (m: Machine): string => {
      if (groupBy === 'franchise') return m.franchiseId ?? '';
      if (groupBy === 'hardware') return m.hardwareProfileId;
      if (groupBy === 'version') return m.softwareVersion ?? '';
      if (groupBy === 'tag') return m.tags[0] ?? '';
      return '';
    };
    return [...rows].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  }, [rows, groupBy]);

  const columns: DataTableColumn<Machine>[] = [
    { key: 'name', header: tr.t('admin.field.name'), render: (m) => m.name },
    { key: 'code', header: tr.t('admin.field.code'), render: (m) => m.code },
    { key: 'organizationId', header: tr.t('admin.field.organizationId'), render: (m) => m.organizationId },
    { key: 'franchiseId', header: tr.t('admin.field.franchiseId'), render: (m) => m.franchiseId ?? '—' },
    { key: 'locationId', header: tr.t('admin.field.locationId'), render: (m) => m.locationId ?? '—' },
    { key: 'hardwareProfileId', header: tr.t('admin.field.hardwareProfileId'), render: (m) => m.hardwareProfileId },
    { key: 'softwareVersion', header: tr.t('admin.machines.softwareVersion'), render: (m) => m.softwareVersion ?? '—' },
    { key: 'bundleVersion', header: tr.t('admin.machines.bundleVersion'), render: (m) => m.bundleVersion ?? '—' },
    { key: 'online', header: tr.t('admin.machines.online'), render: (m) => <Badge tone={onlineTone(m.online)}>{m.online ? '●' : relativeTime(m.lastSeenAt, new Date(), locale)}</Badge> },
    { key: 'status', header: tr.t('admin.field.status'), render: (m) => <Badge tone={statusTone(m.status, 'machine')}>{tr.t(`admin.status.${m.status}`)}</Badge> },
    { key: 'tags', header: tr.t('admin.field.tags'), render: (m) => m.tags.join(', ') || '—' },
  ];

  async function handlePreview() {
    const targets = selected.map((id) => ({ level: 'machine' as const, id }));
    const payload = command === 'set_maintenance' ? { type: command, enabled: true } : { type: command };
    const res = await bulk.preview({ action: 'command', targets, payload });
    setPreview({ count: res.count, confirmToken: res.confirmToken, affected: res.affected.map((a) => a.name) });
  }

  async function handleApply() {
    if (!preview) return;
    setApplying(true);
    try {
      const targets = selected.map((id) => ({ level: 'machine' as const, id }));
      const payload = command === 'set_maintenance' ? { type: command, enabled: true } : { type: command };
      await bulk.apply({ action: 'command', targets, payload, confirmToken: preview.confirmToken, reason: reason || undefined });
      setPreview(undefined);
      setSelected([]);
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <PageHeader title={tr.t('admin.machines.title')} />
      {error !== undefined ? (
        <Alert tone="danger" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      ) : null}
      <DataTable
        toolbar={
          <FilterBar>
            <Input placeholder={tr.t('admin.common.filtros')} value={q} onChange={(e) => setQ(e.target.value)} block />
            <Select placeholder={tr.t('admin.machines.filterStatus')} options={MachineStatus.options.map((v) => ({ value: v, label: tr.t(`admin.status.${v}`) }))} value={status} onChange={(e) => setStatus(e.target.value)} />
            <Select
              placeholder={tr.t('admin.action.groupBy')}
              options={[
                { value: 'franchise', label: tr.t('admin.machines.groupByFranchise') },
                { value: 'hardware', label: tr.t('admin.machines.groupByHardware') },
                { value: 'version', label: tr.t('admin.machines.groupByVersion') },
                { value: 'tag', label: tr.t('admin.machines.groupByTag') },
              ]}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            />
          </FilterBar>
        }
        columns={columns}
        rows={sorted}
        rowKey="id"
        loading={loading}
        empty={{ title: tr.t('admin.common.vacio') }}
        onRowClick={(m) => navigate(`/machines/${m.id}`)}
        selectable={canAct}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        bulkActions={
          canAct ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Select options={COMMANDS.map((c) => ({ value: c, label: tr.t(`admin.machines.command.${c}`) }))} value={command} onChange={(e) => setCommand(e.target.value as (typeof COMMANDS)[number])} />
              <Input placeholder={tr.t('admin.machines.commandReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button size="sm" onClick={() => void handlePreview()}>
                {tr.t('admin.action.previewChange')}
              </Button>
            </div>
          ) : undefined
        }
      />
      <ConfirmDialog
        open={preview !== undefined}
        title={tr.t('admin.machines.bulkPreviewTitle')}
        body={`${preview?.count ?? 0} ${tr.t('admin.machines.affectedMachines')}`}
        affectedCount={preview?.count}
        confirmLabel={tr.t('admin.action.applyChange')}
        cancelLabel={tr.t('admin.action.cancel')}
        loading={applying}
        onConfirm={() => void handleApply()}
        onCancel={() => setPreview(undefined)}
      >
        {preview ? <ul>{preview.affected.slice(0, 10).map((name, i) => <li key={i}>{name}</li>)}</ul> : null}
      </ConfirmDialog>
    </>
  );
}
