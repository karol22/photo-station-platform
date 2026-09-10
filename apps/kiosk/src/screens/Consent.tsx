/**
 * Consentimiento: el de servicio es necesario; almacenamiento opcional, externos (IA futura) y
 * campaña son opcionales y van separados. Registra con `POST /sessions/:id/consents`.
 */
import { useState } from 'react';
import type { ConsentKind, ConsentRecord } from '@psp/contracts';
import { BigButton, Sheet, Toggle } from '@psp/ui';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';

export function ConsentScreen() {
  const { t, tl } = useT();
  const { session, product, advance, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const setSession = useKioskStore((s) => s.setSession);
  const [storage, setStorage] = useState(false);
  const [external, setExternal] = useState(false);
  const [campaign, setCampaign] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!session || !product) return null;
  const retention = bundle?.retentionPolicies.find((r) => r.id === session.retention.policyId);
  const campaignActive = (bundle?.campaigns ?? []).find((c) => c.status === 'active');
  const privacyNotice = configString(bundle, 'legal.privacyNotice');
  const textVersion = bundle?.version ?? 'local';

  const submit = async () => {
    setSaving(true);
    const at = new Date().toISOString();
    const record = (kind: ConsentKind, given: boolean): ConsentRecord => ({ kind, given, at, textVersion });
    const consents: ConsentRecord[] = [record('service', true)];
    if (retention?.mode !== 'none') consents.push(record('storage_optional', storage));
    if (product.kind === 'ai') consents.push(record('external_future', external));
    if (campaignActive) consents.push(record('campaign', campaign));
    try {
      const updated = await stationApi.recordConsents(session.id, consents);
      setSession(updated);
      await advance('consent_given');
    } catch (error) {
      setSaving(false);
      fail(error);
    }
  };

  return (
    <SessionFrame title={t('kiosk.consent.title')}>
      <p className="kiosk-lead">{t('kiosk.consent.intro')}</p>
      <div className="kiosk-stack">
        <div className="kiosk-card">
          <h2 style={{ marginTop: 0 }}>{t('kiosk.consent.service_title')} · {t('kiosk.common.required')}</h2>
          <p>{product.privacyNote ? tl(product.privacyNote) : t('kiosk.consent.service_text')}</p>
          {product.terms ? <p className="kiosk-small">{tl(product.terms)}</p> : null}
          {retention ? (
            <p className="kiosk-small">
              <strong>{t('kiosk.consent.retention_label')}:</strong> {tl(retention.customerText)}
              {retention.leavesDevice ? ` ${t('kiosk.consent.leaves_device')}` : ''}
            </p>
          ) : null}
          <p className="kiosk-small kiosk-muted">{t('kiosk.consent.service_locked')}</p>
        </div>
        {retention && retention.mode !== 'none' ? (
          <div className="kiosk-card">
            <Toggle checked={storage} onChange={setStorage} label={`${t('kiosk.consent.storage_title')} · ${t('kiosk.common.optional')}`} description={t('kiosk.consent.storage_text')} />
          </div>
        ) : null}
        {product.kind === 'ai' ? (
          <div className="kiosk-card">
            <Toggle checked={external} onChange={setExternal} label={`${t('kiosk.consent.external_title')} · ${t('kiosk.common.optional')}`} description={t('kiosk.consent.external_text')} />
          </div>
        ) : null}
        {campaignActive ? (
          <div className="kiosk-card">
            <Toggle checked={campaign} onChange={setCampaign} label={`${t('kiosk.consent.campaign_title')} · ${t('kiosk.common.optional')}`} description={t('kiosk.consent.campaign_text')} />
          </div>
        ) : null}
      </div>
      <div className="kiosk-actions">
        <BigButton variant="secondary" onClick={() => setShowNotice(true)}>
          {t('kiosk.consent.full_notice')}
        </BigButton>
        <BigButton variant="primary" size="xl" loading={saving} loadingLabel={t('kiosk.common.loading')} onClick={() => void submit()} data-testid="consent-continue">
          {t('kiosk.consent.continue')}
        </BigButton>
      </div>
      <Sheet open={showNotice} title={t('kiosk.consent.notice_title')} onClose={() => setShowNotice(false)} closeLabel={t('kiosk.common.close')} size="full">
        <p style={{ whiteSpace: 'pre-wrap' }}>{privacyNotice ?? t('kiosk.consent.notice_empty')}</p>
      </Sheet>
    </SessionFrame>
  );
}
