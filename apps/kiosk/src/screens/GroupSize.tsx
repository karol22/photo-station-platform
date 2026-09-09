/**
 * Paso 2 del recorrido: *¿Cuántos son hoy?*
 *
 * La pregunta que abre la sesión no es qué producto quieres, es quién viene contigo. La cantidad
 * de personas decide qué experiencias tienen sentido y, más adelante, el encuadre y la guía de
 * pose. Si sólo queda una experiencia posible, el recorrido sigue solo y la persona se ahorra un
 * toque; si quedan varias, elige entre ellas.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlobFace } from '@psp/ui';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { productViews, type ProductView } from '../lib/products';
import { GROUP_OPTIONS, viewsForGroup, type GroupOption } from '../lib/groups';
import { ROUTES, productRoute } from '../session/flow';
import { useKioskStore } from '../store';

/** El tamaño de cada forma cede ante la cantidad: seis caben sin desbordar la tarjeta. */
function blobSize(count: number): number {
  if (count <= 1) return 88;
  if (count <= 2) return 76;
  if (count <= 3) return 62;
  return 44;
}

export function GroupSizeScreen(): React.ReactElement {
  const { t } = useT();
  const navigate = useNavigate();
  const bundle = useKioskStore((s) => s.bundle);
  const setGroupSize = useKioskStore((s) => s.setGroupSize);

  const views = useMemo(() => productViews(bundle).filter((v) => v.availability.available), [bundle]);

  const matchesFor = (option: GroupOption): ProductView[] => viewsForGroup(bundle, views, option);

  const choose = (option: GroupOption): void => {
    setGroupSize(option.min);
    const matches = matchesFor(option);
    // Un solo camino posible: no lo conviertas en una pregunta.
    if (matches.length === 1 && matches[0]) navigate(productRoute(matches[0].product.id));
    else navigate(ROUTES.home);
  };

  return (
    <Shell
      contentAlign="center"
      headerEnd={
        <button type="button" className="kiosk-chip" onClick={() => navigate(ROUTES.attract)} data-testid="group-back">
          {t('common.atras')}
        </button>
      }
    >
      <div className="kiosk-group" data-testid="group-size">
        <h1 className="kiosk-title">{t('kiosk.group.title')}</h1>
        <p className="kiosk-lead">{t('kiosk.group.subtitle')}</p>
        <div className="kiosk-group__options">
          {GROUP_OPTIONS.map((option) => {
            const count = matchesFor(option).length;
            return (
              <button
                key={option.key}
                type="button"
                className="kiosk-group__option"
                onClick={() => choose(option)}
                disabled={count === 0}
                data-testid={`group-${option.key}`}
              >
                <span
                  className="kiosk-group__blobs"
                  style={{ ['--blob-overlap' as string]: `${Math.round(blobSize(option.blobs.length) * 0.22)}px` }}
                >
                  {option.blobs.map((variant, i) => (
                    <BlobFace key={`${option.key}-${variant}-${i}`} variant={variant} size={blobSize(option.blobs.length)} animated />
                  ))}
                </span>
                <span className="kiosk-group__label">{t(`kiosk.group.${option.key}`)}</span>
                {count === 0 ? <span className="kiosk-small kiosk-muted">{t('kiosk.group.none')}</span> : null}
              </button>
            );
          })}
        </div>
        {views.some((v) => v.product.kind === 'document') ? (
          <button type="button" className="kiosk-chip" onClick={() => navigate(ROUTES.home)} data-testid="group-all">
            {t('kiosk.group.see_all')}
          </button>
        ) : null}
        <p className="kiosk-small kiosk-muted">{t('kiosk.group.hint')}</p>
      </div>
    </Shell>
  );
}
