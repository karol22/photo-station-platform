import { useState } from 'react';
import type { ComponentProps, KeyboardEvent, MouseEvent, ReactElement, ReactNode } from 'react';
import { cx, toCssSize } from '../internal';
import { Icon } from '../icons';
import { IconButton } from '../kiosk/IconButton';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Texto accesible cuando `header` es sólo un icono. */
  headerLabel?: string;
  /** Render de celda; por defecto muestra `row[key]`. */
  render?: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: 'start' | 'center' | 'end';
}

export interface DataTableSort {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Resumen visible; por defecto `from–to / total`. */
  summary?: (range: { from: number; to: number; total: number; page: number; pages: number }) => ReactNode;
  /** Textos accesibles de los botones. */
  prevLabel?: string;
  nextLabel?: string;
}

export interface DataTableEmpty {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}

export interface DataTableProps<T> extends Omit<ComponentProps<'div'>, 'children'> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Propiedad con la clave única o función que la calcula. */
  rowKey: keyof T | ((row: T) => string);
  loading?: boolean;
  loadingLabel?: string;
  /** Filas de esqueleto mientras carga. */
  loadingRows?: number;
  /** Mensaje de error; con `onRetry` muestra un botón. */
  error?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** Estado vacío (mensaje + acción). */
  empty?: DataTableEmpty;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  pagination?: DataTablePagination;
  /** Selección múltiple con casillas. */
  selectable?: boolean;
  /** Claves seleccionadas (controlado); sin él la tabla gestiona la selección. */
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  selectAllLabel?: string;
  selectRowLabel?: (row: T) => string;
  /** Acciones masivas; se muestran junto al conteo de seleccionados. */
  bulkActions?: ReactNode | ((selectedKeys: string[]) => ReactNode);
  /** Texto "N seleccionados"; por defecto sólo el número. */
  selectedLabel?: (count: number) => ReactNode;
  clearSelectionLabel?: string;
  onRowClick?: (row: T, index: number) => void;
  rowClassName?: (row: T, index: number) => string | undefined;
  caption?: ReactNode;
  /** Texto accesible de la tabla. */
  label?: string;
  dense?: boolean;
  stickyHeader?: boolean;
  /** Slot sobre la tabla (p. ej. `FilterBar`). */
  toolbar?: ReactNode;
  'data-testid'?: string;
}

function defaultCell<T>(row: T, key: string): ReactNode {
  if (row === null || typeof row !== 'object') return null;
  const value = (row as Record<string, unknown>)[key];
  if (value === undefined || value === null || value === '') return <span className="psp-table__empty-cell">—</span>;
  if (typeof value === 'boolean') return <Icon name={value ? 'check' : 'dash'} title={String(value)} />;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return null;
}

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]';

