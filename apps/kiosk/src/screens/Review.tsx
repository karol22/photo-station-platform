/**
 * Revisión: la pantalla donde la persona ve lo que salió.
 *
 * Son dos pantallas distintas con el mismo nombre, porque son dos negocios distintos.
 *
 * **Recorrido social (PANTALLA 6).** Se dispara de más justamente para que nadie tenga que
 * aprobar de una en una: seis tomas, cuatro huecos, y la única decisión es apagar las que sobran.
 * Arriba está lo que se lleva, a tamaño de cartel; abajo, a la altura de la mano, están las seis
 * tomas, y tocar una la apaga o la vuelve a encender. El hueco vacío es la instrucción: mientras
 * se vea un hueco, falta una foto, y no hace falta un contador que lo diga.
 *
 * Aquí también murió la pantalla de selección: mirar las tomas y quedarse con unas cuantas era
 * una sola decisión partida en dos, y se cobraba dos veces con alguien esperando detrás.
 *
 * **Recorrido documental.** Ahí la fidelidad manda y la revisión con criterios se queda entera:
 * una foto, lo que cumple y lo que no, y repetir mientras queden repeticiones.
 *
 * Nada táctil vive por encima de la banda REPISA: a metro y medio, la banda alta es la cara.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bestCaptures } from '@psp/domain';
import { BigButton, BlobFace, CompareView, CriteriaList, Icon, Marquee, StatusPill, type CriteriaItem } from '@psp/ui';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { ROUTES, retakesLeft } from '../session/flow';
import { useSession } from '../session/useSession';
import { useSessionTimeout } from '../session/useSessionTimeout';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';

/** Lo mínimo que la revisión necesita saber de una toma. */
type Shot = { id: string; index: number };

/**
 * Lo que la persona se lleva: las tomas encendidas, **en el orden en que se tomaron**.
 *
 * El orden es el cronológico y no el de los toques: una tira cuenta una historia y saltarse el
 * tiempo la rompe. Por eso aquí no hay flechas de reordenar: no hay nada que ordenar.
 */
export function keptShots<T extends Shot>(captures: readonly T[], selected: readonly string[]): T[] {
  return captures.filter((capture) => selected.includes(capture.id));
}

/**
 * Apaga o enciende una toma. Con la tira llena, encender otra exigiría apagar una sola: el orden
 * natural es apagar primero, así que la toma apagada espera en vez de convertirse en un error.
 * Devuelve la misma lista cuando el toque no cambia nada, para no repintar de balde.
 */
export function toggleShot(selected: readonly string[], id: string, max: number): string[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  if (selected.length >= max) return [...selected];
  return [...selected, id];
}

