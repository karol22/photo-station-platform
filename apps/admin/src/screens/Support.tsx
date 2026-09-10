/** Accesos de soporte acotados (requisito 3.4): motivo, duración y revocación. */
import { PageHeader } from '@psp/ui';
import { ResourceList } from '../crud/ResourceList';
import { supportAccessesResource } from '../crud/definitions';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';

export function Support() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = createTranslator(locale);
  return (
    <>
      <PageHeader title={tr.t('admin.nav.support')} />
      <ResourceList definition={supportAccessesResource} />
    </>
  );
}
