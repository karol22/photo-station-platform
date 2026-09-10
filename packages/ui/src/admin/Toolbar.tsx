import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';

export interface ToolbarProps extends ComponentProps<'div'> {
  /** Grupo al inicio (izquierda). */
  start?: ReactNode;
  /** Grupo al final (derecha). */
  end?: ReactNode;
  /** Texto accesible (`role="toolbar"`). */
  label?: string;
  dense?: boolean;
  sticky?: boolean;
  /** Permite salto de línea en pantallas estrechas. */
  wrap?: boolean;
  'data-testid'?: string;
}

/** Barra de acciones con grupos inicio / centro / fin. */
export function Toolbar({ start, end, label, dense = false, sticky = false, wrap = true, className, children, ...rest }: ToolbarProps) {
  return (
    <div
      className={cx('psp-toolbar', dense && 'psp-toolbar--dense', sticky && 'psp-toolbar--sticky', wrap && 'psp-toolbar--wrap', className)}
      role="toolbar"
      aria-label={label}
      {...rest}
    >
      {start !== undefined ? <div className="psp-toolbar__start">{start}</div> : null}
      {children !== undefined ? <div className="psp-toolbar__center">{children}</div> : null}
      {end !== undefined ? <div className="psp-toolbar__end">{end}</div> : null}
    </div>
  );
}
