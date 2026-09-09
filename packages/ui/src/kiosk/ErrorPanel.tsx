import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon, type IconName } from '../icons';

export type ErrorPanelTone = 'danger' | 'warn' | 'info';

const TONE_ICON: Record<ErrorPanelTone, IconName> = { danger: 'cross', warn: 'warning', info: 'info' };

export interface ErrorPanelProps extends Omit<ComponentProps<'section'>, 'children'> {
  /** Qué ocurrió, en lenguaje simple. */
  what: string;
  /** Qué debe hacer el cliente. */
  whatToDo?: ReactNode;
  /** Cómo pedir ayuda si no puede continuar. */
  help?: ReactNode;
  /** Identificador de incidente visible para soporte. */
  incidentCode?: string;
  /** Texto que precede al código ("Código de incidente"). */
  incidentLabel?: string;
  /** Acciones (normalmente un `BigButton` primario y uno secundario). */
  actions?: ReactNode;
  icon?: ReactNode | false;
  tone?: ErrorPanelTone;
  size?: 'md' | 'lg';
  'data-testid'?: string;
}

/**
 * Panel de error del kiosco: qué pasó, qué hacer, cómo pedir ayuda y código de incidente.
 * Nunca recibe detalles técnicos; el texto llega ya redactado por la app.
 */
export function ErrorPanel({
  what,
  whatToDo,
  help,
  incidentCode,
  incidentLabel,
  actions,
  icon,
  tone = 'danger',
  size = 'lg',
  className,
  ...rest
}: ErrorPanelProps) {
  return (
    <section className={cx('psp-errorpanel', className)} role="alert" data-tone={tone} data-size={size} {...rest}>
      {icon === false ? null : (
        <span className="psp-errorpanel__icon" aria-hidden="true">
          {icon ?? <Icon name={TONE_ICON[tone]} />}
        </span>
      )}
      <h2 className="psp-errorpanel__what">{what}</h2>
      {whatToDo !== undefined ? <p className="psp-errorpanel__todo">{whatToDo}</p> : null}
      {help !== undefined ? <p className="psp-errorpanel__help">{help}</p> : null}
      {incidentCode !== undefined ? (
        <p className="psp-errorpanel__incident">
          {incidentLabel !== undefined ? <span className="psp-errorpanel__incident-label">{incidentLabel}</span> : null}
          <code className="psp-errorpanel__incident-code">{incidentCode}</code>
        </p>
      ) : null}
      {actions !== undefined ? <div className="psp-errorpanel__actions">{actions}</div> : null}
    </section>
  );
}
