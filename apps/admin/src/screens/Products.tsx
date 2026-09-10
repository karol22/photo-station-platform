/** Productos, disponibilidad por alcance y advertencia de compatibilidad de hardware (requisito 9). */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Field, PageHeader, Select, Tabs } from '@psp/ui';
import type { Product } from '@psp/contracts';
import { api } from '../api/resources';
import { ResourceList } from '../crud/ResourceList';
import { productAvailabilitiesResource, productsResource } from '../crud/definitions';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';
import { useScopeFilter } from '../store/scope';

function CompatibilityPanel({ tr }: { tr: ReturnType<typeof createTranslator> }) {
  const scope = useScopeFilter();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<{ total: number; incompatible: number }>();

  useEffect(() => {
    void api.products.listAll({}, 300).then(setProducts);
  }, []);

  useEffect(() => {
    const product = products.find((p) => p.id === selected);
    if (!product) {
      setResult(undefined);
      return;
    }
    void api.machines.listAll({ organizationId: scope.organizationId, franchiseId: scope.franchiseId, regionId: scope.regionId, locationId: scope.locationId }, 2000).then((machines) => {
      const incompatible = machines.filter((m) => !product.hardwareRequirements.every((cap) => m.capabilities.some((c) => c.key === cap && c.present && c.operational))).length;
      setResult({ total: machines.length, incompatible });
    });
  }, [selected, products, scope.organizationId, scope.franchiseId, scope.regionId, scope.locationId]);

  return (
    <div style={{ marginTop: 24 }}>
      <Field label={tr.t('admin.field.productId')}>
        <Select placeholder="—" options={products.map((p) => ({ value: p.id, label: p.internalName }))} value={selected} onChange={(e) => setSelected(e.target.value)} />
      </Field>
      {result ? (
        <Alert tone={result.incompatible > 0 ? 'warn' : 'ok'}>
          {result.incompatible} / {result.total} {tr.t('admin.machines.compareCapabilities')}
        </Alert>
      ) : null}
    </div>
  );
}

export function Products() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [tab, setTab] = useState<'products' | 'availability'>('products');
  return (
    <>
      <PageHeader title={tr.t('admin.nav.products')}>
        <Tabs
          items={[
            { key: 'products', label: tr.t('admin.nav.products') },
            { key: 'availability', label: tr.t('admin.nav.products') + ' · ' + tr.t('admin.field.enabled') },
          ]}
          value={tab}
          onChange={(k) => setTab(k as 'products' | 'availability')}
        />
      </PageHeader>
      {tab === 'products' ? (
        <>
          <ResourceList definition={productsResource} />
          <CompatibilityPanel tr={tr} />
        </>
      ) : (
        <ResourceList definition={productAvailabilitiesResource} />
      )}
    </>
  );
}
