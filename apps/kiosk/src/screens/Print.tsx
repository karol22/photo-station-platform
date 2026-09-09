/**
 * Impresión: estados del trabajo (preparando/imprimiendo/terminada/error) que llegan por SSE, con
 * reintento e instrucciones de recogida (`printing.pickupInstructions`).
 */
import { useEffect, useRef, useState } from 'react';
import { BigButton, Icon, Spinner, StatusPill } from '@psp/ui';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';

export function PrintScreen() {
  const { t } = useT();
  const { session, advance, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const status = useKioskStore((s) => s.status);
  const setSession = useKioskStore((s) => s.setSession);
  const [retrying, setRetrying] = useState(false);
  const advanced = useRef(false);

  const job = session?.printJobs.at(-1);
  const printer = status?.printers.find((p) => p.id === job?.printerId);
  const state = job?.status ?? 'preparing';

  useEffect(() => {
    if (state === 'completed' && !advanced.current) {
      advanced.current = true;
      const timer = setTimeout(() => void advance('print_completed'), 2500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state, advance]);

  if (!session) return null;
  const pickup = configString(bundle, 'printing.pickupInstructions') ?? t('kiosk.printing.pickup_default');
  const tone = state === 'completed' ? 'ok' : state === 'failed' || state === 'cancelled' ? 'danger' : 'info';
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
    <SessionFrame title={t('kiosk.printing.title')} noTimeout hideCancel contentAlign="center">
      <div className="kiosk-card kiosk-stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        {state === 'preparing' || state === 'printing' || state === 'retrying' ? <Spinner size="xl" label={t(`kiosk.printing.status.${state}`)} /> : <Icon name={state === 'completed' ? 'check' : 'warning'} size={96} />}
        <StatusPill tone={tone} size="lg" pulse={state === 'printing'}>
          {t(`kiosk.printing.status.${state}`)}
        </StatusPill>
        {job ? <p className="kiosk-small kiosk-muted">{t('kiosk.printing.job_n', { n: session.printJobs.length })} · {t('kiosk.printing.attempt', { n: job.attempt })}</p> : <p>{t('kiosk.printing.waiting')}</p>}
        {state === 'completed' ? <p className="kiosk-lead">{pickup}</p> : null}
        {state === 'failed' ? <p className="kiosk-lead">{printerIssue ?? t('kiosk.printing.error')}</p> : null}
      </div>
      {state === 'failed' || state === 'cancelled' ? (
        <div className="kiosk-actions">
          <BigButton variant="secondary" onClick={() => void advance('print_skipped')}>
            {t('kiosk.printing.continue')}
          </BigButton>
          <BigButton variant="primary" size="xl" icon={<Icon name="retry" />} loading={retrying} loadingLabel={t('kiosk.common.loading')} onClick={() => void retry()} data-testid="print-retry">
            {t('kiosk.printing.retry')}
          </BigButton>
        </div>
      ) : null}
    </SessionFrame>
  );
}
