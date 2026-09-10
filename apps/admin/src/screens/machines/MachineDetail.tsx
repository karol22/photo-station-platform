/** Detalle de máquina (requisito 13.2): resumen, configuración, productos, branding, contenido,
 * sesiones, métricas, eventos, mantenimiento, releases, auditoría, notas y responsable local. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  Input,
  KeyValue,
  LockTag,
  PageHeader,
  ProvenanceTag,
  Select,
  Skeleton,
  Tabs,
  Textarea,
  Timeline,
} from '@psp/ui';
import type { ProvenanceLevel } from '@psp/ui';
import { CONFIG_KEYS, type EffectiveConfigView, type KioskBundle, type Machine, type MachineEvent, type SessionRecord } from '@psp/contracts';
import { errorMessage } from '../../api/client';
import { api } from '../../api/resources';
import { audit as auditApi, config as configApi, machines as machinesApi, metrics as metricsApi } from '../../api/special';
import { createTranslator } from '../../i18n/extra';
import { onlineTone, statusTone } from '../../lib/badges';
import { dateTime } from '../../lib/format';
import { hasAnyPermission } from '../../lib/navFilter';
import { usePrefsStore } from '../../store/prefs';
import { useSessionStore } from '../../store/session';

const COMMANDS = ['set_maintenance', 'sync_now', 'print_test', 'restart_app', 'reload_bundle'] as const;
const TABS = ['summary', 'config', 'products', 'branding', 'content', 'sessions', 'metrics', 'timeline', 'maintenance', 'releases', 'audit', 'notes', 'contact'] as const;

export function MachineDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const principal = useSessionStore((s) => s.principal);
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const canEdit = hasAnyPermission(principal, ['machines.edit']);
  const canCommand = hasAnyPermission(principal, ['machines.commands']);

  const [machine, setMachine] = useState<Machine>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<(typeof TABS)[number]>('summary');
  const [command, setCommand] = useState<(typeof COMMANDS)[number]>('sync_now');
  const [commandReason, setCommandReason] = useState('');
  const [confirmCommand, setConfirmCommand] = useState(false);

  useEffect(() => {
    api.machines.get(id).then(setMachine).catch((err: unknown) => setError(errorMessage(err)));
  }, [id]);

  if (error !== undefined) return <Alert tone="danger">{error}</Alert>;
  if (!machine) return <Skeleton variant="rect" height={300} />;

  return (
    <>
      <PageHeader
        title={machine.name}
        subtitle={machine.code}
        meta={<Badge tone={statusTone(machine.status, 'machine')}>{tr.t(`admin.status.${machine.status}`)}</Badge>}
        actions={
          canCommand ? (
            <Button variant="primary" onClick={() => setConfirmCommand(true)}>
              {tr.t('admin.action.sendCommand')}
            </Button>
          ) : undefined
        }
      >
        <Tabs
          items={TABS.map((key) => ({ key, label: tr.t(`admin.machines.tab.${key === 'notes' ? 'notes' : key === 'contact' ? 'contact' : key}`) }))}
          value={tab}
          onChange={(k) => setTab(k as (typeof TABS)[number])}
        />
      </PageHeader>

      {tab === 'summary' ? <SummaryTab machine={machine} tr={tr} /> : null}
      {tab === 'config' ? <ConfigTab machineId={id} canEdit={canEdit} tr={tr} /> : null}
      {tab === 'products' ? <ProductsTab machineId={id} tr={tr} /> : null}
      {tab === 'branding' ? <BrandingTab machineId={id} tr={tr} /> : null}
      {tab === 'content' ? <ContentTab machineId={id} tr={tr} /> : null}
      {tab === 'sessions' ? <SessionsTab machineId={id} tr={tr} /> : null}
      {tab === 'metrics' ? <MetricsTab machineId={id} tr={tr} /> : null}
      {tab === 'timeline' ? <TimelineTab machineId={id} tr={tr} locale={locale} /> : null}
      {tab === 'maintenance' ? <MaintenanceTab machineId={id} tr={tr} canEdit={canEdit} /> : null}
      {tab === 'releases' ? <ReleasesTab machine={machine} tr={tr} /> : null}
      {tab === 'audit' ? <AuditTab machineId={id} tr={tr} /> : null}
      {tab === 'notes' ? <NotesTab machine={machine} tr={tr} canEdit={canEdit} onSaved={setMachine} /> : null}
      {tab === 'contact' ? <ContactTab machine={machine} tr={tr} canEdit={canEdit} onSaved={setMachine} /> : null}

      <ConfirmDialog
        open={confirmCommand}
        title={tr.t('admin.action.sendCommand')}
        body={tr.t(`admin.machines.command.${command}`)}
        confirmLabel={tr.t('admin.action.confirm')}
        cancelLabel={tr.t('admin.action.cancel')}
        onConfirm={() => {
          setConfirmCommand(false);
          void machinesApi.command(id, { type: command }, commandReason || undefined);
        }}
        onCancel={() => setConfirmCommand(false)}
      >
        <Field label={tr.t('admin.machines.selectCommand')}>
          <Select options={COMMANDS.map((c) => ({ value: c, label: tr.t(`admin.machines.command.${c}`) }))} value={command} onChange={(e) => setCommand(e.target.value as (typeof COMMANDS)[number])} block />
        </Field>
        <Field label={tr.t('admin.machines.commandReason')}>
          <Input value={commandReason} onChange={(e) => setCommandReason(e.target.value)} block />
        </Field>
      </ConfirmDialog>
    </>
  );
}

type Tr = ReturnType<typeof createTranslator>;

function SummaryTab({ machine, tr }: { machine: Machine; tr: Tr }) {
  return (
    <KeyValue
      columns={2}
      items={[
        { key: 'status', label: tr.t('admin.field.status'), value: <Badge tone={statusTone(machine.status, 'machine')}>{tr.t(`admin.status.${machine.status}`)}</Badge> },
        { key: 'online', label: tr.t('admin.machines.online'), value: <Badge tone={onlineTone(machine.online)}>{machine.online ? '●' : tr.t(`admin.machines.lastSeen`)}</Badge> },
        { key: 'lastSeenAt', label: tr.t('admin.machines.lastHeartbeat'), value: dateTime(machine.lastSeenAt, tr.locale) },
        { key: 'capabilities', label: tr.t('admin.machines.capabilities'), value: machine.capabilities.map((c) => `${c.key}${c.operational ? '' : ' ⚠'}`).join(', ') },
        { key: 'printers', label: tr.t('admin.machines.printers'), value: machine.printers.map((p) => p.name).join(', ') },
        { key: 'hardwareProfileId', label: tr.t('admin.field.hardwareProfileId'), value: machine.hardwareProfileId },
      ]}
    />
  );
}

const PROVENANCE_LABEL: Record<string, string> = {
  platform: 'admin.common.nivel.platform',
  organization: 'admin.common.nivel.organization',
  franchise: 'admin.common.nivel.franchise',
  region: 'admin.common.nivel.region',
  location: 'admin.common.nivel.location',
  machine: 'admin.common.nivel.machine',
  blueprint: 'admin.field.blueprintId',
  campaign: 'admin.nav.campaigns',
  default: 'admin.common.nivel.platform',
};

function ConfigTab({ machineId, canEdit, tr, group }: { machineId: string; canEdit: boolean; tr: Tr; group?: string }) {
  const [view, setView] = useState<EffectiveConfigView>();
  const [error, setError] = useState<string>();
  const [editingKey, setEditingKey] = useState<string>();
  const [newValue, setNewValue] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    configApi
      .effective('machine', machineId)
      .then(setView)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [machineId, reload]);

  if (error !== undefined) return <Alert tone="danger">{error}</Alert>;
  if (!view) return <Skeleton variant="rect" height={200} />;

  const definitions = group ? CONFIG_KEYS.filter((d) => d.group === group) : CONFIG_KEYS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {definitions.map((def) => {
        const value = view.effective.values[def.key];
        const provenance = view.effective.provenance[def.key];
        const lock = view.effective.locks[def.key];
        return (
          <div key={def.key} style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #eee', padding: '8px 0' }}>
            <code style={{ minWidth: 220 }}>{def.key}</code>
            <span style={{ flex: 1 }}>{def.type === 'color' && typeof value === 'string' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, background: value, display: 'inline-block', borderRadius: 3, border: '1px solid #ccc' }} />{value}</span> : JSON.stringify(value)}</span>
            {provenance ? <ProvenanceTag level={provenance.level as ProvenanceLevel} label={tr.t(PROVENANCE_LABEL[provenance.level] ?? 'admin.common.nivel.platform')} overridden={provenance.level === 'machine'} /> : null}
            {lock ? <LockTag policy={lock.policy} label={lock.policy} /> : null}
            {canEdit ? (
              editingKey === def.key ? (
                <span style={{ display: 'flex', gap: 4 }}>
                  <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={tr.t('admin.machines.overrideValue')} />
                  <Button
                    size="sm"
                    onClick={() => {
                      let parsed: unknown = newValue;
                      try {
                        parsed = JSON.parse(newValue);
                      } catch {
                        /* se envía como texto plano */
                      }
                      void configApi.patch({ level: 'machine', entityId: machineId, values: { [def.key]: parsed as never } }).then(() => {
                        setEditingKey(undefined);
                        setReload((n) => n + 1);
                      });
                    }}
                  >
                    {tr.t('admin.action.save')}
                  </Button>
                </span>
              ) : (
                <span style={{ display: 'flex', gap: 4 }}>
                  <Button size="sm" variant="secondary" onClick={() => { setEditingKey(def.key); setNewValue(JSON.stringify(value)); }}>
                    {tr.t('admin.action.edit')}
                  </Button>
                  {provenance?.level === 'machine' ? (
                    <Button size="sm" variant="ghost" title={tr.t('admin.machines.willInheritOnRemove')} onClick={() => void configApi.patch({ level: 'machine', entityId: machineId, unset: [def.key] }).then(() => setReload((n) => n + 1))}>
                      {tr.t('admin.action.removeOverride')}
                    </Button>
                  ) : null}
                </span>
              )
            ) : null}
          </div>
        );
      })}
      {view.effective.rejected.length > 0 ? (
        <Alert tone="warn" title={tr.t('admin.machines.rejectedKeys')}>
          {view.effective.rejected.map((r) => `${r.key} (${r.level}): ${r.reason}`).join(' · ')}
        </Alert>
      ) : null}
    </div>
  );
}

