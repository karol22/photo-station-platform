import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { useFieldContext } from './Field';

export interface SwitchProps extends Omit<ComponentProps<'button'>, 'onChange' | 'children'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  /** Texto visible del estado (además de la posición del control). */
  onLabel?: string;
  offLabel?: string;
  size?: 'sm' | 'md';
  'data-testid'?: string;
}

/** Interruptor compacto (`role="switch"`) para la consola. */
export function Switch({ checked, onChange, label, description, onLabel, offLabel, size = 'md', disabled, className, id, ...rest }: SwitchProps) {
  const generated = useId();
  const field = useFieldContext();
  const controlId = id ?? field?.id ?? `${generated}-switch`;
  const stateText = checked ? onLabel : offLabel;
  const control = (
    <button
      type="button"
      role="switch"
      id={controlId}
      aria-checked={checked}
      aria-labelledby={label !== undefined ? `${controlId}-label` : undefined}
      aria-describedby={description !== undefined ? `${controlId}-description` : field?.describedBy}
      className={cx('psp-switch', className)}
      data-size={size}
      data-checked={checked || undefined}
      disabled={disabled ?? field?.disabled}
      onClick={() => onChange(!checked)}
      {...rest}
    >
      <span className="psp-switch__track" aria-hidden="true">
        <span className="psp-switch__thumb" />
      </span>
      {stateText !== undefined ? <span className="psp-switch__state">{stateText}</span> : null}
    </button>
  );
  if (label === undefined) return control;
  return (
    <div className="psp-switch-row" data-disabled={disabled || undefined}>
      {control}
      <span className="psp-switch-row__text">
        <span className="psp-switch-row__label" id={`${controlId}-label`}>
          {label}
        </span>
        {description !== undefined ? (
          <span className="psp-switch-row__description" id={`${controlId}-description`}>
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}
