/**
 * Pantalla de atracción: branding, imágenes rotativas, categorías destacadas, precio "desde",
 * CTA grande, avisos de privacidad/videovigilancia, impresión disponible y notices de servicio.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton, BlobFace, BLOB_VARIANTS, Icon, Notice, StatusPill } from '@psp/ui';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { groupByCategory, minPrice, productViews } from '../lib/products';
import { ROUTES } from '../session/flow';
import { useKioskStore } from '../store';
import { configBool, configList, configNumber, configString, resolveAssetUrl } from '../theme/assets';

export function AttractScreen() {
  const { t, tl, money } = useT();
  const navigate = useNavigate();
  const bundle = useKioskStore((s) => s.bundle);
  const status = useKioskStore((s) => s.status);
  const releaseSession = useKioskStore((s) => s.releaseSession);
  const pendingRelease = useKioskStore((s) => s.pendingRelease);
  const [slide, setSlide] = useState(0);

  const images = useMemo(() => configList(bundle, 'branding.attractImageAssetIds').map((id) => resolveAssetUrl(bundle, id)).filter((u): u is string => !!u), [bundle]);
  const rotation = configNumber(bundle, 'kiosk.attractRotationSec', 8);
  const views = useMemo(() => productViews(bundle), [bundle]);
  const categories = useMemo(() => groupByCategory(views).slice(0, 4), [views]);
  const from = minPrice(views);
  const showPrices = configBool(bundle, 'kiosk.showPricesOnIdle', true);
  const printerReady = (status?.printers ?? []).some((p) => p.status === 'ready' || p.status === 'busy');
  const outOfService = status?.status === 'out_of_service' || status?.status === 'suspended' || status?.status === 'retired';
  const maintenance = status?.maintenance.on === true;
  const publicName = configString(bundle, 'branding.publicName') ?? bundle?.organization.name ?? '';
  const footerText = configString(bundle, 'branding.footerText');

  useEffect(() => {
    // Volver a atracción cierra la sesión anterior EN EL APARATO, no sólo en la pantalla. Si el
    // agente no confirma, queda anotada y se reintenta: la máquina no puede quedarse ocupada por
    // alguien que ya se fue.
    void releaseSession('returned_to_attract');
  }, [releaseSession]);

  // Reintento del cierre pendiente. Mientras exista, la cabina no ofrece empezar.
  useEffect(() => {
    if (!pendingRelease) return;
    const timer = setInterval(() => void releaseSession('release_retry'), 2500);
    return () => clearInterval(timer);
  }, [pendingRelease, releaseSession]);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % images.length), rotation * 1000);
    return () => clearInterval(id);
  }, [images.length, rotation]);

  // Una sesión que no se pudo cerrar bloquea la cabina a propósito: es preferible una espera de
  // segundos, explicada, a que la persona toque «empezar» y se lleve un error del agente.
  const releasing = !!pendingRelease;
  const blocked = outOfService || maintenance || !bundle || releasing;
  const blockedTitle = releasing
    ? t('kiosk.attract.releasing')
    : maintenance
      ? t('kiosk.attract.maintenance')
      : outOfService
        ? t('kiosk.attract.out_of_service')
        : t('kiosk.attract.no_bundle');
  const blockedText = releasing
    ? t('kiosk.attract.releasing_text')
    : maintenance
      ? status?.maintenance.message || t('kiosk.attract.maintenance_text')
      : outOfService
        ? t('kiosk.attract.out_of_service_text')
        : t('kiosk.attract.no_bundle_text');

  return (
    <Shell footer={footerText ? <p className="kiosk-small kiosk-muted">{footerText}</p> : undefined} contentAlign="center">
      <div className="kiosk-attract" data-testid="attract">
        <div className="kiosk-attract__hero">
          <h1>{publicName}</h1>
          {status?.demoMode ? <StatusPill tone="info">{t('kiosk.common.demo')}</StatusPill> : null}
          {!blocked && showPrices && from ? <p className="kiosk-lead">{t('kiosk.attract.from_price', { price: money(from) })}</p> : null}
        </div>
        {/* La imagen promocional es contenido, no decoración: se muestra completa y rota por
            programación local (requisito 4.1), nunca detrás del texto. */}
        {!blocked && images[slide] ? (
          <div className="kiosk-attract__promo">
            <img src={images[slide]} alt="" className="kiosk-attract__promo-img" />
            {images.length > 1 ? (
              <div className="kiosk-attract__dots" aria-hidden="true">
                {images.map((src, i) => (
                  <span key={src} className={i === slide ? 'is-active' : undefined} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {/* La familia: el recurso de marca que hace que la cabina se reconozca de lejos. */}
        {!blocked ? (
          <div className="kiosk-attract__family" aria-hidden="true">
            {BLOB_VARIANTS.map((variant) => (
              <BlobFace key={variant} variant={variant} size={104} animated />
            ))}
          </div>
        ) : null}
        {blocked ? (
          <Notice tone={maintenance || releasing ? 'info' : 'warn'} position="static" title={blockedTitle}>
            {blockedText}
          </Notice>
        ) : (
          <>
            <div className="kiosk-attract__cta">
              <BigButton size="xl" variant="primary" icon={<Icon name="camera" />} onClick={() => navigate(ROUTES.home)} data-testid="attract-cta">
                {t('kiosk.attract.cta')}
              </BigButton>
            </div>
            {categories.length > 0 ? (
              <div className="kiosk-stack" style={{ alignItems: 'center' }}>
                <p className="kiosk-lead" style={{ margin: 0 }}>{t('kiosk.attract.featured')}</p>
                <div className="kiosk-attract__featured">
                  {categories.map(({ category, items }) => (
                    <StatusPill key={category} tone="neutral" size="lg" icon={false}>
                      {t(`kiosk.category.${category}`)} · {items.length}
                    </StatusPill>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
        <div className="kiosk-attract__notes">
          <StatusPill tone={printerReady ? 'ok' : 'warn'} icon={<Icon name="print" />}>{printerReady ? t('kiosk.attract.print_available') : t('kiosk.attract.print_unavailable')}</StatusPill>
          <span className="kiosk-small kiosk-muted">{t('kiosk.attract.privacy_short')}</span>
          {configBool(bundle, 'kiosk.surveillanceNotice') ? <span className="kiosk-small kiosk-muted">{t('kiosk.attract.surveillance')}</span> : null}
          {(status?.notices ?? []).map((n) => (
            <StatusPill key={n.code} tone={n.kind === 'error' ? 'danger' : n.kind === 'warning' ? 'warn' : 'info'}>
              {tl(n.message)}
            </StatusPill>
          ))}
        </div>
      </div>
    </Shell>
  );
}
