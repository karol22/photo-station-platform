/**
 * Confirmación: resumen (producto, copias, precio), vista previa de la composición y la acción
 * irreversible de imprimir (o terminar sin impresión), con impresora no disponible explicada.
 */
import { useState } from 'react';
import { BigButton, Icon, StatusPill } from '@psp/ui';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';

export function ConfirmScreen() {
  const { t, tl, money } = useT();
  const { session, product, advance, fail } = useSession();
  const status = useKioskStore((s) => s.status);
  const setSession = useKioskStore((s) => s.setSession);
  const [sending, setSending] = useState(false);

  if (!session || !product) return null;
  const printable = product.printCount > 0 && session.copies > 0;
  const printer = (status?.printers ?? []).find((p) => p.status === 'ready' || p.status === 'busy');
  const printerBlocked = printable && !printer;
  const demoNoPrint = session.isDemo && printable && !printer;

  const print = async () => {
    setSending(true);
    try {
      const updated = await stationApi.print(session.id, { copies: session.copies, ...(printer ? { printerId: printer.id } : {}), idempotencyKey: `${session.id}:print:${session.printJobs.length + 1}` });
      setSession(updated);
      if (updated.stage === 'confirming') await advance('print_requested');
    } catch (error) {
      setSending(false);
      fail(error, 'print_failed');
    }
  };

  const finishWithoutPrint = async () => {
    setSending(true);
    await advance('no_print');
  };

  return (
    <SessionFrame title={t('kiosk.confirm.title')}>
      <div className="kiosk-edit">
        <div className="kiosk-preview">
          {session.composition ? <img src={session.composition.url} alt={t('kiosk.compose.title')} data-testid="confirm-preview" /> : null}
        </div>
        <div className="kiosk-stack">
          <div className="kiosk-card">
            <ul className="kiosk-list">
              <li>
                <span>{t('kiosk.confirm.product')}</span>
                <span>{tl(product.displayName)}</span>
              </li>
              <li>
                <span>{t('kiosk.confirm.copies')}</span>
                <span>{printable ? (session.copies === 1 ? t('kiosk.common.copy_one') : t('kiosk.common.copies_n', { n: session.copies })) : t('kiosk.common.no_prints')}</span>
              </li>
              <li>
                <span>{t('kiosk.confirm.price')}</span>
                <span>{session.commercial.finalPrice && session.commercial.finalPrice.amount > 0 ? money(session.commercial.finalPrice) : t('kiosk.common.free')}</span>
              </li>
            </ul>
          </div>
          {printerBlocked ? <StatusPill tone="warn" size="lg">{demoNoPrint ? t('kiosk.confirm.demo_no_print') : t('kiosk.confirm.printer_unavailable')}</StatusPill> : null}
          {printable && !printerBlocked ? (
            <BigButton variant="primary" size="xl" block icon={<Icon name="print" />} loading={sending} loadingLabel={t('kiosk.confirm.sending')} onClick={() => void print()} data-testid="confirm-print">
              {t('kiosk.confirm.print')}
            </BigButton>
          ) : null}
          <BigButton variant={printable && !printerBlocked ? 'secondary' : 'primary'} size="xl" block icon={<Icon name="check" />} loading={sending && !printable} onClick={() => void finishWithoutPrint()} data-testid="confirm-finish">
            {printable ? t('kiosk.confirm.no_print') : t('kiosk.confirm.finish')}
          </BigButton>
        </div>
      </div>
    </SessionFrame>
  );
}
