import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { VisuallyHidden } from '../shared/VisuallyHidden';

export interface PriceTagProps extends Omit<ComponentProps<'span'>, 'children'> {
  /** Precio ya formateado por la app (moneda y locale se resuelven en `@psp/i18n`). */
  value: string;
  /** Precio anterior (tachado) cuando aplica una promoción. */
  original?: string;
  /** Texto accesible que precede al precio anterior. */
  originalLabel?: string;
  /** Nota breve: "por sesión", "incluye 2 impresiones"... */
  note?: string;
  size?: 'md' | 'lg' | 'xl';
  tone?: 'default' | 'accent' | 'ok';
  /** Texto accesible del conjunto (p. ej. "Precio"). */
  label?: string;
  'data-testid'?: string;
}

/** Precio grande y legible; recibe cadenas ya formateadas. */
export function PriceTag({ value, original, originalLabel, note, size = 'md', tone = 'default', label, className, ...rest }: PriceTagProps) {
  return (
    <span className={cx('psp-pricetag', className)} data-size={size} data-tone={tone} aria-label={label} {...rest}>
      {original !== undefined ? (
        <s className="psp-pricetag__original">
          {originalLabel ? <VisuallyHidden>{originalLabel} </VisuallyHidden> : null}
          {original}
        </s>
      ) : null}
      <span className="psp-pricetag__value">{value}</span>
      {note !== undefined ? <span className="psp-pricetag__note">{note}</span> : null}
    </span>
  );
}
