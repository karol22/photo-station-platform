import type { ComponentProps } from 'react';
import { cx } from '../internal';

export interface VisuallyHiddenProps extends ComponentProps<'span'> {
  'data-testid'?: string;
}

/** Texto sólo para tecnologías de asistencia (no ocupa espacio visual). */
export function VisuallyHidden({ className, ...rest }: VisuallyHiddenProps) {
  return <span className={cx('psp-sr-only', className)} {...rest} />;
}
