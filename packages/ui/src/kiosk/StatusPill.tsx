import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon, type IconName } from '../icons';
import type { Tone } from '../types';

export interface StatusPillProps extends Omit<ComponentProps<'span'>, 'children'> {
  tone?: Tone;
  /** Icono propio; `false` lo omite. Por defecto uno por tono (el estado no depende sólo del color). */
  icon?: ReactNode | false;
  /** Animación sutil para estados "en curso". */
  pulse?: boolean;
  size?: 'md' | 'lg';
  children: ReactNode;
  'data-testid'?: string;
}

export const TONE_ICON: Record<Tone, IconName> = {
  neutral: 'dash',
  ok: 'check',
  warn: 'warning',
  danger: 'cross',
  info: 'info',
};

/** Pastilla de estado grande: icono + texto, tono semántico. */
export function StatusPill({ tone = 'neutral', icon, pulse = false, size = 'md', className, children, ...rest }: StatusPillProps) {
  return (
    <span
      className={cx('psp-statuspill', pulse && 'psp-statuspill--pulse', className)}
      data-tone={tone}
      data-size={size}
      {...rest}
    >
      {icon === false ? null : (
        <span className="psp-statuspill__icon" aria-hidden="true">
          {icon ?? <Icon name={TONE_ICON[tone]} />}
        </span>
      )}
      <span className="psp-statuspill__label">{children}</span>
    </span>
  );
}