function BrandingTab({ machineId, tr }: { machineId: string; tr: Tr }) {
  return <ConfigTab machineId={machineId} canEdit={false} tr={tr} group="branding" />;
}

function ProductsTab({ machineId, tr }: { machineId: string; tr: Tr }) {
  const [bundle, setBundle] = useState<KioskBundle>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    machinesApi.bundle(machineId).then(setBundle).catch((err: unknown) => setError(errorMessage(err)));
  }, [machineId]);
  if (error !== undefined) return <Alert tone="danger">{error}</Alert>;
  if (!bundle) return <Skeleton variant="rect" height={200} />;
  return (
    <DataTable
      columns={[
        { key: 'name', header: tr.t('admin.field.name'), render: (p) => tr.tl(p.displayName) },
        { key: 'status', header: tr.t('admin.field.status'), render: (p) => p.status },
        { key: 'price', header: tr.t('admin.machines.resolvedPrice'), render: (p) => { const price = bundle.prices.find((pr) => pr.productId === p.id); return price ? tr.formatMoney(price.final) : '—'; } },
      ]}
      rows={bundle.products}
      rowKey="id"
      empty={{ title: tr.t('admin.common.vacio') }}
    />
  );
}

function ContentTab({ machineId, tr }: { machineId: string; tr: Tr }) {
  const [bundle, setBundle] = useState<KioskBundle>();
  useEffect(() => {
    void machinesApi.bundle(machineId).then(setBundle);
  }, [machineId]);
  if (!bundle) return <Skeleton variant="rect" height={160} />;
  return (
    <KeyValue
      columns={1}
      items={[
        { key: 'templates', label: tr.t('admin.nav.templates'), value: bundle.templates.map((t) => tr.tl(t.name)).join(', ') || '—' },
        { key: 'presets', label: tr.t('admin.nav.presets'), value: bundle.presets.map((p) => tr.tl(p.name)).join(', ') || '—' },
        { key: 'experiences', label: tr.t('admin.nav.experiences'), value: bundle.experiences.map((e) => tr.tl(e.name)).join(', ') || '—' },
      ]}
    />
  );
}

