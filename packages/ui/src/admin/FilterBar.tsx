import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { Button } from './Button';

export interface FilterChip {
  key: string;
  label: ReactNode;
  onRemove?: () => void;
  /** Texto accesible del botón de quitar. */
  removeLabel?: string;
}

export interface FilterBarProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Controles de filtro (búsqueda, selects). */
  children?: ReactNode;
  /** Filtros activos como chips. */
  chips?: FilterChip[];
  onClear?: () => void;
  /** Texto del botón de limpiar; sin él no se muestra. */
  clearLabel?: string;
  /** Contenido a la derecha (ordenar, exportar). */
  end?: ReactNode;
  /** Texto accesible. */
  label?: string;
  'data-testid'?: string;
}

/** Barra de filtros con chips de filtros activos y acción de limpiar. */
export function FilterBar({ children, chips, onClear, clearLabel, end, label, className, ...rest }: FilterBarProps) {
  const hasChips = chips !== undefined && chips.length > 0;
  return (
    <div className={cx('psp-filterbar', className)} role="search" aria-label={label} {...rest}>
      <div className="psp-filterbar__row">
        <div className="psp-filterbar__controls">{children}</div>
        {end !== undefined ? <div className="psp-filterbar__end">{end}</div> : null}
      </div>
      {hasChips || (onClear && clearLabel !== undefined) ? (
        <div className="psp-filterbar__chips">
          {chips?.map((chip) => (
            <span key={chip.key} className="psp-filterbar__chip">
              <span className="psp-filterbar__chip-label">{chip.label}</span>
              {chip.onRemove ? (
                <button type="button" className="psp-filterbar__chip-remove" aria-label={chip.removeLabel} onClick={chip.onRemove}>
                  <Icon name="close" />
                </button>
              ) : null}
            </span>
          ))}
          {onClear && clearLabel !== undefined && hasChips ? (
            <Button variant="link" size="sm" onClick={onClear}>
              {clearLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
