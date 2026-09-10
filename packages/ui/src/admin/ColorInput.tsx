import { useState } from 'react';
import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { contrastColor, parseHexColor, toHex } from '../theme';
import { useFieldContext } from './Field';

export interface ColorInputProps extends Omit<ComponentProps<'div'>, 'onChange' | 'children'> {
  /** Color `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
  id?: string;
  /** Texto accesible del selector de color. */
  label?: string;
  /** Texto accesible del campo hexadecimal. */
  hexLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Colores sugeridos (p. ej. la paleta actual de la marca). */
  presets?: string[];
  size?: 'sm' | 'md';
  'data-testid'?: string;
}

/** Normaliza a `#rrggbb` en mayúsculas; `null` si no es válido. */
export function normalizeHex(input: string): string | null {
  const rgb = parseHexColor(input);
  return rgb ? toHex(rgb).toUpperCase() : null;
}

/** Muestra de color + campo hexadecimal. La muestra incluye "Aa" en el color de contraste calculado. */
export function ColorInput({
  value,
  onChange,
  id,
  label,
  hexLabel,
  invalid,
  disabled,
  presets,
  size = 'md',
  className,
  ...rest
}: ColorInputProps) {
  const field = useFieldContext();
  const controlId = id ?? field?.id;
  const isDisabled = disabled ?? field?.disabled ?? false;
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }
  const normalized = normalizeHex(draft);
  const isInvalid = invalid ?? (field?.invalid || normalized === null);
  const swatch = normalized ?? '#FFFFFF';
  const commit = (raw: string) => {
    setDraft(raw);
    const hex = normalizeHex(raw);
    if (hex && hex !== normalizeHex(value)) onChange(hex);
  };
  return (
    <div className={cx('psp-colorinput', className)} data-size={size} data-invalid={isInvalid || undefined} data-disabled={isDisabled || undefined} {...rest}>
      <label className="psp-colorinput__swatch" style={{ background: swatch, color: contrastColor(swatch) }}>
        <span className="psp-colorinput__sample" aria-hidden="true">
          Aa
        </span>
        <input
          className="psp-colorinput__picker"
          type="color"
          aria-label={label}
          value={swatch.toLowerCase()}
          disabled={isDisabled}
          onChange={(event) => commit(event.currentTarget.value)}
        />
      </label>
      <input
        className="psp-colorinput__hex"
        id={controlId}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        maxLength={9}
        aria-label={hexLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid || undefined}
        value={draft}
        disabled={isDisabled}
        onChange={(event) => commit(event.currentTarget.value)}
        onBlur={() => {
          if (normalized) setDraft(normalized);
        }}
      />
      {presets && presets.length > 0 ? (
        <span className="psp-colorinput__presets">
          {presets.map((preset) => {
            const hex = normalizeHex(preset);
            if (!hex) return null;
            return (
              <button
                key={hex}
                type="button"
                className="psp-colorinput__preset"
                style={{ background: hex }}
                aria-label={hex}
                title={hex}
                aria-pressed={hex === normalized}
                disabled={isDisabled}
                onClick={() => commit(hex)}
              />
            );
          })}
        </span>
      ) : null}
    </div>
  );
}