function SessionsTab({ machineId, tr }: { machineId: string; tr: Tr }) {
  const [rows, setRows] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.sessions.list({ page: 1, pageSize: 100, machineId }).then((res) => { setRows(res.items); setLoading(false); }).catch(() => setLoading(false));
  }, [machineId]);
  return (
    <DataTable
      columns={[
        { key: 'code', header: tr.t('admin.field.code'), render: (s) => s.code },
        { key: 'productName', header: tr.t('admin.field.productId'), render: (s) => s.productName },
        { key: 'stage', header: tr.t('admin.sessions.stage'), render: (s) => s.stage },
        { key: 'startedAt', header: tr.t('admin.field.startsAt'), render: (s) => dateTime(s.startedAt, tr.locale) },
      ]}
      rows={rows}
      rowKey="id"
      loading={loading}
      empty={{ title: tr.t('admin.common.vacio') }}
    />
  );
}

function MetricsTab({ machineId, tr }: { machineId: string; tr: Tr }) {
  const [text, setText] = useState<string>();
  useEffect(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 86400 * 1000);
    metricsApi
      .query({ machineIds: [machineId], from: from.toISOString(), to: to.toISOString(), granularity: 'day', includeDemo: true })
      .then((res) => setText(`${tr.t('admin.metrics.totals')}: ${res.totals.sessions.started} · ${tr.t('admin.dashboard.sessionsCompleted')}: ${res.totals.sessions.completed}`))
      .catch(() => setText(tr.t('admin.dashboard.noData')));
  }, [machineId, tr]);
  return <p>{text ?? '…'}</p>;
}

