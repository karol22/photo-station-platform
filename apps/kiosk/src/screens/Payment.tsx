/**
 * PANTALLA 4 · Pago: el precio es la pantalla.
 *
 * Aquí no pasa nada durante unos segundos y la persona no puede hacer nada al respecto: toda la
 * pantalla trabaja para que esa espera se entienda. El precio ocupa el cartel a escala de titular,
 * tres de las caras de la familia hacen cola turnándose un salto —una espera con carácter, no un
 * disco girando— y el estado va debajo en tamaño de instrucción. Al aprobarse, la pantalla entera
 * corta de color en cero milisegundos: eso se ve desde el pasillo, y una etiqueta verde no.
 *
 * La lógica de cobro no cambia y no debe cambiar: el cerrojo que impide crear dos intentos al
 * entrar y que un reintento explícito suelta, la desaparición de «cancelar» en cuanto el cobro
 * queda comprometido, y el aviso de revisión que pide no irse. Lo que cambia es cómo se ve y cómo
 * se mueve.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PaymentState } from '@psp/contracts';
import { BlobFace, Marquee, assignAccentRoles, readBrandingAccents, type BlobVariant } from '@psp/ui';
import { stationApi } from '../api/station';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useSessionTimeout } from '../session/useSessionTimeout';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';

const SETTLED: PaymentState[] = ['approved', 'free', 'demo', 'not_required', 'operator_started'];
/** Estados en los que ya salió dinero: cancelar aquí sería quedarse con él. */
const COMMITTED: PaymentState[] = ['approved', 'under_review'];
const FAILED: PaymentState[] = ['declined', 'cancelled', 'expired', 'unavailable', 'device_out_of_service'];

/** Las tres caras que hacen cola mientras el lector responde. */
const QUEUE: BlobVariant[] = [1, 2, 3];

