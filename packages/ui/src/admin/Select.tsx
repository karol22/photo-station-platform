import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { useFieldContext } from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentProps<'select'>, 'size'> {
  options: SelectOption[];
  /** Opción vacía inicial (valor `""`). */
  placeholder?: string;
  invalid?: boolean;
  size?: 'sm' | 'md';
  block?: boolean;
  'data-testid'?: string;
}

/** Selector nativo con chevron. Dentro de `Field` enlaza ids y estado. */
export function Select({ options, placeholder, invalid, size = 'md', block = false, className, id, disabled, required, ...rest }: SelectProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <span className={cx('psp-select', block && 'psp-select--block', className)} data-size={size} data-invalid={isInvalid || undefined}>
      <select
        className="psp-select__control"
        id={id ?? field?.id}
        aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
        aria-invalid={isInvalid || undefined}
        disabled={disabled ?? field?.disabled}
        required={required ?? field?.required}
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="psp-select__chevron" aria-hidden="true">
        <Icon name="chevronDown" />
      </span>
    </span>
  );
}
