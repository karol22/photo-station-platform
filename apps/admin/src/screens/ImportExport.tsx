/** Importar / exportar: pegar CSV → previsualizar errores por fila → aplicar. */
import { useState } from 'react';
import { Alert, Button, DataTable, Field, PageHeader, Select, Textarea } from '@psp/ui';
import { errorMessage } from '../api/client';
import { importExport } from '../api/special';
import { csvToObjects } from '../lib/csv';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';

const ENTITY_TYPES = ['machines', 'locations', 'products', 'prices', 'presets'] as const;

export function ImportExport() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = createTranslator(locale);
  const [entityType, setEntityType] = useState<(typeof ENTITY_TYPES)[number]>('locations');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<{ valid: number; invalid: number; errors: { row: number; field?: string; message: string }[]; confirmToken: string }>();
  const [error, setError] = useState<string>();
  const [applied, setApplied] = useState(false);

  async function handlePreview() {
    setError(undefined);
    setApplied(false);
    try {
      const { rows } = csvToObjects(csv);
      const res = await importExport.preview(entityType, rows);
      setPreview(res);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleApply() {
    if (!preview) return;
    try {
      const { rows } = csvToObjects(csv);
      await importExport.apply(entityType, rows, preview.confirmToken);
      setApplied(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title={tr.t('admin.nav.importExport')} />
      {error !== undefined ? <Alert tone="danger">{error}</Alert> : null}
      {applied ? <Alert tone="ok">{tr.t('admin.importExport.applyImport')} ✓</Alert> : null}
      <Field label={tr.t('admin.importExport.entityType')}>
        <Select options={ENTITY_TYPES.map((e) => ({ value: e, label: e }))} value={entityType} onChange={(e) => setEntityType(e.target.value as (typeof ENTITY_TYPES)[number])} />
      </Field>
      <Field label={tr.t('admin.importExport.pasteCsv')}>
        <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} />
      </Field>
      <Button variant="primary" onClick={() => void handlePreview()}>
        {tr.t('admin.importExport.preview')}
      </Button>
      {preview ? (
        <>
          <p>
            {tr.t('admin.importExport.validRows')}: {preview.valid} · {tr.t('admin.importExport.invalidRows')}: {preview.invalid}
          </p>
          <DataTable
            columns={[
              { key: 'row', header: '#', render: (r) => r.row },
              { key: 'field', header: tr.t('admin.field.key'), render: (r) => r.field ?? '—' },
              { key: 'message', header: tr.t('admin.field.description'), render: (r) => r.message },
            ]}
            rows={preview.errors}
            rowKey={(r) => `${r.row}-${r.field ?? ''}`}
            empty={{ title: tr.t('admin.common.vacio') }}
          />
          <Button variant="primary" disabled={preview.invalid > 0} onClick={() => void handleApply()}>
            {tr.t('admin.importExport.applyImport')}
          </Button>
        </>
      ) : null}
    </>
  );
}
