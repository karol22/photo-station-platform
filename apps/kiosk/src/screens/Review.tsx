/**
 * Revisión: foto recortada, criterios aprobados/advertencias, repetir (con retakes restantes) o
 * confirmar; `reviewTimeoutSec` como límite de la pantalla.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton, CompareView, CriteriaList, Icon, StatusPill, type CriteriaItem } from '@psp/ui';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { ROUTES, retakesLeft } from '../session/flow';
import { useSession } from '../session/useSession';

export function ReviewScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const { session, product, advance, goToStage } = useSession();
  const [compare, setCompare] = useState(false);

  const latest = useMemo(() => {
    if (!session) return [];
    const byIndex = new Map<number, (typeof session.captures)[number]>();
    for (const capture of session.captures) byIndex.set(capture.index, capture);
    return [...byIndex.values()].sort((a, b) => a.index - b.index);
  }, [session]);

  if (!session || !product) return null;
  const isDocument = product.kind === 'document';
  const current = latest[0];
  const previous = current?.retakeOf ? session.captures.find((c) => c.id === current.retakeOf) : undefined;
  const left = retakesLeft(product, session, isDocument ? 0 : undefined);
  const analysis = current?.analysis;
  const items: CriteriaItem[] = [
    ...(analysis?.passed ?? []).map((key) => ({ key, label: t(`criteria.${key}`), status: 'ok' as const })),
    ...(analysis?.warnings ?? []).map((key) => ({ key, label: t(`criteria.${key}`), status: 'warn' as const })),
    ...(analysis?.blocked ?? []).map((key) => ({ key, label: t(`criteria.${key}`), status: 'block' as const })),
  ];

  const retakePhoto = async () => {
    if (!current) return;
    await goToStage('capturing', 'retake');
    navigate(ROUTES.capture, { replace: true, state: isDocument ? { retakeOf: current.id } : { retakeOf: current.id, index: current.index } });
  };

  return (
    <SessionFrame title={isDocument ? t('kiosk.review.title') : t('kiosk.review.title_set')} timeoutSec={session.timers.reviewTimeoutSec}>
      {!current ? (
        <div className="kiosk-card">
          <p className="kiosk-lead">{t('kiosk.review.empty')}</p>
          <BigButton variant="primary" onClick={() => void goToStage('capturing', 'no_captures')}>{t('kiosk.review.go_capture')}</BigButton>
        </div>
      ) : (
        <div className="kiosk-edit">
          <div className="kiosk-stack">
            {compare && previous ? (
              <CompareView left={{ src: previous.url, label: t('kiosk.review.previous') }} right={{ src: current.url, label: t('kiosk.review.current') }} highlight="right" />
            ) : isDocument ? (
              <div className="kiosk-preview">
                <img src={current.editedUrl ?? current.url} alt={t('kiosk.review.title')} data-testid="review-image" />
              </div>
            ) : (
              <div className="kiosk-grid">
                {latest.map((c) => (
                  <img key={c.id} src={c.editedUrl ?? c.url} alt="" style={{ width: '100%', borderRadius: 16 }} />
                ))}
              </div>
            )}
            {previous && product.retakes.keepPreviousForCompare ? (
              <BigButton variant="ghost" onClick={() => setCompare((c) => !c)}>
                {t('kiosk.review.compare_previous')}
              </BigButton>
            ) : null}
          </div>
          <div className="kiosk-stack">
            {isDocument ? (
              <div className="kiosk-card kiosk-stack">
                {items.length > 0 ? (
                  <CriteriaList items={items} label={t('kiosk.review.approved')} statusLabels={{ ok: t('kiosk.capture.status_ok'), warn: t('kiosk.capture.status_warn'), block: t('kiosk.capture.status_block'), na: t('kiosk.capture.status_na') }} />
                ) : (
                  <p>{t('kiosk.review.no_warnings')}</p>
                )}
                {(analysis?.warnings.length ?? 0) > 0 ? <StatusPill tone="warn">{t('kiosk.review.warnings')}</StatusPill> : <StatusPill tone="ok">{t('kiosk.review.no_warnings')}</StatusPill>}
                <p className="kiosk-small kiosk-muted">{t('kiosk.review.frame_guide')}</p>
              </div>
            ) : null}
            <BigButton variant="primary" size="xl" block icon={<Icon name="check" />} onClick={() => void advance('review_confirmed')} data-testid="review-confirm">
              {t('kiosk.review.confirm')}
            </BigButton>
            <BigButton variant="secondary" block icon={<Icon name="retry" />} disabled={left === 0} onClick={() => void retakePhoto()} data-testid="review-retake">
              {t('kiosk.review.retake')}
            </BigButton>
            <p className="kiosk-small kiosk-muted">{left === 0 ? t('kiosk.capture.no_retakes') : left === 1 ? t('kiosk.capture.retake_one_left') : t('kiosk.capture.retakes_left', { n: left })}</p>
          </div>
        </div>
      )}
    </SessionFrame>
  );
}
