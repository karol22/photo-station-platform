import { useEffect, useId, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx, toCssSize } from '../internal';
import { Icon } from '../icons';
import { IconButton } from '../kiosk/IconButton';

export interface DrawerProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  side?: 'right' | 'left';
  width?: number | string;
  /** Pie con acciones. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Cierra al tocar el fondo o pulsar Escape. */
  dismissible?: boolean;
  'data-testid'?: string;
}

/** Panel lateral (`role="dialog"`) para detalle o edición sin salir de la lista. */
export function Drawer({
  open,
  title,
  description,
  onClose,
  closeLabel = 'Cerrar',
  side = 'right',
  width,
  actions,
  children,
  dismissible = true,
  className,
  style,
  ...rest
}: DrawerProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    if (!dismissible || !onClose) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);
  if (!open) return null;
  return (
    <div className={cx('psp-drawer', className)} data-side={side} style={style} {...rest}>
      <div
        className="psp-drawer__backdrop"
        onClick={() => {
          if (dismissible) onClose?.();
        }}
      />
      <div
        ref={panelRef}
        className="psp-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? `${id}-title` : undefined}
        aria-describedby={description !== undefined ? `${id}-description` : undefined}
        tabIndex={-1}
        style={{ width: toCssSize(width) }}
      >
        <header className="psp-drawer__header">
          <div className="psp-drawer__heading">
            {title !== undefined ? (
              <h2 className="psp-drawer__title" id={`${id}-title`}>
                {title}
              </h2>
            ) : null}
            {description !== undefined ? (
              <p className="psp-drawer__description" id={`${id}-description`}>
                {description}
              </p>
            ) : null}
          </div>
          {onClose ? <IconButton label={closeLabel} icon={<Icon name="close" />} onClick={onClose} /> : null}
        </header>
        <div className="psp-drawer__body">{children}</div>
        {actions !== undefined ? <footer className="psp-drawer__actions">{actions}</footer> : null}
      </div>
    </div>
  );
}
