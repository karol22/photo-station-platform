import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { VisuallyHidden } from '../shared/VisuallyHidden';

export interface ThumbItem {
  id: string;
  src: string;
  alt?: string;
  /** Texto breve bajo la miniatura. */
  label?: string;
  disabled?: boolean;
}

/** Alterna `id` en la selección respetando el orden y el máximo. */
export function toggleSelection(selected: string[], id: string, max?: number): string[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  if (max !== undefined && selected.length >= max) return selected;
  return [...selected, id];
}

export interface ThumbGridProps extends Omit<ComponentProps<'ul'>, 'onChange' | 'children'> {
  items: ThumbItem[];
  /** Ids seleccionados en orden de selección. */
  selected?: string[];
  onChange?: (selected: string[]) => void;
  /** Máximo de elementos seleccionables. */
  max?: number;
  columns?: number;
  /** Relación de aspecto CSS de cada miniatura. */
  aspect?: string;
  /** Muestra el número de orden en la marca de selección. */
  showOrder?: boolean;
  /** Texto accesible del conjunto. */
  label?: string;
  /** Texto accesible añadido a cada miniatura seleccionada ("seleccionada"). */
  selectedLabel?: string;
  size?: 'md' | 'lg';
  'data-testid'?: string;
}

/** Cuadrícula de miniaturas seleccionables con orden y marca ✓. */
export function ThumbGrid({
  items,
  selected = [],
  onChange,
  max,
  columns = 3,
  aspect = '3 / 4',
  showOrder = true,
  label,
  selectedLabel,
  size = 'md',
  className,
  style,
  ...rest
}: ThumbGridProps) {
  const full = max !== undefined && selected.length >= max;
  return (
    <ul
      className={cx('psp-thumbs', className)}
      role="list"
      aria-label={label}
      data-size={size}
      style={{ ...(style ?? {}), gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}
      {...rest}
    >
      {items.map((item) => {
        const order = selected.indexOf(item.id);
        const isSelected = order >= 0;
        const blocked = item.disabled || (!isSelected && full);
        return (
          <li key={item.id} className="psp-thumbs__item">
            <button
              type="button"
              className="psp-thumbs__button"
              aria-pressed={isSelected}
              aria-disabled={blocked || undefined}
              disabled={item.disabled || !onChange}
              data-selected={isSelected || undefined}
              data-blocked={blocked || undefined}
              onClick={() => {
                if (!onChange || blocked) return;
                onChange(toggleSelection(selected, item.id, max));
              }}
            >
              <span className="psp-thumbs__frame" style={{ aspectRatio: aspect }}>
                <img className="psp-thumbs__image" src={item.src} alt={item.alt ?? item.label ?? ''} draggable={false} />
                {isSelected ? (
                  <span className="psp-thumbs__mark" aria-hidden="true">
                    {showOrder ? <span className="psp-thumbs__order">{order + 1}</span> : null}
                    <Icon name="check" />
                  </span>
                ) : null}
              </span>
              {item.label !== undefined ? <span className="psp-thumbs__label">{item.label}</span> : null}
              {isSelected && selectedLabel ? <VisuallyHidden>{selectedLabel}</VisuallyHidden> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
