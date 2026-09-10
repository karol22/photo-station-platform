import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Spinner } from '../kiosk/Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  block?: boolean;
  children?: ReactNode;
  'data-testid'?: string;
}

/** Botón compacto de la consola de administración (≥ 36 px). */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  loading = false,
  loadingLabel,
  block = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      className={cx('psp-button', block && 'psp-button--block', className)}
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="psp-button__icon">
          <Spinner size="sm" label={loadingLabel ?? 'Cargando'} />
        </span>
      ) : icon !== undefined ? (
        <span className="psp-button__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children !== undefined ? <span className="psp-button__label">{children}</span> : null}
      {iconEnd !== undefined ? (
        <span className="psp-button__icon psp-button__icon--end" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
    </button>
  );
}