export function ReviewScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const { session, product, experience, template, advance, goToStage, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const setSession = useKioskStore((s) => s.setSession);
  const [compare, setCompare] = useState(false);
  // Confirmar y repetir hablan con el agente. Sin cerrojo, un doble toque —el gesto natural de
  // quien no está seguro de que la pantalla registró— manda dos avances de etapa.
  const [busy, setBusy] = useState<'confirm' | 'retake' | undefined>();
  const [saving, setSaving] = useState(false);
  const [chosen, setChosen] = useState<string[] | undefined>();

  const captures = useMemo(() => {
    if (!session) return [];
    const byIndex = new Map<number, (typeof session.captures)[number]>();
    for (const capture of session.captures) byIndex.set(capture.index, capture);
    return [...byIndex.values()].sort((a, b) => a.index - b.index);
  }, [session]);

  const slots = template?.photoSlots ?? product?.captureCount ?? 0;
  const max = experience?.selection.max ?? slots;
  /**
   * La cabina llega con una propuesta hecha, no con una rejilla vacía: las peores ya vienen
   * apagadas. Quien esté conforme toca continuar y se va; quien no, toca dos veces.
   */
  const initial = useMemo(
    () => (session?.selection.length ? session.selection : bestCaptures(captures, max)),
    [session?.selection, captures, max],
  );
  const selected = chosen ?? initial;
  /** Lo que se lleva, siempre en el orden en que se tomó: una tira cuenta una historia. */
  const kept = useMemo(() => keptShots(captures, selected), [captures, selected]);
  const min = experience?.selection.min ?? Math.min(slots, captures.length);
  const valid = kept.length >= min && kept.length <= max;

  const confirm = async (ids: string[] = kept.map((c) => c.id)) => {
    if (!session || saving) return;
    setSaving(true);
    try {
      const updated = await stationApi.setSelection(session.id, ids);
      setSession(updated);
      await advance('selection_done');
    } catch (error) {
      setSaving(false);
      fail(error);
    }
  };

  /**
   * Si se acaba el tiempo, la cabina elige por su cuenta las mejores y continúa. Quedarse
   * congelada aquí sería lo peor: la persona ya pagó y sus fotos ya existen.
   */
  const autoSelect = () => {
    if (saving) return;
    void confirm(kept.length >= min ? kept.map((c) => c.id) : bestCaptures(captures, max));
  };

  const isDocument = product?.kind === 'document';
  // El reloj de la pantalla es la marquesina, no una barra con números: los focos se van apagando.
  // En documental el marco de sesión sigue trayendo el suyo, así que aquí sólo cuenta para el
  // recorrido social.
  const timeout = useSessionTimeout(!isDocument, session?.timers.reviewTimeoutSec, { onAutoAdvance: autoSelect });

  if (!session || !product) return null;

  if (!isDocument) {
    if (captures.length === 0) return <EmptyReview onCapture={() => void goToStage('capturing', 'no_captures')} />;
    return (
      <Shell bleed hideHeader hideLang marquee={<Marquee cadence="wait" remaining={timeout.total > 0 ? timeout.remaining / timeout.total : 1} />}>
        <div className="kiosk-revision" data-testid="review">
          {/* CARTEL: una sola cosa, lo que te llevas. Cero objetivos táctiles a la altura de la cara. */}
          <div className="kiosk-revision__cartel">
            <ul
              className="kiosk-revision__tira"
              aria-label={t('kiosk.review.result_label')}
              // Dos columnas en cuanto hay más de dos huecos: en vertical, cuatro fotos en fila
              // salen del tamaño de un sello y dejan el cartel medio vacío.
              style={{ ['--psp-tira-cols' as string]: Math.min(2, Math.max(1, max)) }}
            >
              {Array.from({ length: Math.max(1, max) }, (_unused, i) => {
                const capture = kept[i];
                return (
                  <li key={capture?.id ?? `hueco-${i}`} className="kiosk-revision__hueco" data-empty={capture ? undefined : 'true'}>
                    {capture ? (
                      <img src={capture.editedUrl ?? capture.url} alt="" className="kiosk-revision__foto" />
                    ) : (
                      <span className="kiosk-revision__hueco-texto">{t('kiosk.review.empty_slot')}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* REPISA: las seis tomas, a la altura de la mano. Tocar apaga; volver a tocar enciende. */}
          <div className="kiosk-revision__repisa">
            <p className="kiosk-revision__pista">
              <BlobFace variant={2} size={56} expression="grin" animated />
              <span>
                {valid
                  ? `${t('kiosk.review.take_n', { n: kept.length })} · ${t('kiosk.review.tap_to_drop')}`
                  : t('kiosk.review.tap_to_keep')}
              </span>
            </p>
            <ul className="kiosk-revision__tomas" aria-label={t('kiosk.review.shots_label')}>
              {captures.map((capture) => {
                const isKept = selected.includes(capture.id);
                const blocked = !isKept && kept.length >= max;
                return (
                  <li key={capture.id}>
                    <button
                      type="button"
                      className="kiosk-revision__toma"
                      data-kept={isKept ? 'true' : undefined}
                      aria-pressed={isKept}
                      aria-disabled={blocked || undefined}
                      onClick={() => setChosen(toggleShot(selected, capture.id, max))}
                      data-testid={`review-shot-${capture.index}`}
                    >
                      <img src={capture.editedUrl ?? capture.url} alt="" className="kiosk-revision__foto" />
                      <span className="kiosk-revision__estado">{isKept ? t('kiosk.review.kept') : t('kiosk.review.dropped')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ALCANCE: exactamente una acción, ancho completo, a la altura del pulgar. */}
          <div className="kiosk-revision__alcance">
            <button
              type="button"
              className="kiosk-revision__accion"
              disabled={!valid || saving}
              onClick={() => void confirm()}
              data-testid="review-confirm"
            >
              {saving ? t('kiosk.common.loading') : t('kiosk.review.looks_good')}
            </button>
          </div>

          <div className="kiosk-revision__zocalo">
            <span>{bundle?.machine.code}</span>
            {configString(bundle, 'branding.footerText') ? <span>{configString(bundle, 'branding.footerText')}</span> : null}
          </div>
        </div>
      </Shell>
    );
  }

  return <DocumentReview {...{ session, product, captures, compare, setCompare, busy, setBusy, advance, goToStage, navigate }} />;
}

/** Sin capturas no hay nada que revisar: la única salida es volver a la cámara. */
function EmptyReview({ onCapture }: { onCapture: () => void }) {
  const { t } = useT();
  return (
    <SessionFrame title={t('kiosk.review.title_set')} noTimeout>
      <p className="kiosk-lead">{t('kiosk.review.empty')}</p>
      <BigButton variant="primary" onClick={onCapture}>{t('kiosk.review.go_capture')}</BigButton>
    </SessionFrame>
  );
}

type DocumentReviewProps = {
  session: NonNullable<ReturnType<typeof useSession>['session']>;
  product: NonNullable<ReturnType<typeof useSession>['product']>;
  captures: NonNullable<ReturnType<typeof useSession>['session']>['captures'];
  compare: boolean;
  setCompare: (fn: (c: boolean) => boolean) => void;
  busy: 'confirm' | 'retake' | undefined;
  setBusy: (value: 'confirm' | 'retake' | undefined) => void;
  advance: (reason?: string) => Promise<void>;
  goToStage: (stage: 'capturing', reason?: string) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
};

/**
 * Revisión documental: criterios, advertencias y repetir. Sobria a propósito —crema, un solo
 * acento, cero siluetas sobre la foto— porque a una fotografía de trámite no se le aplica nada
 * que altere la fidelidad de la imagen, y comparar aquí es la prueba de que no se alteró.
 */
function DocumentReview({ session, product, captures, compare, setCompare, busy, setBusy, advance, goToStage, navigate }: DocumentReviewProps) {
  const { t } = useT();
  const current = captures[0];
  const previous = current?.retakeOf ? session.captures.find((c) => c.id === current.retakeOf) : undefined;
  const left = retakesLeft(product, session, 0);
  const analysis = current?.analysis;
  const items: CriteriaItem[] = [
    ...(analysis?.passed ?? []).map((key) => ({ key, label: t(`criteria.${key}`), status: 'ok' as const })),
    ...(analysis?.warnings ?? []).map((key) => ({ key, label: t(`criteria.${key}`), status: 'warn' as const })),
    ...(analysis?.blocked ?? []).map((key) => ({ key, label: t(`criteria.${key}`), status: 'block' as const })),
  ];

  const retakePhoto = async () => {
    if (!current || busy) return;
    setBusy('retake');
    await goToStage('capturing', 'retake');
    navigate(ROUTES.capture, { replace: true, state: { retakeOf: current.id } });
  };

  if (!current) return <EmptyReview onCapture={() => void goToStage('capturing', 'no_captures')} />;

  return (
    <SessionFrame title={t('kiosk.review.title')} timeoutSec={session.timers.reviewTimeoutSec} onAutoAdvance={() => void advance('review_auto_confirmed')}>
      <div className="kiosk-revision-doc">
        <div className="kiosk-revision-doc__vista">
          {compare && previous ? (
            <CompareView left={{ src: previous.url, label: t('kiosk.review.previous') }} right={{ src: current.url, label: t('kiosk.review.current') }} highlight="right" />
          ) : (
            <img src={current.editedUrl ?? current.url} alt={t('kiosk.review.title')} className="kiosk-revision-doc__foto" data-testid="review-image" />
          )}
          {previous && product.retakes.keepPreviousForCompare ? (
            <BigButton variant="ghost" onClick={() => setCompare((c) => !c)}>
              {t('kiosk.review.compare_previous')}
            </BigButton>
          ) : null}
        </div>
        <div className="kiosk-revision-doc__criterios">
          {items.length > 0 ? (
            <CriteriaList items={items} label={t('kiosk.review.approved')} statusLabels={{ ok: t('kiosk.capture.status_ok'), warn: t('kiosk.capture.status_warn'), block: t('kiosk.capture.status_block'), na: t('kiosk.capture.status_na') }} />
          ) : (
            <p>{t('kiosk.review.no_warnings')}</p>
          )}
          {(analysis?.warnings.length ?? 0) > 0 ? <StatusPill tone="warn">{t('kiosk.review.warnings')}</StatusPill> : <StatusPill tone="ok">{t('kiosk.review.no_warnings')}</StatusPill>}
          <p className="kiosk-small kiosk-muted">{t('kiosk.review.frame_guide')}</p>
          <BigButton
            variant="primary"
            size="xl"
            block
            icon={<Icon name="check" />}
            loading={busy === 'confirm'}
            loadingLabel={t('kiosk.common.loading')}
            disabled={!!busy}
            onClick={() => {
              if (busy) return;
              setBusy('confirm');
              void advance('review_confirmed');
            }}
            data-testid="review-confirm"
          >
            {t('kiosk.review.confirm')}
          </BigButton>
          <BigButton variant="secondary" block icon={<Icon name="retry" />} loading={busy === 'retake'} loadingLabel={t('kiosk.common.loading')} disabled={left === 0 || !!busy} onClick={() => void retakePhoto()} data-testid="review-retake">
            {t('kiosk.review.retake')}
          </BigButton>
          <p className="kiosk-small kiosk-muted">{left === 0 ? t('kiosk.capture.no_retakes') : left === 1 ? t('kiosk.capture.retake_one_left') : t('kiosk.capture.retakes_left', { n: left })}</p>
        </div>
      </div>
    </SessionFrame>
  );
}
