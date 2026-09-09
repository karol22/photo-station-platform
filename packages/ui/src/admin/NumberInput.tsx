import type { ComponentProps, ReactNode } from 'react';
import { clamp, cx, snapToStep } from '../internal';
import { Icon } from '../icons';
import { useFieldContext } from './Field';

export interface NumberInputProps
  extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'size' | 'type' | 'min' | 'max' | 'step'> {
  /** `null` = vacío. */
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Unidad visible al final ("s", "%", "mm"). */
  unit?: ReactNode;
  invalid?: boolean;
  /** Textos accesibles de los botones − / +. */
  decreaseLabel?: string;
  increaseLabel?: string;
  size?: 'sm' | 'md';
  block?: boolean;
  'data-testid'?: string;
}

/** Entrada numérica con botones −/+, límites y unidad. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  invalid,
  decreaseLabel = '−',
  increaseLabel = '+',
  size = 'md',
  block = false,
  className,
  id,
  disabled,
  required,
  ...rest
}: NumberInputProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const isDisabled = disabled ?? field?.disabled ?? false;
  const lo = min ?? Number.NEGATIVE_INFINITY;
  const hi = max ?? Number.POSITIVE_INFINITY;
  const stepBy = (direction: 1 | -1) => {
    const base = value ?? (direction > 0 ? (min ?? 0) - step : (max ?? 0) + step);
    const next = Number.isFinite(lo) && Number.isFinite(hi) ? snapToStep(base + direction * step, lo, hi, step) : clamp(base + direction * step, lo, hi);
    onChange(next);
  };
  return (
    <span className={cx('psp-numberinput', block && 'psp-numberinput--block', className)} data-size={size} data-invalid={isInvalid || undefined}>
      <button
        type="button"
        className="psp-numberinput__step"
        aria-label={decreaseLabel}
        disabled={isDisabled || (value !== null && value <= lo)}
        onClick={() => stepBy(-1)}
      >
        <Icon name="minus" />
      </button>
      <input
        className="psp-numberinput__control"
        type="number"
        inputMode="decimal"
        id={id ?? field?.id}
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
        aria-invalid={isInvalid || undefined}
        disabled={isDisabled}
        required={required ?? field?.required}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          if (raw === '') onChange(null);
          else {
            const parsed = Number(raw);
            if (!Number.isNaN(parsed)) onChange(parsed);
          }
        }}
        {...rest}
      />
      {unit !== undefined ? <span className="psp-numberinput__unit">{unit}</span> : null}
      <button
        type="button"
        className="psp-numberinput__step"
        aria-label={increaseLabel}
        disabled={isDisabled || (value !== null && value >= hi)}
        onClick={() => stepBy(1)}
      >
        <Icon name="plus" />
      </button>
    </span>
  );
}
