import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';

export interface KeyValueItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Slot para `ProvenanceTag` / `LockTag`. */
  provenance?: ReactNode;
  /** Valor en fuente monoespaciada (ids, hashes). */
  mono?: boolean;
}

export interface KeyValueProps extends Omit<ComponentProps<'dl'>, 'children'> {
  items: KeyValueItem[];
  columns?: 1 | 2 | 3;
  layout?: 'grid' | 'rows';
  /** Representación de valores nulos / vacíos. */
  emptyValue?: ReactNode;
  /** Texto accesible. */
  label?: string;
  'data-testid'?: string;
}

/** Pares etiqueta / valor en cuadrícula o filas. */
export function KeyValue({ items, columns = 2, layout = 'grid', emptyValue = '—', label, className, ...rest }: KeyValueProps) {
  return (
    <dl className={cx('psp-keyvalue', className)} data-columns={columns} data-layout={layout} aria-label={label} {...rest}>
      {items.map((item) => {
        const empty = item.value === undefined || item.value === null || item.value === '';
        return (
          <div key={item.key} className="psp-keyvalue__item" data-key={item.key}>
            <dt className="psp-keyvalue__label">
              {item.label}
              {item.provenance !== undefined ? <span className="psp-keyvalue__provenance">{item.provenance}</span> : null}
            </dt>
            <dd className={cx('psp-keyvalue__value', item.mono && 'psp-keyvalue__value--mono')} data-empty={empty || undefined}>
              {empty ? emptyValue : item.value}
              {item.hint !== undefined ? <span className="psp-keyvalue__hint">{item.hint}</span> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
