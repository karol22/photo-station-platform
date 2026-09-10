import type { ComponentProps } from 'react';
import { cx, toCssSize } from '../internal';

export interface SkeletonProps extends Omit<ComponentProps<'span'>, 'children'> {
  variant?: 'text' | 'rect' | 'circle';
  width?: number | string;
  height?: number | string;
  /** Número de líneas (sólo `text`); la última es más corta. */
  lines?: number;
  /** Texto accesible; sin él, el esqueleto es decorativo. */
  label?: string;
  'data-testid'?: string;
}

/** Marcador de carga con brillo animado. */
export function Skeleton({ variant = 'text', width, height, lines = 1, label, className, style, ...rest }: SkeletonProps) {
  const base = { ...(style ?? {}), width: toCssSize(width), height: toCssSize(height) };
  const a11y = label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true as const };
  if (variant === 'text' && lines > 1) {
    return (
      <span className={cx('psp-skeleton-group', className)} {...a11y} {...rest}>
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className="psp-skeleton"
            data-variant="text"
            style={{ ...base, width: index === lines - 1 ? '60%' : base.width }}
          />
        ))}
      </span>
    );
  }
  return <span className={cx('psp-skeleton', className)} data-variant={variant} style={base} {...a11y} {...rest} />;
}
