/**
 * Finalización: cierra la sesión en el agente (`POST /finish`), muestra resumen, aviso de
 * retención, agradecimiento, entrega digital (próximamente si la feature lo dice), promoción de
 * otra experiencia y vuelve sola a atracción a los 10 s limpiando todo el estado.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CustomerHandoff, FinishSessionResponse } from '@psp/contracts';
import { featureMode } from '@psp/domain';
import { BigButton, Countdown, Icon, StatusPill } from '@psp/ui';
import { stationApi } from '../api/station';
import { HandoffPanel } from '../components/HandoffPanel';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { productViews } from '../lib/products';
import { ROUTES } from '../session/flow';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';

const BACK_SECONDS = 10;
type Finished = ReturnType<typeof FinishSessionResponse.parse>;

export function FinishScreen() {
  const { t, tl } = useT();
  const navigate = useNavigate();
  const session = useKioskStore((s) => s.session);
  const bundle = useKioskStore((s) => s.bundle);
  const resetSession = useKioskStore((s) => s.resetSession);
  const [result, setResult] = useState<Finished | undefined>();
  const [settled, setSettled] = useState(false);
  const [seconds, setSeconds] = useState(BACK_SECONDS);
  const finished = useRef(false);

  useEffect(() => {
    if (!session || finished.current) return;
    finished.current = true;
    if (session.stage === 'done') {
      setSettled(true);
      return;
    }
    stationApi
      .finish(session.id)
      .then(setResult)
      .catch(() => undefined)
      .finally(() => setSettled(true));
  }, [session]);

  useEffect(() => {
    if (session && !settled) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [settled, session]);

  useEffect(() => {
    if (seconds <= 0) {
      resetSession();
      navigate(ROUTES.attract, { replace: true });
    }
  }, [seconds, resetSession, navigate]);

  const promo = useMemo(() => productViews(bundle).find((v) => v.availability.available && v.product.id !== session?.product.id && v.product.kind !== 'document'), [bundle, session?.product.id]);
  const delivery = featureMode(bundle?.features ?? [], 'delivery.digital');
  const handoffMode = featureMode(bundle?.features ?? [], 'customer.handoff');
  const [handoff, setHandoff] = useState<CustomerHandoff | undefined>(undefined);
  const status = useKioskStore((s) => s.status);
  const canSimulate = Boolean(status?.demoMode || session?.isDemo || import.meta.env.DEV);
  const requested = useRef(false);

  // Membresía del Club: el enlace identifica a la persona, nunca transporta la fotografía.
  // Nace al llegar aquí y muere con la sesión, así la persona siguiente nunca lo hereda.
  useEffect(() => {
    if (handoffMode !== 'enabled' || !session || requested.current) return;
    requested.current = true;
    void stationApi.createHandoff(session.id, 'loyalty').then(setHandoff).catch(() => undefined);
  }, [handoffMode, session]);

  const simulate = async (outcome: 'link' | 'expire'): Promise<void> => {
    if (!handoff) return;
    setHandoff(await stationApi.simulateHandoff(handoff.id, outcome).catch(() => handoff));
  };
  const completion = configString(bundle, 'branding.completionMessage');
  const printed = session?.printJobs.filter((j) => j.status === 'completed').reduce((n, j) => n + j.copies, 0) ?? 0;

  return (
    <Shell contentAlign="center" hideLang>
      <div className="kiosk-card kiosk-stack" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 720, margin: '0 auto' }} data-testid="finish">
        <Icon name="check" size={96} />
        <h1 className="kiosk-title" style={{ margin: 0 }}>{t('kiosk.done.title')}</h1>
        <p className="kiosk-lead">{completion || t('kiosk.done.thanks')}</p>
        {session ? (
          <ul className="kiosk-list" style={{ width: '100%', textAlign: 'left' }}>
            <li>
              <span>{t('kiosk.done.summary')}</span>
              <span>{tl(session.product.displayName)}</span>
            </li>
            <li>
              <span>{t('kiosk.done.session_code')}</span>
              <span>{session.code}</span>
            </li>
            {session.product.printCount > 0 ? (
              <li>
                <span>{t('kiosk.done.print_status')}</span>
                <span>{t('kiosk.done.printed_n', { done: printed, total: session.copies })}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
        <p className="kiosk-small">{result ? tl(result.retentionNotice) : session ? tl(session.retention.customerText) : ''}</p>
        {/* Enlace efímero: sólo aparece donde la marca lo habilitó; el recorrido normal es anónimo. */}
        {handoffMode === 'enabled' ? (
          <HandoffPanel handoff={handoff} canSimulate={canSimulate} onSimulate={(outcome) => void simulate(outcome)} />
        ) : null}
        {handoffMode !== 'enabled' && delivery === 'coming_soon' ? <StatusPill tone="info" icon={<Icon name="clock" />}>{t('kiosk.delivery.coming_soon')}</StatusPill> : null}
        {delivery === 'locked' ? <StatusPill tone="neutral" icon={<Icon name="lock" />}>{t('kiosk.delivery.locked')}</StatusPill> : null}
        {promo ? <p className="kiosk-muted">{t('kiosk.done.promo')}: {tl(promo.product.displayName)}</p> : null}
        <Countdown seconds={Math.max(0, seconds)} total={BACK_SECONDS} size={96} label={t('kiosk.done.back_in', { seconds: Math.max(0, seconds) })} />
        <BigButton variant="primary" size="xl" onClick={() => setSeconds(0)} data-testid="finish-home">
          {t('kiosk.done.back_now')}
        </BigButton>
      </div>
    </Shell>
  );
}