function TimelineTab({ machineId, tr, locale }: { machineId: string; tr: Tr; locale: string }) {
  const [events, setEvents] = useState<MachineEvent[]>([]);
  useEffect(() => {
    void machinesApi.timeline(machineId, { limit: 200 }).then(setEvents);
  }, [machineId]);
  return (
    <Timeline
      items={events.map((e) => ({ key: e.id, at: e.at, title: e.type, body: e.message, tone: e.severity === 'error' ? 'danger' : e.severity === 'warning' ? 'warn' : 'neutral' }))}
      formatAt={(at) => dateTime(at, locale as never)}
      label={tr.t('admin.machines.tab.timeline')}
    />
  );
}

function MaintenanceTab({ machineId, tr, canEdit }: { machineId: string; tr: Tr; canEdit: boolean }) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [consumables, setConsumables] = useState<Record<string, unknown>[]>([]);
  const [notes, setNotes] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    void api.maintenanceLogs.list({ page: 1, pageSize: 50, machineId }).then((res) => setLogs(res.items));
    void api.consumables.list({ page: 1, pageSize: 50, machineId }).then((res) => setConsumables(res.items));
  }, [machineId, reload]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3>{tr.t('admin.machines.consumables')}</h3>
        <DataTable
          columns={[
            { key: 'type', header: tr.t('admin.field.consumableType'), render: (r) => String(r['type']) },
            { key: 'estimatedRemaining', header: tr.t('admin.field.qty'), render: (r) => String(r['estimatedRemaining']) },
          ]}
          rows={consumables}
          rowKey={(r) => String(r['id'])}
          empty={{ title: tr.t('admin.common.vacio') }}
        />
      </div>
      <div>
        <h3>{tr.t('admin.nav.maintenance')}</h3>
        <DataTable
          columns={[
            { key: 'type', header: tr.t('admin.field.type'), render: (r) => String(r['type']) },
            { key: 'performedAt', header: tr.t('admin.field.startsAt'), render: (r) => dateTime(String(r['performedAt']), tr.locale) },
            { key: 'notes', header: tr.t('admin.field.notes'), render: (r) => String(r['notes'] ?? '—') },
          ]}
          rows={logs}
          rowKey={(r) => String(r['id'])}
          empty={{ title: tr.t('admin.common.vacio') }}
        />
        {canEdit ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Input placeholder={tr.t('admin.field.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} block />
            <Button
              onClick={() =>
                void api.maintenanceLogs
                  .create({ machineId, type: 'inspection', performedAt: new Date().toISOString(), performedBy: { type: 'user' }, notes })
                  .then(() => {
                    setNotes('');
                    setReload((n) => n + 1);
                  })
              }
            >
              {tr.t('admin.machines.registerMaintenance')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReleasesTab({ machine, tr }: { machine: Machine; tr: Tr }) {
  return (
    <KeyValue
      columns={2}
      items={[
        { key: 'channel', label: tr.t('admin.field.releaseChannel'), value: machine.releaseChannel },
        { key: 'softwareVersion', label: tr.t('admin.machines.softwareVersion'), value: machine.softwareVersion ?? '—' },
        { key: 'targetSoftwareVersion', label: tr.t('admin.action.next'), value: machine.targetSoftwareVersion ?? '—' },
        { key: 'bundleVersion', label: tr.t('admin.machines.bundleVersion'), value: machine.bundleVersion ?? '—' },
        { key: 'targetBundleVersion', label: tr.t('admin.action.next'), value: machine.targetBundleVersion ?? '—' },
      ]}
    />
  );
}

function AuditTab({ machineId, tr }: { machineId: string; tr: Tr }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    void auditApi.list({ page: 1, pageSize: 50, entityId: machineId, entityType: 'machine' }).then((res) => setRows(res.items as unknown as Record<string, unknown>[]));
  }, [machineId]);
  return (
    <DataTable
      columns={[
        { key: 'at', header: tr.t('admin.field.startsAt'), render: (r) => dateTime(String(r['at']), tr.locale) },
        { key: 'actor', header: tr.t('admin.audit.actor'), render: (r) => JSON.stringify(r['actor']) },
        { key: 'action', header: tr.t('admin.audit.action'), render: (r) => String(r['action']) },
      ]}
      rows={rows}
      rowKey={(r) => String(r['id'])}
      empty={{ title: tr.t('admin.common.vacio') }}
    />
  );
}

function NotesTab({ machine, tr, canEdit, onSaved }: { machine: Machine; tr: Tr; canEdit: boolean; onSaved: (m: Machine) => void }) {
  const [notes, setNotes] = useState(machine.notes ?? '');
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }}>
      <Textarea value={notes} disabled={!canEdit} rows={8} onChange={(e) => setNotes(e.target.value)} />
      {canEdit ? (
        <Button
          loading={saving}
          onClick={() => {
            setSaving(true);
            void api.machines
              .update(machine.id, { notes })
              .then(onSaved)
              .finally(() => setSaving(false));
          }}
        >
          {tr.t('admin.action.save')}
        </Button>
      ) : null}
    </div>
  );
}

function ContactTab({ machine, tr, canEdit, onSaved }: { machine: Machine; tr: Tr; canEdit: boolean; onSaved: (m: Machine) => void }) {
  const [name, setName] = useState(machine.localContact.name ?? '');
  const [phone, setPhone] = useState(machine.localContact.phone ?? '');
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
      <Field label={tr.t('admin.field.name')}>
        <Input value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} block />
      </Field>
      <Field label={tr.t('admin.field.phone')}>
        <Input value={phone} disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} block />
      </Field>
      {canEdit ? (
        <Button
          loading={saving}
          onClick={() => {
            setSaving(true);
            void api.machines
              .update(machine.id, { localContact: { ...machine.localContact, name, phone } })
              .then(onSaved)
              .finally(() => setSaving(false));
          }}
        >
          {tr.t('admin.action.save')}
        </Button>
      ) : null}
    </div>
  );
}
