import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import type { LinkRenderer } from '../types';

export interface BreadcrumbItem {
  key?: string;
  label: ReactNode;
  /** Destino; con `renderLink` se delega al router. */
  to?: string;
  onClick?: () => void;
  /** Marca explícita de página actual (por defecto, el último ítem). */
  current?: boolean;
}

export interface BreadcrumbsProps extends Omit<ComponentProps<'nav'>, 'children'> {
  items: BreadcrumbItem[];
  renderLink?: LinkRenderer<BreadcrumbItem>;
  /** Texto accesible de la navegación. */
  label?: string;
  separator?: ReactNode;
  'data-testid'?: string;
}

/** Ruta de navegación; el último ítem lleva `aria-current="page"`. */
export function Breadcrumbs({ items, renderLink, label = 'Ruta', separator, className, ...rest }: BreadcrumbsProps) {
  return (
    <nav className={cx('psp-breadcrumbs', className)} aria-label={label} {...rest}>
      <ol className="psp-breadcrumbs__list">
        {items.map((item, index) => {
          const isCurrent = item.current ?? index === items.length - 1;
          const key = item.key ?? `${index}`;
          let content: ReactNode;
          if (isCurrent) {
            content = (
              <span className="psp-breadcrumbs__current" aria-current="page">
                {item.label}
              </span>
            );
          } else if (item.to !== undefined && renderLink) {
            content = renderLink(item, item.label, { className: 'psp-breadcrumbs__link' });
          } else if (item.to !== undefined) {
            content = (
              <a className="psp-breadcrumbs__link" href={item.to} onClick={item.onClick}>
                {item.label}
              </a>
            );
          } else if (item.onClick) {
            content = (
              <button type="button" className="psp-breadcrumbs__link" onClick={item.onClick}>
                {item.label}
              </button>
            );
          } else {
            content = <span className="psp-breadcrumbs__text">{item.label}</span>;
          }
          return (
            <li key={key} className="psp-breadcrumbs__item">
              {index > 0 ? (
                <span className="psp-breadcrumbs__separator" aria-hidden="true">
                  {separator ?? <Icon name="forward" />}
                </span>
              ) : null}
              {content}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
