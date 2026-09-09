/** Usuarios, asignaciones de rol con alcance y accesos de soporte (requisito 3). */
import { useMemo, useState } from 'react';
import { PageHeader, Tabs } from '@psp/ui';
import { ResourceList } from '../crud/ResourceList';
import { roleAssignmentsResource, supportAccessesResource, usersResource } from '../crud/definitions';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';

const TABS = ['users', 'assignments', 'support'] as const;

export function Users() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('users');
  return (
    <>
      <PageHeader title={tr.t('admin.nav.users')}>
        <Tabs
          items={[
            { key: 'users', label: tr.t('admin.nav.users') },
            { key: 'assignments', label: tr.t('admin.users.assignments') },
            { key: 'support', label: tr.t('admin.users.support') },
          ]}
          value={tab}
          onChange={(k) => setTab(k as (typeof TABS)[number])}
        />
      </PageHeader>
      {tab === 'users' ? <ResourceList definition={usersResource} /> : null}
      {tab === 'assignments' ? <ResourceList definition={roleAssignmentsResource} /> : null}
      {tab === 'support' ? <ResourceList definition={supportAccessesResource} /> : null}
    </>
  );
}
