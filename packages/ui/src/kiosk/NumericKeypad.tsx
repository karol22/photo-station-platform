import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { VisuallyHidden } from '../shared/VisuallyHidden';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'delete' | 'confirm';

const LAYOUT: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['delete', '0', 'confirm'],
];

/** Lógica pura del teclado: agrega dígitos hasta `length`, borra el último; `confirm` no cambia el valor. */
export function applyKeypadKey(value: string, key: KeypadKey, length: number): string {
  if (key === 'delete') return value.slice(0, -1);
  if (key === 'confirm') return value;
  if (value.length >= length) return value;
  return value + key;
}

export interface NumericKeypadProps extends Omit<ComponentProps<'div'>, 'onChange' | 'children'> {
  value: string;
  /** Longitud máxima (p. ej. 4 para un PIN). */
  length: number;
  onChange: (next: string) => void;
  /** Se dispara al confirmar con el valor completo. */
  onConfirm?: (value: string) => void;
  /** Texto visible del botón confirmar; sin él se muestra sólo el icono. */
  confirmLabel?: string;
  /** Textos accesibles. */
  confirmAriaLabel?: string;
  deleteLabel?: string;
  /** Texto accesible del indicador de dígitos ("PIN"). */
  label?: string;
  /** Mensaje de error bajo los puntos. */
  error?: string;
  /** Muestra puntos en lugar de los dígitos. */
  masked?: boolean;
  /** Fuerza el estado del botón confirmar; por defecto se habilita al completar `length`. */
  confirmDisabled?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

/** Teclado numérico táctil 0–9 con borrar y confirmar; muestra puntos por dígito. */
export function NumericKeypad({
  value,
  length,
  onChange,
  onConfirm,
  confirmLabel,
  confirmAriaLabel = 'Confirmar',
  deleteLabel = 'Borrar',
  label,
  error,
  masked = true,
  confirmDisabled,
  disabled = false,
  className,
  ...rest
}: NumericKeypadProps) {
  const complete = value.length >= length;
  const canConfirm = confirmDisabled === undefined ? complete : !confirmDisabled;
  const press = (key: KeypadKey) => {
    if (disabled) return;
    if (key === 'confirm') {
      if (canConfirm) onConfirm?.(value);
      return;
    }
    const next = applyKeypadKey(value, key, length);
    if (next !== value) onChange(next);
  };
  return (
    <div className={cx('psp-keypad', className)} data-disabled={disabled || undefined} {...rest}>
      <div className="psp-keypad__display" role="status" aria-label={label} data-error={error !== undefined || undefined}>
        <span className="psp-keypad__dots" aria-hidden="true">
          {Array.from({ length: Math.max(0, length) }, (_, index) => {
            const digit = value[index];
            return (
              <span key={index} className="psp-keypad__dot" data-filled={digit !== undefined || undefined}>
                {digit !== undefined && !masked ? digit : null}
              </span>
            );
          })}
        </span>
        <VisuallyHidden>
          {value.length}/{length}
        </VisuallyHidden>
      </div>
      {error !== undefined ? (
        <p className="psp-keypad__error" role="alert">
          <Icon name="warning" /> <span>{error}</span>
        </p>
      ) : null}
      <div className="psp-keypad__grid">
        {LAYOUT.flat().map((key) => {
          if (key === 'delete') {
            return (
              <button
                key={key}
                type="button"
                className="psp-keypad__key psp-keypad__key--delete"
                aria-label={deleteLabel}
                disabled={disabled || value.length === 0}
                onClick={() => press(key)}
              >
                <Icon name="back" />
              </button>
            );
          }
          if (key === 'confirm') {
            return (
              <button
                key={key}
                type="button"
                className="psp-keypad__key psp-keypad__key--confirm"
                aria-label={confirmLabel === undefined ? confirmAriaLabel : undefined}
                disabled={disabled || !canConfirm}
                onClick={() => press(key)}
              >
                <Icon name="check" />
                {confirmLabel !== undefined ? <span className="psp-keypad__key-label">{confirmLabel}</span> : null}
              </button>
            );
          }
          return (
            <button key={key} type="button" className="psp-keypad__key" disabled={disabled || complete} onClick={() => press(key)}>
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
