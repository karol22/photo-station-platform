import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { useFieldContext } from './Field';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size' | 'prefix'> {
  invalid?: boolean;
  size?: 'sm' | 'md';
  /** Contenido fijo al inicio (icono, símbolo). */
  prefix?: ReactNode;
  /** Contenido fijo al final (unidad, icono). */
  suffix?: ReactNode;
  block?: boolean;
  'data-testid'?: string;
}

/**
 * Campo de texto. `className` va al contenedor; el resto de props (incluido `data-testid`) al `<input>`.
 * Dentro de `Field` toma id, `aria-describedby`, `aria-invalid` y `required` del contexto.
 */
export function Input({ invalid, size = 'md', prefix, suffix, block = false, className, id, disabled, required, ...rest }: InputProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <span className={cx('psp-input', block && 'psp-input--block', className)} data-size={size} data-invalid={isInvalid || undefined}>
      {prefix !== undefined ? (
        <span className="psp-input__affix" aria-hidden="true">
          {prefix}
        </span>
      ) : null}
      <input
        className="psp-input__control"
        id={id ?? field?.id}
        aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
        aria-invalid={isInvalid || undefined}
        disabled={disabled ?? field?.disabled}
        required={required ?? field?.required}
        {...rest}
      />
      {suffix !== undefined ? (
        <span className="psp-input__affix" aria-hidden="true">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
