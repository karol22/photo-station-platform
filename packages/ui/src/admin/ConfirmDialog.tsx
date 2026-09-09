import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { Button } from './Button';
import { Input } from './Input';

export interface ConfirmDialogProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  /** Número de entidades afectadas por un cambio masivo (requisito 36). */
  affectedCount?: number;
  /** Texto que acompaña al número ("máquinas serán afectadas"). */
  affectedLabel?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Acción destructiva: botón rojo e icono de advertencia. */
  danger?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  /** Exige escribir un texto exacto antes de confirmar. */
  typeToConfirm?: { expected: string; label: ReactNode; placeholder?: string };
  children?: ReactNode;
  'data-testid'?: string;
}

/** Diálogo de confirmación (`alertdialog`) con conteo de afectados y opción de escribir para confirmar. */
export function ConfirmDialog({
  open,
  title,
  body,
  affectedCount,
  affectedLabel,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
  loading = false,
  confirmDisabled = false,
  typeToConfirm,
  className,
  children,
  ...rest
}: ConfirmDialogProps) {
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setTyped('');
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, loading]);

  if (!open) return null;
  const typeOk = !typeToConfirm || typed.trim() === typeToConfirm.expected;
  const canConfirm = !confirmDisabled && !loading && typeOk;
  return (
    <div className={cx('psp-dialog', className)} data-danger={danger || undefined} {...rest}>
      <div className="psp-dialog__backdrop" />
      <div className="psp-dialog__panel" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={body !== undefined ? `${id}-body` : undefined}>
        <header className="psp-dialog__header">
          {danger ? (
            <span className="psp-dialog__icon" aria-hidden="true">
              <Icon name="warning" />
            </span>
          ) : null}
          <h2 className="psp-dialog__title" id={`${id}-title`}>
            {title}
          </h2>
        </header>
        {body !== undefined ? (
          <div className="psp-dialog__body" id={`${id}-body`}>
            {body}
          </div>
        ) : null}
        {affectedCount !== undefined ? (
          <p className="psp-dialog__affected">
            <strong className="psp-dialog__affected-count">{affectedCount}</strong>
            {affectedLabel !== undefined ? <span className="psp-dialog__affected-label">{affectedLabel}</span> : null}
          </p>
        ) : null}
        {children}
        {typeToConfirm ? (
          <label className="psp-dialog__type">
            <span className="psp-dialog__type-label">{typeToConfirm.label}</span>
            <Input
              block
              value={typed}
              placeholder={typeToConfirm.placeholder}
              autoComplete="off"
              onChange={(event) => setTyped(event.currentTarget.value)}
            />
          </label>
        ) : null}
        <footer className="psp-dialog__actions">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={!canConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}
