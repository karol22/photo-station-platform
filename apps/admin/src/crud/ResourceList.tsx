/** Lista genérica: `DataTable` + `FilterBar` + búsqueda + paginación + exportar CSV + selección. */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, ConfirmDialog, DataTable, EmptyState, FilterBar, Input, PageHeader, Select } from '@psp/ui';
import type { DataTableColumn, DataTableSort } from '@psp/ui';
import { errorMessage } from '../api/client';
import { importExport } from '../api/special';
import { createTranslator } from '../i18n/extra';
import { DEFAULT_PAGE_SIZE, toAdminListQuery, type ListState } from '../lib/listQuery';
import { hasAnyPermission } from '../lib/navFilter';
import { usePrefsStore } from '../store/prefs';
import { useScopeFilter } from '../store/scope';
import { useSessionStore } from '../store/session';
import { ResourceForm } from './ResourceForm';
import type { ResourceDefinition } from './types';

const EMPTY_STATE: ListState = { q: '', page: 1, pageSize: DEFAULT_PAGE_SIZE, filters: {} };

export function ResourceList({ definition }: { definition: ResourceDefinition }) {
  const principal = useSessionStore((s) => s.principal);
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const scope = useScopeFilter();
  const canView = hasAnyPermission(principal, [definition.permissions.view]);
  const canEdit = definition.permissions.edit !== undefined && hasAnyPermission(principal, [definition.permissions.edit]);

  const [state, setState] = useState<ListState>(EMPTY_STATE);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [sort, setSort] = useState<DataTableSort>();
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | 'new' | undefined>();
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const filtersKey = JSON.stringify(state.filters);
  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    const sortParam = sort ? (sort.direction === 'desc' ? `-${sort.key}` : sort.key) : undefined;
    const query = toAdminListQuery({ ...state, sort: sortParam }, scope);
    definition.resource
      .list(query)
      .then((res) => {
        if (cancelled) return;
        setRows(res.items);
        setTotal(res.total);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, canView, state.q, state.page, state.pageSize, filtersKey, sort?.key, sort?.direction, scope.organizationId, scope.franchiseId, scope.regionId, scope.locationId, reloadTick]);

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () =>
      definition.columns.map((c) => ({
        key: c.key,
        header: tr.t(c.labelKey),
        render: c.render,
        sortable: c.sortable,
        width: c.width,
        align: c.align,
      })),
    [definition, tr],
  );

  if (!canView) {
    return <EmptyState title={tr.t('admin.error.forbidden')} tone="danger" />;
  }

  async function handleExport() {
    if (!definition.exportEntityType) return;
    const text = await importExport.exportCsv(definition.exportEntityType, toAdminListQuery(state, scope));
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${definition.key}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkDelete() {
    await Promise.all(selected.map((id) => definition.resource.remove(id)));
    setSelected([]);
    setConfirmBulkDelete(false);
    setReloadTick((n) => n + 1);
  }

  return (
    <>
      <PageHeader
        title={tr.t(definition.titleKey)}
        actions={canEdit ? <Button variant="primary" onClick={() => setEditing('new')}>{tr.t('admin.action.create')}</Button> : undefined}
      />
      <DataTable
        toolbar={
          <FilterBar end={definition.exportEntityType ? <Button variant="secondary" onClick={() => void handleExport()}>{tr.t('admin.action.export')}</Button> : undefined}>
            <Input
              placeholder={tr.t('admin.common.filtros')}
              value={state.q}
              onChange={(e) => setState((s) => ({ ...s, q: e.target.value, page: 1 }))}
              block
            />
            {(definition.filters ?? []).map((f) => (
              <Select
                key={f.key}
                placeholder={tr.t(f.labelKey)}
                options={f.options}
                value={state.filters[f.key] ?? ''}
                onChange={(e) => setState((s) => ({ ...s, page: 1, filters: { ...s.filters, [f.key]: e.target.value } }))}
              />
            ))}
          </FilterBar>
        }
        columns={columns}
        rows={rows}
        rowKey={(row) => String(row['id'] ?? '')}
        loading={loading}
        error={error !== undefined ? <Alert tone="danger">{error}</Alert> : undefined}
        onRetry={() => setReloadTick((n) => n + 1)}
        empty={{ title: tr.t('admin.common.vacio') }}
        sort={sort}
        onSortChange={setSort}
        pagination={{ page: state.page, pageSize: state.pageSize, total, onPageChange: (page) => setState((s) => ({ ...s, page })) }}
        onRowClick={canEdit ? (row) => setEditing(row) : undefined}
        selectable={definition.bulkDelete === true && canEdit}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        bulkActions={
          definition.bulkDelete === true && canEdit ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmBulkDelete(true)}>
              {tr.t('admin.action.delete')}
            </Button>
          ) : undefined
        }
      />
      {editing !== undefined ? (
        <ResourceForm
          definition={definition}
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setReloadTick((n) => n + 1);
          }}
          onDeleted={() => {
            setEditing(undefined);
            setReloadTick((n) => n + 1);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={confirmBulkDelete}
        title={tr.t('admin.confirm.deleteTitle')}
        body={tr.t('admin.confirm.deleteBody')}
        affectedCount={selected.length}
        affectedLabel={tr.t('admin.common.entidades')}
        confirmLabel={tr.t('admin.action.delete')}
        cancelLabel={tr.t('admin.action.cancel')}
        danger
        onConfirm={() => void handleBulkDelete()}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </>
  );
}
