import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { IconButton } from '../kiosk/IconButton';
import { TONE_ICON } from '../kiosk/StatusPill';
import type { Tone } from '../types';

export interface AlertProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode | false;
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  compact?: boolean;
  'data-testid'?: string;
}

/** Aviso en línea con icono por tono, título, cuerpo y acciones. */
export function Alert({ tone = 'info', title, children, icon, actions, onClose, closeLabel = 'Cerrar', compact = false, className, ...rest }: AlertProps) {
  return (
    <div
      className={cx('psp-alert', compact && 'psp-alert--compact', className)}
      data-tone={tone}
      role={tone === 'danger' ? 'alert' : 'status'}
      {...rest}
    >
      {icon === false ? null : (
        <span className="psp-alert__icon" aria-hidden="true">
          {icon ?? <Icon name={TONE_ICON[tone]} />}
        </span>
      )}
      <div className="psp-alert__content">
        {title !== undefined ? <strong className="psp-alert__title">{title}</strong> : null}
        {children !== undefined ? <div className="psp-alert__body">{children}</div> : null}
        {actions !== undefined ? <div className="psp-alert__actions">{actions}</div> : null}
      </div>
      {onClose ? <IconButton className="psp-alert__close" label={closeLabel} icon={<Icon name="close" />} size="sm" onClick={onClose} /> : null}
    </div>
  );
}
