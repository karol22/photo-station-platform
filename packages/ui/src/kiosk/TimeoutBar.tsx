import type { ComponentProps } from 'react';
import { cx, fraction } from '../internal';
import { Icon } from '../icons';
import { BigButton } from './BigButton';

export interface TimeoutBarProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Segundos restantes. */
  remaining: number;
  /** Segundos totales. */
  total: number;
  /** Fuerza el estado de advertencia; por defecto se calcula con `warningAt` o el 25 % del total. */
  warning?: boolean;
  /** Umbral en segundos para entrar en advertencia. */
  warningAt?: number;
  /** Texto descriptivo ("Tiempo restante"). */
  label?: string;
  /** Texto de advertencia ("La sesión se cancelará pronto"). */
  warningLabel?: string;
  /** Texto del botón de extender; sin `onExtend` no se muestra. */
  extendLabel?: string;
  onExtend?: () => void;
  /** Muestra los segundos restantes junto al texto. */
  showRemaining?: boolean;
  /** Formato de los segundos; por defecto `mm:ss`. */
  formatRemaining?: (seconds: number) => string;
  'data-testid'?: string;
}

/** Formato por defecto `m:ss` (sin texto de idioma). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

/** Barra de tiempo restante con advertencia (icono + texto + animación) y botón para extender. */
export function TimeoutBar({
  remaining,
  total,
  warning,
  warningAt,
  label,
  warningLabel,
  extendLabel,
  onExtend,
  showRemaining = true,
  formatRemaining = formatClock,
  className,
  ...rest
}: TimeoutBarProps) {
  const ratio = fraction(remaining, total);
  const isWarning = warning ?? (warningAt !== undefined ? remaining <= warningAt : ratio <= 0.25);
  return (
    <div className={cx('psp-timeout', className)} data-warning={isWarning || undefined} {...rest}>
      <div className="psp-timeout__info">
        <div className="psp-timeout__text" role="status" aria-live={isWarning ? 'polite' : 'off'}>
          {isWarning ? (
            <span className="psp-timeout__icon" aria-hidden="true">
              <Icon name="warning" />
            </span>
          ) : (
            <span className="psp-timeout__icon" aria-hidden="true">
              <Icon name="clock" />
            </span>
          )}
          <span className="psp-timeout__label">{isWarning && warningLabel !== undefined ? warningLabel : label}</span>
          {showRemaining ? <span className="psp-timeout__remaining">{formatRemaining(remaining)}</span> : null}
        </div>
        <div
          className="psp-timeout__track"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, Math.round(total))}
          aria-valuenow={Math.max(0, Math.round(remaining))}
        >
          <div className="psp-timeout__fill" style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>
      {onExtend && extendLabel !== undefined ? (
        <BigButton className="psp-timeout__extend" variant="secondary" size="lg" icon={<Icon name="plus" />} onClick={onExtend}>
          {extendLabel}
        </BigButton>
      ) : null}
    </div>
  );
}
