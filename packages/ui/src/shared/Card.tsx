import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';

export interface CardProps extends Omit<ComponentProps<'section'>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  /** Sin relleno interno (p. ej. para contener una tabla). */
  flush?: boolean;
  'data-testid'?: string;
}

/** Superficie con borde, título opcional y acciones. Compartida por kiosco y admin. */
export function Card({ title, subtitle, actions, footer, flush = false, className, children, ...rest }: CardProps) {
  const hasHeader = title !== undefined || subtitle !== undefined || actions !== undefined;
  return (
    <section className={cx('psp-card', flush && 'psp-card--flush', className)} {...rest}>
      {hasHeader ? (
        <header className="psp-card__header">
          <div className="psp-card__heading">
            {title !== undefined ? <h3 className="psp-card__title">{title}</h3> : null}
            {subtitle !== undefined ? <p className="psp-card__subtitle">{subtitle}</p> : null}
          </div>
          {actions !== undefined ? <div className="psp-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="psp-card__body">{children}</div>
      {footer !== undefined ? <footer className="psp-card__footer">{footer}</footer> : null}
    </section>
  );
}