export function PaymentScreen() {
  const { t, tl, money } = useT();
  const { session, advance, cancel, fail } = useSession();
  const status = useKioskStore((s) => s.status);
  const bundle = useKioskStore((s) => s.bundle);
  const applyEvent = useKioskStore((s) => s.applyEvent);
  const [creating, setCreating] = useState(false);
  const advanced = useRef(false);
  const requested = useRef(false);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const intent = session?.payment;
  const state: PaymentState = intent?.state ?? session?.commercial.paymentState ?? 'awaiting';
  const canSimulate = (status?.demoMode || session?.isDemo || import.meta.env.DEV) && intent && !SETTLED.includes(state);
  const timeoutSec = session?.timers.paymentTimeoutSec ?? 0;

  // El mismo temporizador de siempre, con la marquesina como cara visible: nunca hay un contador
  // en rojo en el recorrido social. Con dinero de por medio la sesión no se cancela: sigue sola.
  const timeout = useSessionTimeout(true, timeoutSec > 0 ? timeoutSec : undefined, {
    onAutoAdvance: () => void advanceRef.current('idle_auto_advance'),
  });

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

  // El campo de la espera se elige por papel y no por índice, y con una condición: no puede ser el
  // color con el que se confirma. Si coincidieran, el corte de pantalla al aprobarse —lo único de
  // esta pantalla que se ve desde el pasillo— no existiría.
  const waitingField = useMemo(() => {
    const roles = assignAccentRoles(readBrandingAccents(bundle?.effective.values ?? {}));
    return roles.etapas.find((color) => color !== roles.confirma) ?? roles.luz;
  }, [bundle]);

  if (!session) return null;
  const amount = session.commercial.finalPrice ?? intent?.amount;
  const settled = SETTLED.includes(state);
  const failed = FAILED.includes(state);
  const waiting = !settled && !failed;
  const fieldStyle = waiting ? ({ ['--psp-field']: waitingField } as CSSProperties) : undefined;
  const footerText = configString(bundle, 'branding.footerText');
  const hint = state === 'under_review'
    ? t('kiosk.payment.under_review_hint')
    : state === 'declined'
      ? t('kiosk.payment.declined_hint')
      : state === 'device_out_of_service' || state === 'unavailable'
        ? t('kiosk.payment.device_out_hint')
        : creating
          ? t('kiosk.payment.starting')
          : t('kiosk.payment.hint');

  return (
    <Shell
      bleed
      hideHeader
      hideLang
      marquee={<Marquee cadence={settled ? 'still' : 'work'} remaining={timeout.total > 0 ? timeout.remaining / timeout.total : 1} />}
    >
      <div className="kiosk-pago" style={fieldStyle} data-settled={settled ? 'true' : undefined} data-failed={failed ? 'true' : undefined} data-testid="payment">
        {/* CARTEL: el precio, la cola de caras y el estado. Nada táctil. */}
        <div className="kiosk-pago__cartel">
          <span className="kiosk-pago__total">{t('kiosk.payment.total')}</span>
          <span className="kiosk-pago__precio" data-testid="payment-amount">
            {amount ? money(amount) : t('kiosk.common.free')}
          </span>
          {settled ? (
            <span className="kiosk-pago__listo">{t('kiosk.payment.done')}</span>
          ) : (
            <div className="kiosk-pago__cola" data-waiting={waiting ? 'true' : undefined} aria-hidden="true">
              {QUEUE.map((variant) => (
                <span key={variant} className="kiosk-pago__cola-uno">
                  <BlobFace variant={variant} size={260} />
                </span>
              ))}
            </div>
          )}
          <p className="kiosk-pago__estado" aria-live="polite" data-testid="payment-state">
            {t(`kiosk.payment.estado.${state}`)}
          </p>
        </div>

        {/* REPISA: lo que hay que hacer, o lo que está pasando. */}
        <div className="kiosk-pago__repisa">
          <p className="kiosk-pago__pista">{intent?.message ? tl(intent.message) : hint}</p>
        </div>

        {/* ALCANCE: sólo aparece lo que se puede hacer ahora mismo. */}
        <div className="kiosk-pago__alcance">
          {failed ? (
            <button type="button" className="kiosk-pago__cta" disabled={creating} onClick={() => void createIntent(true)} data-testid="payment-retry">
              {creating ? t('kiosk.common.loading') : t('kiosk.payment.retry')}
            </button>
          ) : null}
          {/* Con el cobro ya hecho, cancelar desaparece: la sesión continúa. Dejar el botón ahí
              durante los 900 ms que tarda el avance es ofrecerle a alguien tirar lo que pagó. */}
          {COMMITTED.includes(state) ? null : (
            <button type="button" className="kiosk-pago__salida" onClick={() => void cancel('payment_cancelled')} data-testid="payment-cancel">
              {t('kiosk.common.cancel')}
            </button>
          )}
          {/* Los atajos de simulación viven aquí y no en el zócalo porque el zócalo no se toca:
              nada táctil por debajo de la banda de alcance, ni siquiera algo que sólo existe en
              demostración. */}
          {canSimulate ? (
            <div className="kiosk-pago__demo">
              <span>{t('kiosk.payment.simulate_title')}</span>
              <button type="button" onClick={() => void stationApi.simulatePayment(intent.id, 'approve').then((i) => applyEvent({ type: 'payment', intent: i })).catch(fail)} data-testid="payment-simulate-approve">
                {t('kiosk.payment.simulate_approve')}
              </button>
              <button type="button" onClick={() => void stationApi.simulatePayment(intent.id, 'decline').then((i) => applyEvent({ type: 'payment', intent: i })).catch(fail)}>
                {t('kiosk.payment.simulate_decline')}
              </button>
              <button type="button" onClick={() => void stationApi.simulatePayment(intent.id, 'expire').then((i) => applyEvent({ type: 'payment', intent: i })).catch(fail)}>
                {t('kiosk.payment.simulate_expire')}
              </button>
            </div>
          ) : null}
        </div>

        {/* ZÓCALO: lo que la operación obliga a decir, en tinta plena y fuera del camino. */}
        <div className="kiosk-pago__zocalo">{footerText ? <span>{footerText}</span> : null}</div>
      </div>
    </Shell>
  );
}
