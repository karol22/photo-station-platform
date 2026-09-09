import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Spinner } from './Spinner';

export type BigButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type BigButtonSize = 'lg' | 'xl';

export interface BigButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  variant?: BigButtonVariant;
  size?: BigButtonSize;
  /** Icono al inicio. */
  icon?: ReactNode;
  /** Icono al final (p. ej. flecha de continuar). */
  iconEnd?: ReactNode;
  /** Muestra un spinner y bloquea el botón. */
  loading?: boolean;
  /** Texto accesible mientras carga. */
  loadingLabel?: string;
  /** Ocupa todo el ancho disponible. */
  block?: boolean;
  children?: ReactNode;
  'data-testid'?: string;
}

/** Botón táctil grande (≥ 64 px). Una pantalla crítica lleva un solo `primary`. */
export function BigButton({
  variant = 'primary',
  size = 'lg',
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
}: BigButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      className={cx('psp-bigbutton', block && 'psp-bigbutton--block', className)}
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="psp-bigbutton__icon">
          <Spinner size="sm" label={loadingLabel ?? 'Cargando'} />
        </span>
      ) : icon !== undefined ? (
        <span className="psp-bigbutton__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="psp-bigbutton__label">{children}</span>
      {iconEnd !== undefined ? (
        <span className="psp-bigbutton__icon psp-bigbutton__icon--end" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
    </button>
  );
}
