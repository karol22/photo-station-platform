import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon, type IconName } from '../icons';

export type InstructionTone = 'ok' | 'warn' | 'block' | 'info';

const TONE_ICON: Record<InstructionTone, IconName> = {
  ok: 'check',
  warn: 'warning',
  block: 'cross',
  info: 'info',
};

export interface InstructionBannerProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  tone?: InstructionTone;
  /** Línea principal, grande. */
  children?: ReactNode;
  /** Línea secundaria opcional. */
  detail?: ReactNode;
  /** Icono propio; `false` lo omite. */
  icon?: ReactNode | false;
  /** Animación sutil de entrada / pulso. */
  animate?: boolean;
  /** Prioridad de lectura para tecnologías de asistencia. */
  live?: 'polite' | 'assertive' | 'off';
  size?: 'md' | 'lg' | 'xl';
  'data-testid'?: string;
}

/** Instrucción corta y grande ("Acércate un poco", "Mira a la cámara") con tono e icono. */
export function InstructionBanner({
  tone = 'info',
  children,
  detail,
  icon,
  animate = true,
  live = 'polite',
  size = 'lg',
  className,
  ...rest
}: InstructionBannerProps) {
  return (
    <div
      className={cx('psp-instruction', animate && 'psp-instruction--animate', className)}
      data-tone={tone}
      data-size={size}
      role="status"
      aria-live={live}
      {...rest}
    >
      {icon === false ? null : (
        <span className="psp-instruction__icon" aria-hidden="true">
          {icon ?? <Icon name={TONE_ICON[tone]} />}
        </span>
      )}
      <span className="psp-instruction__text">
        <span className="psp-instruction__main">{children}</span>
        {detail !== undefined ? <span className="psp-instruction__detail">{detail}</span> : null}
      </span>
    </div>
  );
}
