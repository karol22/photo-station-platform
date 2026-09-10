/** Catálogo de capacidades registradas (`GET /catalog`). Sólo lectura. */
import { useEffect, useState } from 'react';
import { DataTable, PageHeader } from '@psp/ui';
import type { CatalogEntry } from '@psp/contracts';
import { catalog } from '../api/special';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';

export function Catalog() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = createTranslator(locale);
  const [rows, setRows] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void catalog
      .list()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title={tr.t('admin.nav.catalog')} />
      <DataTable
        columns={[
          { key: 'kind', header: tr.t('admin.catalog.kind'), render: (r) => r.kind },
          { key: 'key', header: tr.t('admin.field.key'), render: (r) => r.key },
          { key: 'name', header: tr.t('admin.field.name'), render: (r) => r.name },
          { key: 'package', header: tr.t('admin.catalog.package'), render: (r) => r.package },
          { key: 'status', header: tr.t('admin.catalog.status'), render: (r) => r.status },
        ]}
        rows={rows}
        rowKey={(r) => `${r.kind}:${r.key}`}
        loading={loading}
        empty={{ title: tr.t('admin.common.vacio') }}
      />
    </>
  );
}
