/** Detalle de campaña: fechas, objetivos, overrides y "previsualizar en máquina". */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Field, KeyValue, PageHeader, Select, Skeleton } from '@psp/ui';
import type { Campaign, KioskBundle, Machine } from '@psp/contracts';
import { errorMessage } from '../api/client';
import { api } from '../api/resources';
import { campaigns as campaignsApi } from '../api/special';
import { createTranslator } from '../i18n/extra';
import { dateTime } from '../lib/format';
import { hasAnyPermission } from '../lib/navFilter';
import { usePrefsStore } from '../store/prefs';
import { useSessionStore } from '../store/session';

export function CampaignDetail() {
  const { id = '' } = useParams();
  const principal = useSessionStore((s) => s.principal);
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const [campaign, setCampaign] = useState<Campaign>();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState('');
  const [preview, setPreview] = useState<KioskBundle>();
  const [error, setError] = useState<string>();
  const onlyEditable = hasAnyPermission(principal, ['campaigns.edit_local']) && !hasAnyPermission(principal, ['campaigns.publish']);

  useEffect(() => {
    api.campaigns.get(id).then(setCampaign).catch((err: unknown) => setError(errorMessage(err)));
    void api.machines.listAll({}, 500).then(setMachines);
  }, [id]);

  async function handlePreview() {
    try {
      const res = await campaignsApi.preview(id, machineId);
      setPreview(res.bundle);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (error !== undefined && !campaign) return <Alert tone="danger">{error}</Alert>;
  if (!campaign) return <Skeleton variant="rect" height={200} />;

  return (
    <>
      <PageHeader title={tr.tl(campaign.name)} subtitle={`${dateTime(campaign.startsAt, tr.locale)} – ${dateTime(campaign.endsAt, tr.locale)}`} />
      {onlyEditable ? <Alert tone="info">{tr.t('admin.campaigns.onlyEditableNote')}</Alert> : null}
      <KeyValue
        columns={2}
        items={[
          { key: 'status', label: tr.t('admin.field.status'), value: campaign.status },
          { key: 'productIds', label: tr.t('admin.nav.products'), value: campaign.productIds.join(', ') || '—' },
          { key: 'editableKeys', label: tr.t('admin.campaigns.editableKeys'), value: campaign.franchiseEditableKeys.join(', ') || '—' },
          { key: 'mandatory', label: tr.t('admin.field.mandatory'), value: campaign.mandatory ? '✓' : '—' },
        ]}
      />
      <h3>{tr.t('admin.action.previewOnMachine')}</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <Field label={tr.t('admin.field.machineId')}>
          <Select placeholder="—" options={machines.map((m) => ({ value: m.id, label: m.name }))} value={machineId} onChange={(e) => setMachineId(e.target.value)} />
        </Field>
        <Button variant="primary" disabled={!machineId} onClick={() => void handlePreview()}>
          {tr.t('admin.action.preview')}
        </Button>
      </div>
      {error !== undefined ? <Alert tone="danger">{error}</Alert> : null}
      {preview ? (
        <KeyValue
          columns={1}
          items={[
            { key: 'branding', label: tr.t('admin.nav.assets') + ' · branding', value: JSON.stringify(preview.effective.values['branding.palette.primary'] ?? '—') },
            { key: 'products', label: tr.t('admin.nav.products'), value: preview.products.map((p) => tr.tl(p.displayName)).join(', ') || '—' },
            { key: 'prices', label: tr.t('admin.nav.prices'), value: preview.prices.map((p) => tr.formatMoney(p.final)).join(', ') || '—' },
          ]}
        />
      ) : null}
    </>
  );
}
