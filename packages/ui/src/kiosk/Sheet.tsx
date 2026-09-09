import { useEffect, useId, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { IconButton } from './IconButton';

export interface SheetProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  /** Texto accesible del botón de cerrar. */
  closeLabel?: string;
  /** Fila de acciones (normalmente `BigButton`). */
  actions?: ReactNode;
  children?: ReactNode;
  /** Altura: según contenido, media pantalla o pantalla completa. */
  size?: 'auto' | 'half' | 'full';
  /** Cierra al tocar el fondo o pulsar Escape. */
  dismissible?: boolean;
  /** Oculta el asa superior. */
  hideHandle?: boolean;
  'data-testid'?: string;
}

/** Panel modal que se desliza desde abajo. `role="dialog"`, `aria-modal`, foco inicial en el panel. */
export function Sheet({
  open,
  title,
  description,
  onClose,
  closeLabel = 'Cerrar',
  actions,
  children,
  size = 'auto',
  dismissible = true,
  hideHandle = false,
  className,
  ...rest
}: SheetProps) {
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
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  return (
    <div className={cx('psp-sheet', className)} data-size={size} {...rest}>
      <div
        className="psp-sheet__backdrop"
        onClick={() => {
          if (dismissible) onClose?.();
        }}
      />
      <div
        ref={panelRef}
        className="psp-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        tabIndex={-1}
      >
        {hideHandle ? null : <div className="psp-sheet__handle" aria-hidden="true" />}
        {title !== undefined || onClose ? (
          <header className="psp-sheet__header">
            {title !== undefined ? (
              <h2 className="psp-sheet__title" id={titleId}>
                {title}
              </h2>
            ) : (
              <span />
            )}
            {onClose ? (
              <IconButton className="psp-sheet__close" label={closeLabel} icon={<Icon name="close" />} size="lg" onClick={onClose} />
            ) : null}
          </header>
        ) : null}
        {description !== undefined ? (
          <p className="psp-sheet__description" id={descriptionId}>
            {description}
          </p>
        ) : null}
        <div className="psp-sheet__body">{children}</div>
        {actions !== undefined ? <div className="psp-sheet__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
