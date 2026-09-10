/** Presets documentales y de edición: lista genérica con enlace al detalle de versiones. */
import { useMemo, useState } from 'react';
import { PageHeader, Tabs } from '@psp/ui';
import { ResourceList } from '../crud/ResourceList';
import { editingPresetsResource, presetsResource } from '../crud/definitions';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';

export function Presets() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [tab, setTab] = useState<'documents' | 'editing'>('documents');
  return (
    <>
      <PageHeader title={tr.t('admin.nav.presets')}>
        <Tabs
          items={[
            { key: 'documents', label: tr.t('admin.nav.presets') },
            { key: 'editing', label: tr.t('admin.nav.presets') + ' (' + tr.t('admin.field.type') + ')' },
          ]}
          value={tab}
          onChange={(k) => setTab(k as 'documents' | 'editing')}
        />
      </PageHeader>
      {tab === 'documents' ? <ResourceList definition={presetsResource} /> : <ResourceList definition={editingPresetsResource} />}
    </>
  );
}
