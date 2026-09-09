import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';

export interface CompareSide {
  src: string;
  /** Etiqueta visible ("Antes" / "Después", "Original" / "Editada"). */
  label: string;
  alt?: string;
  caption?: ReactNode;
}

export interface CompareViewProps extends Omit<ComponentProps<'div'>, 'children'> {
  left: CompareSide;
  right: CompareSide;
  /** Relación de aspecto CSS de cada imagen ("3 / 4"). */
  aspect?: string;
  orientation?: 'horizontal' | 'vertical';
  /** Resalta un lado (borde + marca) sin depender sólo del color. */
  highlight?: 'left' | 'right';
  /** Texto accesible del conjunto. */
  label?: string;
  'data-testid'?: string;
}

/** Dos imágenes lado a lado con etiquetas visibles. */
export function CompareView({ left, right, aspect = '3 / 4', orientation = 'horizontal', highlight, label, className, ...rest }: CompareViewProps) {
  const side = (item: CompareSide, key: 'left' | 'right') => (
    <figure className="psp-compare__side" data-side={key} data-highlight={highlight === key || undefined}>
      <div className="psp-compare__frame" style={{ aspectRatio: aspect }}>
        <img className="psp-compare__image" src={item.src} alt={item.alt ?? item.label} draggable={false} />
      </div>
      <figcaption className="psp-compare__label">
        {item.label}
        {item.caption !== undefined ? <span className="psp-compare__caption">{item.caption}</span> : null}
      </figcaption>
    </figure>
  );
  return (
    <div className={cx('psp-compare', className)} data-orientation={orientation} role="group" aria-label={label} {...rest}>
      {side(left, 'left')}
      {side(right, 'right')}
    </div>
  );
}
