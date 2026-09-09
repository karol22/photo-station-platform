/**
 * Marco común de las pantallas de sesión: título, paso n/N, barra de tiempo con extensión,
 * botón de cancelar con confirmación y hoja "¿sigues ahí?" antes de cancelar por inactividad.
 */
import { useState, type ReactNode } from 'react';
import { BigButton, Icon, IconButton, ProgressDots, Sheet, TimeoutBar } from '@psp/ui';
import { stagesForProduct } from '@psp/domain';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useSessionTimeout } from '../session/useSessionTimeout';
import { useKioskStore } from '../store';
import { Shell } from './Shell';

export interface SessionFrameProps {
  title: string;
  children: ReactNode;
  /** Sin barra de tiempo (p. ej. durante impresión o finalización). */
  noTimeout?: boolean;
  timeoutSec?: number;
  footer?: ReactNode;
  hideCancel?: boolean;
  contentAlign?: 'start' | 'center';
}

export function SessionFrame({ title, children, noTimeout, timeoutSec, footer, hideCancel, contentAlign }: SessionFrameProps) {
  const { t } = useT();
  const { session, product, flow, cancel } = useSession();
  const simplified = useKioskStore((s) => s.bundle?.effective.values['kiosk.simplifiedMode'] === true);
  const timeout = useSessionTimeout(!noTimeout, timeoutSec);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const stages = product && flow ? stagesForProduct(product, flow).filter((s) => !['started', 'product_selected', 'configuring', 'delivering', 'finishing', 'done'].includes(s)) : [];
  const stepIndex = session ? stages.indexOf(session.stage) : -1;

  return (
    <Shell
      headerStart={
        stages.length > 0 && stepIndex >= 0 && !simplified ? (
          <ProgressDots steps={stages.length} current={stepIndex} label={t('kiosk.common.step_n_of_m', { n: stepIndex + 1, m: stages.length })} labels={stages.map((s) => t(`stages.${s}`))} />
        ) : undefined
      }
      headerEnd={
        !hideCancel ? (
          <IconButton label={t('kiosk.cancel.button')} icon={<Icon name="close" />} size="lg" variant="outline" showLabel onClick={() => setConfirmCancel(true)} data-testid="session-cancel" />
        ) : undefined
      }
      footer={
        <>
          {!noTimeout && session ? (
            <TimeoutBar
              remaining={timeout.remaining}
              total={timeout.total}
              warning={timeout.warning}
              label={t('kiosk.timeout.label')}
              warningLabel={t('kiosk.timeout.warning')}
              extendLabel={t('kiosk.timeout.extend')}
              onExtend={() => void timeout.extend()}
              showRemaining
            />
          ) : null}
          {footer}
        </>
      }
      contentAlign={contentAlign ?? 'start'}
    >
      <h1 className="kiosk-title">{title}</h1>
      {children}
      <Sheet
        open={confirmCancel}
        title={t('kiosk.cancel.title')}
        description={t('kiosk.cancel.text')}
        onClose={() => setConfirmCancel(false)}
        closeLabel={t('kiosk.common.close')}
        actions={
          <>
            <BigButton variant="secondary" onClick={() => setConfirmCancel(false)}>
              {t('kiosk.cancel.keep')}
            </BigButton>
            <BigButton variant="danger" onClick={() => void cancel('user_cancelled')} data-testid="session-cancel-confirm">
              {t('kiosk.cancel.confirm')}
            </BigButton>
          </>
        }
      />
      <Sheet
        open={!noTimeout && timeout.warning && timeout.remaining > 0 && !confirmCancel}
        title={t('kiosk.timeout.still_there')}
        description={t('kiosk.timeout.still_there_text')}
        dismissible={false}
        hideHandle
        actions={
          <>
            <BigButton variant="ghost" onClick={() => void cancel('user_left')}>
              {t('kiosk.timeout.end')}
            </BigButton>
            <BigButton variant="primary" size="xl" onClick={() => void timeout.extend()}>
              {t('kiosk.timeout.continue')}
            </BigButton>
          </>
        }
      />
    </Shell>
  );
}
