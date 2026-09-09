import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';

export interface LangOption {
  code: string;
  label: string;
  /** Texto corto (p. ej. "ES") para el modo compacto. */
  shortLabel?: string;
}

export interface LangSwitchProps extends Omit<ComponentProps<'div'>, 'onChange' | 'children'> {
  options: LangOption[];
  /** Código del idioma actual. */
  value: string;
  onChange: (code: string) => void;
  /** Texto accesible del grupo. */
  label?: string;
  size?: 'md' | 'lg';
  /** Muestra el icono de idioma delante de las opciones. */
  showIcon?: boolean;
  /** Usa `shortLabel` cuando exista. */
  compact?: boolean;
  'data-testid'?: string;
}

/** Selector de idioma con botones grandes; el activo se marca con `aria-pressed` y relleno. */
export function LangSwitch({
  options,
  value,
  onChange,
  label = 'Idioma',
  size = 'md',
  showIcon = true,
  compact = false,
  className,
  ...rest
}: LangSwitchProps) {
  return (
    <div className={cx('psp-langswitch', className)} role="group" aria-label={label} data-size={size} {...rest}>
      {showIcon ? (
        <span className="psp-langswitch__icon" aria-hidden="true">
          <Icon name="language" />
        </span>
      ) : null}
      {options.map((option) => {
        const active = option.code === value;
        return (
          <button
            key={option.code}
            type="button"
            className="psp-langswitch__option"
            lang={option.code}
            aria-pressed={active}
            data-active={active || undefined}
            onClick={() => {
              if (!active) onChange(option.code);
            }}
          >
            {compact && option.shortLabel ? option.shortLabel : option.label}
          </button>
        );
      })}
    </div>
  );
}