/**
 * Tabla administrativa con carga, error, vacío, orden, paginación, selección múltiple y acciones masivas.
 * Contempla los cuatro estados exigidos a toda pantalla administrativa.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  loadingLabel = 'Cargando',
  loadingRows,
  error,
  onRetry,
  retryLabel,
  empty,
  sort,
  onSortChange,
  pagination,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  selectAllLabel = 'Seleccionar todo',
  selectRowLabel,
  bulkActions,
  selectedLabel,
  clearSelectionLabel,
  onRowClick,
  rowClassName,
  caption,
  label,
  dense = false,
  stickyHeader = true,
  toolbar,
  className,
  ...rest
}: DataTableProps<T>): ReactElement {
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const selected = selectedKeys ?? internalSelected;
  const getKey = (row: T): string => (typeof rowKey === 'function' ? rowKey(row) : String((row as Record<string, unknown>)[rowKey as string]));
  const setSelected = (keys: string[]) => {
    if (selectedKeys === undefined) setInternalSelected(keys);
    onSelectionChange?.(keys);
  };
  const pageKeys = rows.map(getKey);
  const selectedSet = new Set(selected);
  const allSelected = pageKeys.length > 0 && pageKeys.every((key) => selectedSet.has(key));
  const someSelected = !allSelected && pageKeys.some((key) => selectedSet.has(key));
  const toggleAll = () => {
    if (allSelected) setSelected(selected.filter((key) => !pageKeys.includes(key)));
    else setSelected([...selected, ...pageKeys.filter((key) => !selectedSet.has(key))]);
  };
  const toggleRow = (key: string) => {
    if (selectedSet.has(key)) setSelected(selected.filter((item) => item !== key));
    else setSelected([...selected, key]);
  };
  const columnCount = columns.length + (selectable ? 1 : 0);
  const skeletonRows = loadingRows ?? Math.min(pagination?.pageSize ?? 5, 8);
  const showBody = !loading && !error && rows.length > 0;
  const pages = pagination ? Math.max(1, Math.ceil(pagination.total / Math.max(1, pagination.pageSize))) : 1;
  const from = pagination ? (pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1) : 0;
  const to = pagination ? Math.min(pagination.total, pagination.page * pagination.pageSize) : 0;

  const onRowActivate = (row: T, index: number) => (event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return;
    const target = event.target as HTMLElement | null;
    if (target && typeof target.closest === 'function' && target.closest(INTERACTIVE)) return;
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
    if ('key' in event) event.preventDefault();
    onRowClick(row, index);
  };

  return (
    <div
      className={cx('psp-table', dense && 'psp-table--dense', stickyHeader && 'psp-table--sticky', className)}
      aria-busy={loading || undefined}
      {...rest}
    >
      {toolbar !== undefined ? <div className="psp-table__toolbar">{toolbar}</div> : null}
      {selectable && selected.length > 0 ? (
        <div className="psp-table__bulk" role="region" aria-live="polite">
          <span className="psp-table__bulk-count">{selectedLabel ? selectedLabel(selected.length) : selected.length}</span>
          <div className="psp-table__bulk-actions">{typeof bulkActions === 'function' ? bulkActions(selected) : bulkActions}</div>
          {clearSelectionLabel !== undefined ? (
            <Button variant="ghost" size="sm" icon={<Icon name="close" />} onClick={() => setSelected([])}>
              {clearSelectionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="psp-table__scroll">
        <table className="psp-table__table" aria-label={label}>
          {caption !== undefined ? <caption className="psp-table__caption">{caption}</caption> : null}
          <colgroup>
            {selectable ? <col className="psp-table__col-select" /> : null}
            {columns.map((column) => (
              <col key={column.key} style={{ width: toCssSize(column.width) }} />
            ))}
          </colgroup>
          <thead className="psp-table__head">
            <tr>
              {selectable ? (
                <th scope="col" className="psp-table__th psp-table__th--select">
                  <input
                    type="checkbox"
                    className="psp-table__checkbox"
                    aria-label={selectAllLabel}
                    checked={allSelected}
                    disabled={loading || rows.length === 0}
                    ref={(element) => {
                      if (element) element.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const direction = active ? sort?.direction : undefined;
                const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : column.sortable ? 'none' : undefined;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className="psp-table__th"
                    data-align={column.align ?? 'start'}
                    data-sorted={direction}
                    aria-sort={ariaSort}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className="psp-table__sort"
                        aria-label={column.headerLabel}
                        onClick={() => onSortChange({ key: column.key, direction: active && direction === 'asc' ? 'desc' : 'asc' })}
                      >
                        <span>{column.header}</span>
                        <span className="psp-table__sort-icon" aria-hidden="true">
                          <Icon name={direction === 'asc' ? 'chevronUp' : direction === 'desc' ? 'chevronDown' : 'sort'} />
                        </span>
                      </button>
                    ) : (
                      <span aria-label={column.headerLabel}>{column.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="psp-table__body">
            {loading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={`skeleton-${index}`} className="psp-table__row psp-table__row--skeleton">
                    {selectable ? (
                      <td className="psp-table__td">
                        <Skeleton variant="rect" width={16} height={16} />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.key} className="psp-table__td">
                        <Skeleton label={index === 0 && column === columns[0] ? loadingLabel : undefined} />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!loading && error !== undefined && error !== null ? (
              <tr className="psp-table__row psp-table__row--state">
                <td className="psp-table__td" colSpan={columnCount}>
                  <EmptyState
                    tone="danger"
                    size="sm"
                    title={error}
                    action={
                      onRetry ? (
                        <Button variant="secondary" size="sm" icon={<Icon name="retry" />} onClick={onRetry}>
                          {retryLabel}
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : null}
            {!loading && !error && rows.length === 0 && empty ? (
              <tr className="psp-table__row psp-table__row--state">
                <td className="psp-table__td" colSpan={columnCount}>
                  <EmptyState size="sm" icon={empty.icon} title={empty.title} body={empty.body} action={empty.action} />
                </td>
              </tr>
            ) : null}
            {showBody
              ? rows.map((row, index) => {
                  const key = pageKeys[index] ?? `${index}`;
                  const isSelected = selectedSet.has(key);
                  const clickable = Boolean(onRowClick);
                  return (
                    <tr
                      key={key}
                      className={cx('psp-table__row', rowClassName?.(row, index))}
                      data-selected={isSelected || undefined}
                      data-clickable={clickable || undefined}
                      aria-selected={selectable ? isSelected : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? onRowActivate(row, index) : undefined}
                      onKeyDown={clickable ? onRowActivate(row, index) : undefined}
                    >
                      {selectable ? (
                        <td className="psp-table__td psp-table__td--select">
                          <input
                            type="checkbox"
                            className="psp-table__checkbox"
                            aria-label={selectRowLabel ? selectRowLabel(row) : undefined}
                            checked={isSelected}
                            onChange={() => toggleRow(key)}
                          />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td key={column.key} className="psp-table__td" data-align={column.align ?? 'start'}>
                          {column.render ? column.render(row, index) : defaultCell(row, column.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="psp-table__pagination">
          <span className="psp-table__summary">
            {pagination.summary ? pagination.summary({ from, to, total: pagination.total, page: pagination.page, pages }) : `${from}–${to} / ${pagination.total}`}
          </span>
          <div className="psp-table__pager">
            <IconButton
              label={pagination.prevLabel ?? 'Anterior'}
              icon={<Icon name="back" />}
              variant="outline"
              size="sm"
              disabled={loading || pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            />
            <span className="psp-table__page">
              {pagination.page} / {pages}
            </span>
            <IconButton
              label={pagination.nextLabel ?? 'Siguiente'}
              icon={<Icon name="forward" />}
              variant="outline"
              size="sm"
              disabled={loading || pagination.page >= pages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
