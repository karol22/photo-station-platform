/** Drawer genérico de creación / edición para una `ResourceDefinition`. */
import { useState } from 'react';
import { Alert, Button, ConfirmDialog, Drawer } from '@psp/ui';
import { errorMessage } from '../api/client';
import { createTranslator } from '../i18n/extra';
import { hasAnyPermission } from '../lib/navFilter';
import { usePrefsStore } from '../store/prefs';
import { useSessionStore } from '../store/session';
import { ResourceFieldControl } from './fields';
import type { ResourceDefinition } from './types';

export interface ResourceFormProps {
  definition: ResourceDefinition;
  /** `undefined` = creación. */
  initial?: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function ResourceForm({ definition, initial, onClose, onSaved, onDeleted }: ResourceFormProps) {
  const locale = usePrefsStore((s) => s.locale);
  const tr = createTranslator(locale);
  const principal = useSessionStore((s) => s.principal);
  const canEdit = definition.permissions.edit !== undefined && hasAnyPermission(principal, [definition.permissions.edit]);
  const isNew = initial === undefined;
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...(isNew ? (definition.createDefaults ?? {}) : {}), ...(initial ?? {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<string[]>();

  async function handleSave() {
    setSaving(true);
    setError(undefined);
    try {
      if (isNew) await definition.resource.create(draft);
      else await definition.resource.update(String(initial?.['id'] ?? draft['id'] ?? ''), draft);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (initial === undefined) return;
    setSaving(true);
    try {
      await definition.resource.remove(String(initial['id']));
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Drawer
      open
      title={tr.t(isNew ? 'admin.action.create' : 'admin.action.edit')}
      description={tr.t(definition.titleKey)}
      onClose={onClose}
      actions={
        <>
          {!isNew && canEdit ? (
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete(true);
                if (definition.warnBeforeDelete && initial) void definition.warnBeforeDelete(String(initial['id'])).then(setDeleteWarning);
              }}
              disabled={saving}
            >
              {tr.t('admin.action.delete')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {tr.t('admin.action.cancel')}
          </Button>
          {canEdit ? (
            <Button variant="primary" loading={saving} onClick={() => void handleSave()}>
              {tr.t('admin.action.save')}
            </Button>
          ) : null}
        </>
      }
    >
      {error !== undefined ? (
        <Alert tone="danger" title={tr.t('admin.error.generic')}>
          {error}
        </Alert>
      ) : null}
      {definition.fields.map((field) => (
        <ResourceFieldControl key={field.key} field={field} draft={draft} onChange={setDraft} tr={tr} disabled={!canEdit} />
      ))}
      <ConfirmDialog
        open={confirmDelete}
        title={tr.t('admin.confirm.deleteTitle')}
        body={tr.t('admin.confirm.deleteBody')}
        confirmLabel={tr.t('admin.action.delete')}
        cancelLabel={tr.t('admin.action.cancel')}
        danger
        loading={saving}
        onConfirm={() => {
          setConfirmDelete(false);
          void handleDelete();
        }}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteWarning(undefined);
        }}
      >
        {deleteWarning !== undefined && deleteWarning.length > 0 ? (
          <Alert tone="warn" title={tr.t('admin.assets.inUseWarning')}>
            {deleteWarning.join(', ')}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </Drawer>
  );
}
