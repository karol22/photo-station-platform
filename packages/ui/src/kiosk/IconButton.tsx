import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Spinner } from './Spinner';

export type IconButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type IconButtonVariant = 'ghost' | 'outline' | 'solid' | 'primary' | 'danger';

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** Texto accesible obligatorio; visible sólo con `showLabel`. */
  label: string;
  icon: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /** Muestra el texto junto al icono. */
  showLabel?: boolean;
  loading?: boolean;
  /** Forma circular. */
  round?: boolean;
  'data-testid'?: string;
}

/** Botón de icono con etiqueta accesible obligatoria. */
export function IconButton({
  label,
  icon,
  size = 'md',
  variant = 'ghost',
  showLabel = false,
  loading = false,
  round = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      className={cx('psp-iconbutton', round && 'psp-iconbutton--round', showLabel && 'psp-iconbutton--labelled', className)}
      data-size={size}
      data-variant={variant}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className="psp-iconbutton__icon" aria-hidden="true">
        {loading ? <Spinner size="sm" label={label} /> : icon}
      </span>
      {showLabel ? <span className="psp-iconbutton__label">{label}</span> : null}
    </button>
  );
}
