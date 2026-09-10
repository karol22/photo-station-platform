/**
 * PANTALLA 3 · Consentimiento: una frase y dos botones.
 *
 * Un consentimiento no es una pantalla de ajustes. Lo que había —cuatro tarjetas blancas apiladas
 * con interruptores— convertía el momento en un formulario, y a metro y medio de la pantalla, de
 * pie y con alguien detrás, un formulario se acepta sin leer: exactamente lo contrario de lo que
 * un consentimiento tiene que conseguir.
 *
 * Aquí queda una sola frase a tamaño de instrucción, con una de las caras de la familia mirándola,
 * y dos botones: aceptar, que es grande, y no aceptar, que es pequeño pero está siempre a la
 * vista. Una negativa escondida no es una negativa.
 *
 * Lo opcional —guardar, servicios externos, campaña— no desaparece: se va a la hoja del aviso
 * completo, que es donde alguien que quiere decidir de verdad lo va a leer. Nada de eso hace falta
 * para continuar, así que nada de eso puede competir con la decisión.
 *
 * Lo que se registra en el agente no cambia: `service` siempre, y cada opcional con lo que la
 * persona haya dejado activado.
 */
import { useState } from 'react';
import type { ConsentKind, ConsentRecord } from '@psp/contracts';
import { BigButton, BlobFace, Marquee, Sheet } from '@psp/ui';
import { stationApi } from '../api/station';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useSessionTimeout } from '../session/useSessionTimeout';
import { useKioskStore } from '../store';
import { availableLocales } from '../store/reducers';
import { configString } from '../theme/assets';

