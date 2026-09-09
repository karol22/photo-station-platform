import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import type { Tone } from '../types';

export interface BadgeProps extends Omit<ComponentProps<'span'>, 'children'> {
  tone?: Tone;
  icon?: ReactNode;
  /** Punto de estado delante del texto. */
  dot?: boolean;
  /** Sólo borde, sin relleno. */
  outline?: boolean;
  size?: 'sm' | 'md';
  children: ReactNode;
  'data-testid'?: string;
}

/** Etiqueta compacta con tono semántico. El texto es siempre el portador del significado. */
export function Badge({ tone = 'neutral', icon, dot = false, outline = false, size = 'md', className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx('psp-badge', outline && 'psp-badge--outline', className)} data-tone={tone} data-size={size} {...rest}>
      {dot ? <span className="psp-badge__dot" aria-hidden="true" /> : null}
      {icon !== undefined ? (
        <span className="psp-badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="psp-badge__label">{children}</span>
    </span>
  );
}
