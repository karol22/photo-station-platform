import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';

export interface ToggleProps extends Omit<ComponentProps<'button'>, 'onChange' | 'children'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  /** Texto visible del estado activo / inactivo (además del icono). */
  onLabel?: string;
  offLabel?: string;
  size?: 'lg' | 'xl';
  'data-testid'?: string;
}

/** Interruptor táctil grande (`role="switch"`) con texto e icono de estado. */
export function Toggle({ checked, onChange, label, description, onLabel, offLabel, size = 'lg', disabled, className, ...rest }: ToggleProps) {
  const id = useId();
  const stateText = checked ? onLabel : offLabel;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description !== undefined ? `${id}-description` : undefined}
      className={cx('psp-toggle', className)}
      data-size={size}
      data-checked={checked || undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      {...rest}
    >
      <span className="psp-toggle__text">
        <span className="psp-toggle__label" id={`${id}-label`}>
          {label}
        </span>
        {description !== undefined ? (
          <span className="psp-toggle__description" id={`${id}-description`}>
            {description}
          </span>
        ) : null}
      </span>
      <span className="psp-toggle__control" aria-hidden="true">
        <span className="psp-toggle__track">
          <span className="psp-toggle__thumb">
            <Icon name={checked ? 'check' : 'minus'} />
          </span>
        </span>
        {stateText !== undefined ? <span className="psp-toggle__state">{stateText}</span> : null}
      </span>
    </button>
  );
}