export function ConsentScreen() {
  const { t, tl } = useT();
  const { session, product, advance, cancel, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const locale = useKioskStore((s) => s.locale);
  const setLocale = useKioskStore((s) => s.setLocale);
  const setSession = useKioskStore((s) => s.setSession);
  const [storage, setStorage] = useState(false);
  const [external, setExternal] = useState(false);
  const [campaign, setCampaign] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  // El reloj de esta pantalla son los focos apagándose. Sin pago y sin fotografías, agotarlo
  // cancela la sesión y deja la máquina libre, que es lo que hace el temporizador de siempre.
  const timeout = useSessionTimeout(true);

  if (!session || !product) return null;
  const retention = bundle?.retentionPolicies.find((r) => r.id === session.retention.policyId);
  const campaignActive = (bundle?.campaigns ?? []).find((c) => c.status === 'active');
  const privacyNotice = configString(bundle, 'legal.privacyNotice');
  const footerText = configString(bundle, 'branding.footerText');
  const textVersion = bundle?.version ?? 'local';
  const locales = availableLocales(bundle);
  const hasOptions = (retention && retention.mode !== 'none') || product.kind === 'ai' || campaignActive;

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
    <Shell bleed marquee={<Marquee cadence="wait" remaining={timeout.total > 0 ? timeout.remaining / timeout.total : 1} />} hideHeader hideLang>
      <div className="kiosk-consentimiento" data-testid="consent">
        {/* CARTEL: la frase, y una cara de la familia acompañándola. Nada táctil. */}
        <div className="kiosk-consentimiento__cartel">
          <BlobFace variant={5} size={420} expression="curious" animated className="kiosk-consentimiento__cara" />
          <p className="kiosk-consentimiento__frase">
            {product.privacyNote ? tl(product.privacyNote) : t('kiosk.consent.service_text')}
            {retention?.leavesDevice ? ` ${t('kiosk.consent.leaves_device')}` : ''}
          </p>
        </div>

        {/* REPISA: el idioma y el aviso completo. Lo primero que alguien necesita es entenderlo. */}
        <div className="kiosk-consentimiento__repisa">
          {locales.length > 1 ? (
            <div className="kiosk-consentimiento__idiomas" role="group" aria-label={t('kiosk.common.language')}>
              {locales.map((code) => (
                <button
                  key={code}
                  type="button"
                  className="kiosk-consentimiento__idioma"
                  aria-pressed={locale === code}
                  onClick={() => setLocale(code)}
                  data-testid={`consent-lang-${code}`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className="kiosk-consentimiento__enlace" onClick={() => setShowNotice(true)} data-testid="consent-notice">
            {t('kiosk.consent.full_notice')}
          </button>
        </div>

        {/* ALCANCE: aceptar en grande; no aceptar, pequeño pero siempre visible. */}
        <div className="kiosk-consentimiento__alcance">
          <button type="button" className="kiosk-consentimiento__cta" disabled={saving} onClick={() => void submit()} data-testid="consent-continue">
            {saving ? t('kiosk.common.loading') : t('kiosk.consent.agree')}
          </button>
          <button type="button" className="kiosk-consentimiento__salida" onClick={() => void cancel('consent_declined')} data-testid="consent-decline">
            {t('kiosk.consent.decline')}
          </button>
        </div>

        {/* ZÓCALO: lo que la operación obliga a decir, en tinta plena y fuera del camino. */}
        <div className="kiosk-consentimiento__zocalo">
          <span>{t('kiosk.attract.privacy_short')}</span>
          {retention ? <span>{tl(retention.customerText)}</span> : null}
          {footerText ? <span>{footerText}</span> : null}
        </div>
      </div>

      <Sheet
        open={showNotice}
        title={t('kiosk.consent.notice_title')}
        onClose={() => setShowNotice(false)}
        closeLabel={t('kiosk.common.close')}
        size="full"
        actions={
          <BigButton variant="primary" size="xl" onClick={() => setShowNotice(false)}>
            {t('kiosk.common.ok')}
          </BigButton>
        }
        data-testid="consent-notice-sheet"
      >
        <div className="kiosk-consentimiento__aviso">
          <p style={{ whiteSpace: 'pre-wrap' }}>{privacyNotice ?? t('kiosk.consent.notice_empty')}</p>
          {product.terms ? <p className="kiosk-small">{tl(product.terms)}</p> : null}
          {hasOptions ? (
            <>
              <h2>{t('kiosk.consent.options_title')}</h2>
              <p className="kiosk-small">{t('kiosk.consent.options_hint')}</p>
              <div className="kiosk-consentimiento__opciones">
                {retention && retention.mode !== 'none' ? (
                  <OptionChip
                    on={storage}
                    onToggle={() => setStorage((v) => !v)}
                    title={t('kiosk.consent.storage_title')}
                    text={t('kiosk.consent.storage_text')}
                    testId="consent-option-storage"
                  />
                ) : null}
                {product.kind === 'ai' ? (
                  <OptionChip
                    on={external}
                    onToggle={() => setExternal((v) => !v)}
                    title={t('kiosk.consent.external_title')}
                    text={t('kiosk.consent.external_text')}
                    testId="consent-option-external"
                  />
                ) : null}
                {campaignActive ? (
                  <OptionChip
                    on={campaign}
                    onToggle={() => setCampaign((v) => !v)}
                    title={t('kiosk.consent.campaign_title')}
                    text={t('kiosk.consent.campaign_text')}
                    testId="consent-option-campaign"
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </Sheet>
    </Shell>
  );
}

/**
 * Un opcional, como canto de tinta que se enciende. No es un interruptor de teléfono: aquí el
 * estado se ve por el campo lleno o vacío, que a un metro y medio se distingue y un pulgar de
 * 8 mm no falla.
 */
function OptionChip({ on, onToggle, title, text, testId }: { on: boolean; onToggle: () => void; title: string; text: string; testId: string }) {
  return (
    <button type="button" className="kiosk-consentimiento__opcion" aria-pressed={on} onClick={onToggle} data-testid={testId}>
      <span className="kiosk-consentimiento__opcion-titulo">{title}</span>
      <span className="kiosk-consentimiento__opcion-texto">{text}</span>
    </button>
  );
}
