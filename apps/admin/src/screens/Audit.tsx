/** Auditoría (requisito 24): filtros por entidad, actor, acción y fecha; antes/después. */
import { useEffect, useMemo, useState } from 'react';
import { Alert, DataTable, Drawer, FilterBar, Input, PageHeader } from '@psp/ui';
import type { AuditEntry } from '@psp/contracts';
import { errorMessage } from '../api/client';
import { audit as auditApi } from '../api/special';
import { createTranslator } from '../i18n/extra';
import { dateTime } from '../lib/format';
import { usePrefsStore } from '../store/prefs';

export function Audit() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [entityType, setEntityType] = useState('');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [selected, setSelected] = useState<AuditEntry>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    auditApi
      .list({ page: 1, pageSize: 100, entityType: entityType || undefined, actorId: actorId || undefined, action: action || undefined })
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
  }, [entityType, actorId, action]);

  return (
    <>
      <PageHeader title={tr.t('admin.nav.audit')} />
      {error !== undefined ? <Alert tone="danger">{error}</Alert> : null}
      <DataTable
        toolbar={
          <FilterBar>
            <Input placeholder={tr.t('admin.audit.entityType')} value={entityType} onChange={(e) => setEntityType(e.target.value)} />
            <Input placeholder={tr.t('admin.audit.actor')} value={actorId} onChange={(e) => setActorId(e.target.value)} />
            <Input placeholder={tr.t('admin.audit.action')} value={action} onChange={(e) => setAction(e.target.value)} />
          </FilterBar>
        }
        columns={[
          { key: 'at', header: tr.t('admin.field.startsAt'), render: (r) => dateTime(r.at, tr.locale) },
          { key: 'actor', header: tr.t('admin.audit.actor'), render: (r) => r.actor.name ?? r.actor.type },
          { key: 'action', header: tr.t('admin.audit.action'), render: (r) => r.action },
          { key: 'entityType', header: tr.t('admin.audit.entityType'), render: (r) => r.entityType },
          { key: 'origin', header: tr.t('admin.audit.origin'), render: (r) => r.origin },
        ]}
        rows={rows}
        rowKey="id"
        loading={loading}
        empty={{ title: tr.t('admin.common.vacio') }}
        onRowClick={setSelected}
      />
      <Drawer open={selected !== undefined} title={selected?.action} onClose={() => setSelected(undefined)}>
        {selected ? (
          <>
            <h4>{tr.t('admin.audit.before')}</h4>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(selected.before, null, 2) ?? '—'}</pre>
            <h4>{tr.t('admin.audit.after')}</h4>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(selected.after, null, 2) ?? '—'}</pre>
          </>
        ) : null}
      </Drawer>
    </>
  );
}
