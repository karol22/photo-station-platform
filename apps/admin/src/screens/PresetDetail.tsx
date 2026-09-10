/** Detalle de preset documental: especificación vigente, versiones y publicar una nueva. */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, DataTable, Field, KeyValue, PageHeader, Skeleton, Textarea } from '@psp/ui';
import type { DocumentPreset, DocumentPresetVersion } from '@psp/contracts';
import { errorMessage } from '../api/client';
import { api } from '../api/resources';
import { presets as presetsApi } from '../api/special';
import { createTranslator } from '../i18n/extra';
import { dateTime } from '../lib/format';
import { usePrefsStore } from '../store/prefs';

export function PresetDetail() {
  const { id = '' } = useParams();
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [preset, setPreset] = useState<DocumentPreset>();
  const [versions, setVersions] = useState<DocumentPresetVersion[]>([]);
  const [error, setError] = useState<string>();
  const [specText, setSpecText] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.presets.get(id).then(setPreset).catch((err: unknown) => setError(errorMessage(err)));
    presetsApi.versions(id).then(setVersions).catch(() => undefined);
  }, [id, reload]);

  useEffect(() => {
    const current = versions.find((v) => v.version === preset?.currentVersion);
    if (current) setSpecText(JSON.stringify(current.spec, null, 2));
  }, [versions, preset]);

  async function handlePublish() {
    try {
      const spec = JSON.parse(specText);
      await presetsApi.publish(id, spec, changeNote);
      setChangeNote('');
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (error !== undefined) return <Alert tone="danger">{error}</Alert>;
  if (!preset) return <Skeleton variant="rect" height={200} />;

  return (
    <>
      <PageHeader title={tr.tl(preset.name)} subtitle={preset.institution} />
      <KeyValue
        columns={2}
        items={[
          { key: 'country', label: tr.t('admin.field.country'), value: preset.country },
          { key: 'category', label: tr.t('admin.field.category'), value: preset.category },
          { key: 'currentVersion', label: tr.t('admin.presets.currentVersion'), value: String(preset.currentVersion) },
          { key: 'status', label: tr.t('admin.field.status'), value: preset.status },
        ]}
      />
      <Alert tone="info">{tr.t('admin.presets.oldSessionsKeepVersion')}</Alert>
      <h3>{tr.t('admin.presets.versions')}</h3>
      <DataTable
        columns={[
          { key: 'version', header: tr.t('admin.field.version'), render: (v) => String(v.version) },
          { key: 'changeNote', header: tr.t('admin.presets.changeNote'), render: (v) => v.changeNote ?? '—' },
          { key: 'createdAt', header: tr.t('admin.field.createdAt'), render: (v) => dateTime(v.createdAt, tr.locale) },
        ]}
        rows={versions}
        rowKey={(v) => String(v.version)}
        empty={{ title: tr.t('admin.common.vacio') }}
      />
      <h3>{tr.t('admin.presets.publishNew')}</h3>
      <Field label={tr.t('admin.presets.spec')}>
        <Textarea rows={12} value={specText} onChange={(e) => setSpecText(e.target.value)} />
      </Field>
      <Field label={tr.t('admin.presets.changeNote')}>
        <Textarea rows={2} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
      </Field>
      <Button variant="primary" onClick={() => void handlePublish()}>
        {tr.t('admin.presets.publishNew')}
      </Button>
    </>
  );
}
