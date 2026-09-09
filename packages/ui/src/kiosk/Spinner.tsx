import type { ComponentProps } from 'react';
import { cx } from '../internal';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps extends Omit<ComponentProps<'span'>, 'children'> {
  /** Tamaño nominal o píxeles exactos. */
  size?: SpinnerSize | number;
  /** Texto accesible (`role="status"`). */
  label?: string;
  /** Alineado con el texto en lugar de bloque centrado. */
  inline?: boolean;
  'data-testid'?: string;
}

/** Indicador de carga circular animado. */
export function Spinner({ size = 'md', label = 'Cargando', inline = false, className, style, ...rest }: SpinnerProps) {
  const px = typeof size === 'number' ? size : undefined;
  return (
    <span
      role="status"
      aria-label={label}
      className={cx('psp-spinner', inline && 'psp-spinner--inline', className)}
      data-size={typeof size === 'string' ? size : undefined}
      style={px !== undefined ? { ...(style ?? {}), width: px, height: px } : style}
      {...rest}
    >
      <svg className="psp-spinner__svg" viewBox="0 0 50 50" aria-hidden="true" focusable="false">
        <circle className="psp-spinner__track" cx="25" cy="25" r="20" />
        <circle className="psp-spinner__arc" cx="25" cy="25" r="20" />
      </svg>
    </span>
  );
}
