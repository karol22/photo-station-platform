import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cx, snapToStep } from '../internal';
import { Icon } from '../icons';
import { IconButton } from './IconButton';

export { snapToStep };

export interface TouchSliderProps extends Omit<ComponentProps<'div'>, 'onChange' | 'children'> {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** Formato del valor visible (p. ej. "+2", "50 %"). */
  formatValue?: (value: number) => string;
  /** Textos accesibles de los botones − / +. */
  decreaseLabel?: string;
  increaseLabel?: string;
  /** Marca central (por defecto cuando el rango cruza el 0). */
  centerMark?: boolean;
  hint?: string;
  disabled?: boolean;
  size?: 'lg' | 'xl';
  'data-testid'?: string;
}

/** Deslizador táctil con botones −/+ grandes, valor visible y marca central. */
export function TouchSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue,
  decreaseLabel = '−',
  increaseLabel = '+',
  centerMark,
  hint,
  disabled = false,
  size = 'lg',
  className,
  ...rest
}: TouchSliderProps) {
  const id = useId();
  const current = snapToStep(value, min, max, step);
  const showCenter = centerMark ?? (min < 0 && max > 0);
  const centerValue = min < 0 && max > 0 ? 0 : (min + max) / 2;
  const centerPercent = max > min ? ((centerValue - min) / (max - min)) * 100 : 50;
  const set = (next: number) => {
    const snapped = snapToStep(next, min, max, step);
    if (snapped !== current) onChange(snapped);
  };
  return (
    <div className={cx('psp-slider', className)} data-size={size} data-disabled={disabled || undefined} {...rest}>
      <div className="psp-slider__header">
        <label className="psp-slider__label" htmlFor={id}>
          {label}
        </label>
        <output className="psp-slider__value" htmlFor={id} aria-live="polite">
          {formatValue ? formatValue(current) : String(current)}
        </output>
      </div>
      <div className="psp-slider__row">
        <IconButton
          className="psp-slider__step"
          label={decreaseLabel}
          icon={<Icon name="minus" />}
          size={size === 'xl' ? 'xl' : 'lg'}
          variant="outline"
          round
          disabled={disabled || current <= min}
          onClick={() => set(current - step)}
        />
        <div className="psp-slider__track-wrap">
          {showCenter ? <span className="psp-slider__center" aria-hidden="true" style={{ left: `${centerPercent}%` }} /> : null}
          <input
            id={id}
            className="psp-slider__input"
            type="range"
            min={min}
            max={max}
            step={step}
            value={current}
            disabled={disabled}
            aria-valuetext={formatValue ? formatValue(current) : undefined}
            onChange={(event) => set(Number(event.currentTarget.value))}
          />
        </div>
        <IconButton
          className="psp-slider__step"
          label={increaseLabel}
          icon={<Icon name="plus" />}
          size={size === 'xl' ? 'xl' : 'lg'}
          variant="outline"
          round
          disabled={disabled || current >= max}
          onClick={() => set(current + step)}
        />
      </div>
      {hint !== undefined ? <p className="psp-slider__hint">{hint}</p> : null}
    </div>
  );
}
