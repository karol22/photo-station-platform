/**
 * Confirmación: el resultado ocupando la pantalla y la acción irreversible debajo, con la
 * impresora no disponible explicada en una línea.
 *
 * Muere la tabla clave/valor de producto, copias y precio dentro de una tarjeta blanca: un recibo
 * no es lo que la persona vino a ver. Lo que se compromete cabe en una línea sobre el campo, y lo
 * que se toca vive a la altura del pulgar.
 *
 * Conserva `SessionFrame` a propósito: el temporizador que no cancela una sesión con dinero o
 * fotografías de por medio vive ahí y no se toca.
 */
import { useState } from 'react';
import { BigButton, Icon } from '@psp/ui';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { ComposeFooter } from './Compose';

export function ConfirmScreen() {
  const { t, tl, money } = useT();
  const { session, product, advance, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
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

  const sendsToPrinter = printable && !printerBlocked;
  // Lo que se compromete, en una línea: qué se lleva, cuántas y cuánto cuesta. Sin tabla, sin
  // recibo, sin tarjeta. El precio sigue visible porque la acción de abajo es irreversible.
  const summary = [
    tl(product.displayName),
    printable ? (session.copies === 1 ? t('kiosk.common.copy_one') : t('kiosk.common.copies_n', { n: session.copies })) : t('kiosk.common.no_prints'),
    session.commercial.finalPrice && session.commercial.finalPrice.amount > 0 ? money(session.commercial.finalPrice) : t('kiosk.common.free'),
  ].join(' · ');

  return (
    <SessionFrame title={t('kiosk.confirm.title')}>
      <div className="kiosk-composicion" data-stage="confirm" data-testid="confirm">
        <div className="kiosk-composicion__cartel">
          {session.composition ? (
            <img className="kiosk-composicion__lienzo" src={session.composition.url} alt={t('kiosk.compose.result')} data-testid="confirm-preview" />
          ) : null}
        </div>

        <div className="kiosk-composicion__repisa">
          <p className="kiosk-composicion__resumen" data-testid="confirm-summary">{summary}</p>
          {printerBlocked ? (
            <p className="kiosk-composicion__aviso">{demoNoPrint ? t('kiosk.confirm.demo_no_print') : t('kiosk.confirm.printer_unavailable')}</p>
          ) : null}
        </div>

        <div className="kiosk-composicion__alcance">
          {sendsToPrinter ? (
            <>
              <BigButton className="kiosk-composicion__accion" variant="primary" size="xl" block icon={<Icon name="print" />} loading={sending} loadingLabel={t('kiosk.confirm.sending')} onClick={() => void print()} data-testid="confirm-print">
                {t('kiosk.confirm.print')}
              </BigButton>
              {/* La salida siempre visible, nunca escondida detrás de un menú. */}
              <BigButton className="kiosk-composicion__salida" variant="ghost" onClick={() => void finishWithoutPrint()} data-testid="confirm-finish">
                {t('kiosk.confirm.no_print')}
              </BigButton>
            </>
          ) : (
            <BigButton className="kiosk-composicion__accion" variant="primary" size="xl" block icon={<Icon name="check" />} loading={sending} onClick={() => void finishWithoutPrint()} data-testid="confirm-finish">
              {printable ? t('kiosk.confirm.finish') : t('kiosk.compose.ok')}
            </BigButton>
          )}
        </div>

        <ComposeFooter bundle={bundle} />
      </div>
    </SessionFrame>
  );
}
