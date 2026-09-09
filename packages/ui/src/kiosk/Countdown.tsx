import type { ComponentProps, ReactNode } from 'react';
import { cx, fraction } from '../internal';

export interface CountdownProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Segundos restantes (puede ser fraccionario; se muestra redondeado hacia arriba). */
  seconds: number;
  /** Duración total, para el anillo de progreso. */
  total: number;
  /** Texto accesible ("Cuenta regresiva"). */
  label?: string;
  /** Diámetro en px. */
  size?: number;
  strokeWidth?: number;
  tone?: 'primary' | 'accent' | 'warn' | 'danger';
  /** Texto bajo el número ("Prepárate", "¡Sonríe!"). */
  caption?: ReactNode;
  /** Formato del número; por defecto `Math.ceil`. */
  format?: (seconds: number) => string;
  'data-testid'?: string;
}

/** Número grande con anillo SVG de progreso. `role="timer"`. */
export function Countdown({
  seconds,
  total,
  label,
  size = 220,
  strokeWidth = 14,
  tone = 'primary',
  caption,
  format,
  className,
  style,
  ...rest
}: CountdownProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = fraction(seconds, total);
  const offset = circumference * (1 - progress);
  const text = format ? format(seconds) : String(Math.max(0, Math.ceil(seconds)));
  return (
    <div
      className={cx('psp-countdown', className)}
      role="timer"
      aria-label={label}
      aria-live="off"
      data-tone={tone}
      data-seconds={Math.max(0, Math.ceil(seconds))}
      style={{ ...(style ?? {}), width: size, height: size }}
      {...rest}
    >
      <svg className="psp-countdown__ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" focusable="false">
        <circle className="psp-countdown__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
        <circle
          className="psp-countdown__progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="psp-countdown__value">{text}</span>
      {caption !== undefined ? <span className="psp-countdown__caption">{caption}</span> : null}
    </div>
  );
}
