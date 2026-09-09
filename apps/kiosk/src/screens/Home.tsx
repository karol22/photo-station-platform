/**
 * Inicio: categorías con productos según `bundle.availability` (oculto no aparece; bloqueado con
 * candado y motivo; próximamente con etiqueta; no disponible con motivo).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton, ChoiceCard, Icon, Toggle } from '@psp/ui';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { finalPrice, groupByCategory, listPrice, productViews, type ProductView } from '../lib/products';
import { ROUTES, productRoute } from '../session/flow';
import { useKioskStore } from '../store';
import { configBool, resolveAssetUrl } from '../theme/assets';

export function HomeScreen() {
  const { t, tl, money } = useT();
  const navigate = useNavigate();
  const bundle = useKioskStore((s) => s.bundle);
  const views = useMemo(() => productViews(bundle), [bundle]);
  const groups = useMemo(() => groupByCategory(views), [views]);
  const simplified = configBool(bundle, 'kiosk.simplifiedMode');
  const [accessible, setAccessible] = useState(false);

  const card = (view: ProductView) => {
    const { product, availability, state } = view;
    const reason = availability.reasons[0];
    const stateLabel = state === 'locked' ? t('kiosk.home.locked') : state === 'comingSoon' ? t('kiosk.home.coming_soon') : state === 'unavailable' ? t('kiosk.home.unavailable') : undefined;
    const final = finalPrice(view);
    const list = listPrice(view);
    return (
      <ChoiceCard
        key={product.id}
        title={tl(product.displayName)}
        subtitle={simplified ? undefined : tl(product.description)}
        price={final.amount === 0 ? t('kiosk.common.free') : money(final)}
        priceOriginal={list.amount > final.amount ? money(list) : undefined}
        image={resolveAssetUrl(bundle, product.coverAssetId)}
        state={state}
        stateLabel={stateLabel}
        reason={reason ? t(`kiosk.product.motivo.${reason}`) : undefined}
        meta={t('kiosk.common.minutes_approx', { minutes: Math.max(1, Math.round(product.estimatedDurationSec / 60)) })}
        size={simplified ? 'lg' : 'md'}
        onSelect={() => navigate(productRoute(product.id), { state: { accessible } })}
        data-testid={`product-${product.id}`}
      />
    );
  };

  return (
    <Shell
      headerEnd={
        <BigButton variant="ghost" icon={<Icon name="back" />} onClick={() => navigate(ROUTES.attract)}>
          {t('kiosk.common.back')}
        </BigButton>
      }
    >
      <h1 className="kiosk-title">{t('kiosk.home.title')}</h1>
      {!simplified ? (
        <div className="kiosk-row" style={{ marginBottom: 16 }}>
          <Toggle checked={accessible} onChange={setAccessible} label={t('kiosk.home.more_time')} description={t('kiosk.home.more_time_on')} />
        </div>
      ) : null}
      {views.length === 0 ? (
        <div className="kiosk-card">
          <p className="kiosk-lead">{t('kiosk.home.empty')}</p>
          <p className="kiosk-muted">{t('kiosk.home.empty_hint')}</p>
        </div>
      ) : (
        groups.map(({ category, items }) => (
          <section key={category} className="kiosk-stack" style={{ marginBottom: 28 }}>
            <h2 style={{ margin: 0 }}>{t(`kiosk.category.${category}`)}</h2>
            <div className="kiosk-grid">{items.map(card)}</div>
          </section>
        ))
      )}
    </Shell>
  );
}
