/**
 * Pago: crea el intento al entrar, muestra el estado (`kiosk.payment.estado.*`) que llega por SSE,
 * avanza solo cuando queda aprobado/gratis/demo y ofrece cancelar/reintentar. En demo o en
 * desarrollo aparece un botón discreto para simular el resultado.
 */
import { useEffect, useRef, useState } from 'react';
import type { PaymentState } from '@psp/contracts';
import { BigButton, PriceTag, Spinner, StatusPill } from '@psp/ui';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';

const SETTLED: PaymentState[] = ['approved', 'free', 'demo', 'not_required', 'operator_started'];
/** Estados en los que ya salió dinero: cancelar aquí sería quedarse con él. */
const COMMITTED: PaymentState[] = ['approved', 'under_review'];
const FAILED: PaymentState[] = ['declined', 'cancelled', 'expired', 'unavailable', 'device_out_of_service'];

export function PaymentScreen() {
  const { t, tl, money } = useT();
  const { session, advance, cancel, fail } = useSession();
  const status = useKioskStore((s) => s.status);
  const applyEvent = useKioskStore((s) => s.applyEvent);
  const [creating, setCreating] = useState(false);
  const advanced = useRef(false);
  const requested = useRef(false);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const intent = session?.payment;
  const state: PaymentState = intent?.state ?? session?.commercial.paymentState ?? 'awaiting';
  const canSimulate = (status?.demoMode || session?.isDemo || import.meta.env.DEV) && intent && !SETTLED.includes(state);

  const createIntent = async (retry = false) => {
    if (!session) return;
    // El cerrojo evita crear dos intentos al entrar; un reintento explícito lo suelta, porque
    // si no, el botón «reintentar» no hace absolutamente nada. El agente deduplica del otro lado.
    if (requested.current && !retry) return;
    requested.current = true;
    setCreating(true);
    try {
      const created = await stationApi.createPaymentIntent(session.id);
      applyEvent({ type: 'payment', intent: created });
    } catch (error) {
      fail(error, 'payment_unavailable');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (session && !session.payment && !SETTLED.includes(session.commercial.paymentState)) void createIntent();
    // Sólo al entrar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Depende sólo del estado: los eventos SSE que refrescan la sesión no deben cancelar el avance.
  useEffect(() => {
    if (!SETTLED.includes(state) || advanced.current) return undefined;
    advanced.current = true;
    const timer = setTimeout(() => void advanceRef.current('payment_settled'), 900);
    return () => clearTimeout(timer);
  }, [state]);

  if (!session) return null;
  const amount = session.commercial.finalPrice ?? intent?.amount;
  const failed = FAILED.includes(state);
  const tone = SETTLED.includes(state) ? 'ok' : failed ? 'danger' : state === 'under_review' ? 'warn' : 'info';
  const timeout = session.timers.paymentTimeoutSec;

  return (
    <SessionFrame title={t('kiosk.payment.title')} timeoutSec={timeout > 0 ? timeout : undefined}>
      <div className="kiosk-card kiosk-stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <PriceTag value={amount ? money(amount) : t('kiosk.common.free')} size="xl" label={t('kiosk.payment.total')} />
        <StatusPill tone={tone} size="lg" pulse={!SETTLED.includes(state) && !failed}>
          {t(`kiosk.payment.estado.${state}`)}
        </StatusPill>
        {intent?.message ? <p>{tl(intent.message)}</p> : null}
        {!SETTLED.includes(state) && !failed ? (
          <>
            <Spinner size="lg" label={t('kiosk.payment.hint')} />
            <p className="kiosk-lead">{creating ? t('kiosk.payment.starting') : t('kiosk.payment.hint')}</p>
          </>
        ) : null}
        {state === 'under_review' ? <p className="kiosk-lead">{t('kiosk.payment.under_review_hint')}</p> : null}
        {state === 'declined' ? <p>{t('kiosk.payment.declined_hint')}</p> : null}
        {state === 'device_out_of_service' || state === 'unavailable' ? <p>{t('kiosk.payment.device_out_hint')}</p> : null}
      </div>
      <div className="kiosk-actions">
        {/* Con el cobro ya hecho, cancelar desaparece: la sesión continúa. Dejar el botón ahí
            durante los 900 ms que tarda el avance es ofrecerle a alguien tirar lo que pagó. */}
        {COMMITTED.includes(state) ? null : (
          <BigButton variant="secondary" onClick={() => void cancel('payment_cancelled')}>
            {t('kiosk.common.cancel')}
          </BigButton>
        )}
        {failed ? (
          <BigButton variant="primary" size="xl" loading={creating} loadingLabel={t('kiosk.common.loading')} onClick={() => void createIntent(true)} data-testid="payment-retry">
            {t('kiosk.payment.retry')}
          </BigButton>
        ) : null}
      </div>
      {canSimulate ? (
        <div className="kiosk-card" style={{ marginTop: 24 }}>
          <p className="kiosk-small kiosk-muted">{t('kiosk.payment.simulate_title')}</p>
          <div className="kiosk-chips">
            <button type="button" className="kiosk-chip" onClick={() => void stationApi.simulatePayment(intent.id, 'approve').then((i) => applyEvent({ type: 'payment', intent: i })).catch(fail)} data-testid="payment-simulate-approve">
              {t('kiosk.payment.simulate_approve')}
            </button>
            <button type="button" className="kiosk-chip" onClick={() => void stationApi.simulatePayment(intent.id, 'decline').then((i) => applyEvent({ type: 'payment', intent: i })).catch(fail)}>
              {t('kiosk.payment.simulate_decline')}
            </button>
            <button type="button" className="kiosk-chip" onClick={() => void stationApi.simulatePayment(intent.id, 'expire').then((i) => applyEvent({ type: 'payment', intent: i })).catch(fail)}>
              {t('kiosk.payment.simulate_expire')}
            </button>
          </div>
        </div>
      ) : null}
    </SessionFrame>
  );
}
