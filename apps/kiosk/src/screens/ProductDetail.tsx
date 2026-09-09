/**
 * Detalle de producto (requisito 4.3): qué recibes, capturas, impresiones, formato, duración,
 * precio, restricciones, privacidad y retención, requisitos documentales y botón "Comenzar", que
 * crea la sesión en el agente y avanza a la primera etapa de trabajo.
 */
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BigButton, Icon, Notice, PriceTag, StatusPill } from '@psp/ui';
import { Shell } from '../components/Shell';
import { stationApi } from '../api/station';
import { useT } from '../i18n';
import { finalPrice, listPrice, productViews } from '../lib/products';
import { ROUTES, firstWorkingStage, flowOptionsFor, screenForStage } from '../session/flow';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { configString, resolveAssetUrl } from '../theme/assets';

export function ProductDetailScreen() {
  const { t, tl, money, duration } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { productId } = useParams();
  const bundle = useKioskStore((s) => s.bundle);
  const status = useKioskStore((s) => s.status);
  const locale = useKioskStore((s) => s.locale);
  const setSession = useKioskStore((s) => s.setSession);
  const { fail } = useSession();
  const [starting, setStarting] = useState(false);

  const view = useMemo(() => productViews(bundle).find((v) => v.product.id === productId), [bundle, productId]);
  const accessible = (location.state as { accessible?: boolean } | null)?.accessible === true;

  if (!view) {
    return (
      <Shell>
        <Notice tone="warn" position="static" title={t('kiosk.product.not_found')} action={<BigButton onClick={() => navigate(ROUTES.home)}>{t('kiosk.common.home')}</BigButton>} />
      </Shell>
    );
  }

  const { product, availability } = view;
  const final = finalPrice(view);
  const list = listPrice(view);
  const preset = product.presetId ? bundle?.presets.find((p) => p.id === product.presetId) : undefined;
  const presetVersion = product.presetId ? bundle?.presetVersions.find((p) => p.presetId === product.presetId) : undefined;
  const template = bundle?.templates.find((tpl) => tpl.id === product.output.templateId);
  const retentionId = product.retentionPolicyId ?? configString(bundle, 'privacy.defaultRetentionPolicyId');
  const retention = bundle?.retentionPolicies.find((r) => r.id === retentionId);
  const businessMode = configString(bundle, 'payment.businessMode') ?? 'paid';
  const example = resolveAssetUrl(bundle, product.coverAssetId);
  const paperKey = product.output.paperSize;

  const start = async () => {
    setStarting(true);
    try {
      const created = await stationApi.createSession({ productId: product.id, locale, isDemo: status?.demoMode ?? false, accessible });
      const flow = flowOptionsFor({ product: created.product, bundle, status, session: created });
      const stage = firstWorkingStage(created.product, flow);
      const advanced = created.stage === stage ? created : await stationApi.advanceStage(created.id, stage, 'product_start');
      setSession(advanced);
      navigate(screenForStage(advanced.stage, advanced.product));
    } catch (error) {
      setStarting(false);
      fail(error);
    }
  };

  const rows: Array<[string, string]> = [
    [t('kiosk.product.captures'), product.captureCount === 1 ? t('kiosk.common.photo_one') : t('kiosk.common.photos_n', { n: product.captureCount })],
    [t('kiosk.product.prints'), product.printCount === 0 ? t('kiosk.common.no_prints') : product.printCount === 1 ? t('kiosk.common.print_one') : t('kiosk.common.prints_n', { n: product.printCount })],
    [t('kiosk.product.format'), `${t(`kiosk.paper.${paperKey}`)}${template ? ` · ${tl(template.name)}` : ''}`],
    [t('kiosk.product.duration'), duration(product.estimatedDurationSec)],
  ];

  return (
    <Shell
      headerEnd={
        <BigButton variant="ghost" icon={<Icon name="back" />} onClick={() => navigate(ROUTES.home)}>
          {t('kiosk.common.back')}
        </BigButton>
      }
    >
      <h1 className="kiosk-title">{tl(product.displayName)}</h1>
      <div className="kiosk-edit">
        <div className="kiosk-stack">
          {example ? (
            <div className="kiosk-preview">
              <img src={example} alt={t('kiosk.product.example')} />
            </div>
          ) : null}
          <p className="kiosk-lead">{tl(product.description)}</p>
          <div className="kiosk-card">
            <h2 style={{ marginTop: 0 }}>{t('kiosk.product.what_you_get')}</h2>
            <p>{tl(product.whatYouGet)}</p>
            <ul className="kiosk-list">
              {rows.map(([label, value]) => (
                <li key={label}>
                  <span>{label}</span>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </div>
          {preset || presetVersion ? (
            <div className="kiosk-card">
              <h2 style={{ marginTop: 0 }}>{t('kiosk.product.requirements')}</h2>
              {preset ? <p><strong>{tl(preset.name)}</strong></p> : null}
              {presetVersion ? <p>{tl(presetVersion.spec.customerInstructions)}</p> : null}
              {presetVersion?.spec.attire ? <p>{tl(presetVersion.spec.attire)}</p> : null}
              {preset?.acceptanceDisclaimer ? <p className="kiosk-small kiosk-muted">{tl(preset.acceptanceDisclaimer)}</p> : <p className="kiosk-small kiosk-muted">{t('kiosk.product.disclaimer')}</p>}
            </div>
          ) : null}
          {product.restrictions ? (
            <div className="kiosk-card">
              <h2 style={{ marginTop: 0 }}>{t('kiosk.product.restrictions')}</h2>
              <p>{tl(product.restrictions)}</p>
            </div>
          ) : null}
          <div className="kiosk-card">
            <h2 style={{ marginTop: 0 }}>{t('kiosk.product.privacy')}</h2>
            <p>{product.privacyNote ? tl(product.privacyNote) : t('kiosk.attract.privacy_short')}</p>
            {retention ? (
              <p className="kiosk-small">
                <strong>{t('kiosk.product.retention')}:</strong> {tl(retention.customerText)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="kiosk-stack">
          <div className="kiosk-card kiosk-stack">
            <PriceTag
              value={final.amount === 0 ? t('kiosk.common.free') : money(final)}
              original={list.amount > final.amount ? money(list) : undefined}
              size="xl"
              label={t('kiosk.product.price')}
              note={businessMode !== 'paid' ? t(`kiosk.business.${businessMode}`) : undefined}
            />
            {availability.available ? (
              <StatusPill tone="ok">{t('kiosk.product.available')}</StatusPill>
            ) : (
              <StatusPill tone="warn">{availability.reasons[0] ? t(`kiosk.product.motivo.${availability.reasons[0]}`) : t('kiosk.home.unavailable')}</StatusPill>
            )}
            <BigButton size="xl" variant="primary" block disabled={!availability.available || starting} loading={starting} loadingLabel={t('kiosk.common.loading')} icon={<Icon name="camera" />} onClick={() => void start()} data-testid="product-start">
              {t('kiosk.product.start')}
            </BigButton>
          </div>
        </div>
      </div>
    </Shell>
  );
}
