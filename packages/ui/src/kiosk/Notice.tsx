import { useEffect } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import type { Tone } from '../types';
import { IconButton } from './IconButton';
import { TONE_ICON } from './StatusPill';

export type NoticePosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center' | 'static';

export interface NoticeProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  /** `false` no renderiza nada. */
  open?: boolean;
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode | false;
  /** Esquina fija; `static` fluye con el contenido. */
  position?: NoticePosition;
  onClose?: () => void;
  closeLabel?: string;
  /** Acción secundaria (p. ej. "Reintentar"). */
  action?: ReactNode;
  /** Cierra solo tras estos milisegundos (llama a `onClose`). */
  autoHideMs?: number;
  'data-testid'?: string;
}

/** Aviso breve (toast) en una esquina; `danger` se anuncia como `alert`. */
export function Notice({
  open = true,
  tone = 'info',
  title,
  children,
  icon,
  position = 'top-right',
  onClose,
  closeLabel = 'Cerrar',
  action,
  autoHideMs,
  className,
  ...rest
}: NoticeProps) {
  useEffect(() => {
    if (!open || !autoHideMs || !onClose) return undefined;
    const timer = setTimeout(onClose, autoHideMs);
    return () => clearTimeout(timer);
  }, [open, autoHideMs, onClose]);

  if (!open) return null;
  return (
    <div
      className={cx('psp-notice', className)}
      data-tone={tone}
      data-position={position}
      role={tone === 'danger' ? 'alert' : 'status'}
      {...rest}
    >
      {icon === false ? null : (
        <span className="psp-notice__icon" aria-hidden="true">
          {icon ?? <Icon name={TONE_ICON[tone]} />}
        </span>
      )}
      <div className="psp-notice__content">
        {title !== undefined ? <strong className="psp-notice__title">{title}</strong> : null}
        {children !== undefined ? <div className="psp-notice__body">{children}</div> : null}
        {action !== undefined ? <div className="psp-notice__action">{action}</div> : null}
      </div>
      {onClose ? <IconButton className="psp-notice__close" label={closeLabel} icon={<Icon name="close" />} size="md" onClick={onClose} /> : null}
    </div>
  );
}
