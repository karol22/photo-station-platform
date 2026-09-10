/**
 * Impresión: los estados del trabajo llegan por SSE y la pantalla los cuenta sin hacer esperar a
 * nadie mirando un giro de cargador.
 *
 * Aquí empieza la celebración del producto, así que lo que ocupa la pantalla es el resultado, a
 * sangre, y no una tarjeta blanca centrada con el estado de la impresora. El estado sigue estando
 * —la persona tiene derecho a saber si algo falló—, pero como rótulo sobre el campo y en la banda
 * que se toca, no como un dato de operación en medio de la cara.
 */
import { useEffect, useRef, useState } from 'react';
import { BigButton, Icon, Marquee } from '@psp/ui';
import { stationApi } from '../api/station';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';
import { ClosingFooter, ClosingFlock } from './Finish';

export function PrintScreen() {
  const { t } = useT();
  const { session, advance, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const status = useKioskStore((s) => s.status);
  const setSession = useKioskStore((s) => s.setSession);
  const [retrying, setRetrying] = useState(false);
  const advanced = useRef(false);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const job = session?.printJobs.at(-1);
  const printer = status?.printers.find((p) => p.id === job?.printerId);
  const state = job?.status ?? 'preparing';

  // Depende sólo del estado del trabajo: un refresco de sesión por SSE no debe cancelar el avance.
  useEffect(() => {
    if (state !== 'completed' || advanced.current) return undefined;
    advanced.current = true;
    const timer = setTimeout(() => void advanceRef.current('print_completed'), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  if (!session) return null;
  const pickup = configString(bundle, 'printing.pickupInstructions') ?? t('kiosk.printing.pickup_default');
  const broken = state === 'failed' || state === 'cancelled';
  const printerIssue = printer?.status === 'no_paper' ? t('kiosk.printing.no_paper') : printer?.status === 'jam' ? t('kiosk.printing.jam') : job?.error;

  const retry = async () => {
    setRetrying(true);
    try {
      const updated = await stationApi.print(session.id, { copies: session.copies, ...(job ? { printerId: job.printerId } : {}), idempotencyKey: `${session.id}:print:${session.printJobs.length + 1}` });
      setSession(updated);
    } catch (error) {
      fail(error, 'print_failed');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Shell bleed hideHeader hideLang marquee={<Marquee cadence={state === 'completed' ? 'still' : 'work'} />}>
      <div className="kiosk-cierre" data-stage="print" data-testid="print">
        <div className="kiosk-cierre__cartel">
          <p className="kiosk-cierre__rotulo">{t(`kiosk.printing.status.${state}`)}</p>
          <div className="kiosk-cierre__entrega kiosk-cierre__entrega--sola">
            {session.composition ? (
              <img className="kiosk-cierre__resultado" src={session.composition.url} alt={t('kiosk.compose.result')} data-testid="print-result" />
            ) : (
              <ClosingFlock />
            )}
          </div>
        </div>

        <div className="kiosk-cierre__repisa">
          {broken ? (
            <p className="kiosk-cierre__estado" data-testid="print-issue">{printerIssue ?? t('kiosk.printing.error')}</p>
          ) : state === 'completed' ? (
            <p className="kiosk-cierre__estado">{pickup}</p>
          ) : (
            <ClosingFlock />
          )}
        </div>

        <div className="kiosk-cierre__alcance">
          {broken ? (
            <>
              <BigButton className="kiosk-cierre__accion" variant="primary" size="xl" block icon={<Icon name="retry" />} loading={retrying} loadingLabel={t('kiosk.common.loading')} onClick={() => void retry()} data-testid="print-retry">
                {t('kiosk.printing.retry')}
              </BigButton>
              <BigButton className="kiosk-cierre__salida" variant="ghost" onClick={() => void advance('print_skipped')}>
                {t('kiosk.printing.continue')}
              </BigButton>
            </>
          ) : null}
        </div>

        <ClosingFooter bundle={bundle} />
      </div>
    </Shell>
  );
}
