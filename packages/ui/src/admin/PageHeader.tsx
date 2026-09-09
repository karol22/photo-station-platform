import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import type { LinkRenderer } from '../types';

export interface PageHeaderProps extends Omit<ComponentProps<'header'>, 'title' | 'children'> {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Ítems para `Breadcrumbs` o un nodo ya compuesto. */
  breadcrumbs?: BreadcrumbItem[] | ReactNode;
  renderLink?: LinkRenderer<BreadcrumbItem>;
  breadcrumbsLabel?: string;
  /** Botones de acción (la primaria a la derecha). */
  actions?: ReactNode;
  /** Etiquetas junto al título (estado, alcance). */
  meta?: ReactNode;
  /** Contenido bajo el encabezado (p. ej. `Tabs`). */
  children?: ReactNode;
  'data-testid'?: string;
}

/** Encabezado de página: migas, título, subtítulo, metadatos y acciones. */
export function PageHeader({ title, subtitle, breadcrumbs, renderLink, breadcrumbsLabel, actions, meta, className, children, ...rest }: PageHeaderProps) {
  return (
    <header className={cx('psp-pageheader', className)} {...rest}>
      {Array.isArray(breadcrumbs) ? (
        <Breadcrumbs className="psp-pageheader__breadcrumbs" items={breadcrumbs} renderLink={renderLink} label={breadcrumbsLabel} />
      ) : breadcrumbs !== undefined ? (
        <div className="psp-pageheader__breadcrumbs">{breadcrumbs}</div>
      ) : null}
      <div className="psp-pageheader__row">
        <div className="psp-pageheader__heading">
          <div className="psp-pageheader__title-row">
            <h1 className="psp-pageheader__title">{title}</h1>
            {meta !== undefined ? <div className="psp-pageheader__meta">{meta}</div> : null}
          </div>
          {subtitle !== undefined ? <p className="psp-pageheader__subtitle">{subtitle}</p> : null}
        </div>
        {actions !== undefined ? <div className="psp-pageheader__actions">{actions}</div> : null}
      </div>
      {children !== undefined ? <div className="psp-pageheader__extra">{children}</div> : null}
    </header>
  );
}
