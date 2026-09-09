import { createContext, useContext, useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { VisuallyHidden } from '../shared/VisuallyHidden';

export interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Contexto que `Input`, `Select`, `Textarea`, `NumberInput` y `ColorInput` usan para enlazar ids y estado. */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps extends Omit<ComponentProps<'div'>, 'children'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Texto accesible del asterisco ("obligatorio"). */
  requiredLabel?: string;
  /** Id del control; por defecto se genera. */
  id?: string;
  disabled?: boolean;
  /** Etiqueta y control en la misma fila. */
  inline?: boolean;
  /** Slot para `ProvenanceTag` / `LockTag` junto a la etiqueta. */
  provenance?: ReactNode;
  /** Contenido adicional a la derecha de la etiqueta. */
  labelAddon?: ReactNode;
  /** Control: nodo (usa el contexto) o función que recibe ids y estado. */
  children?: ReactNode | ((field: FieldContextValue) => ReactNode);
  'data-testid'?: string;
}

/** Campo de formulario: etiqueta, ayuda, error, obligatorio y procedencia de configuración. */
export function Field({
  label,
  hint,
  error,
  required = false,
  requiredLabel,
  id: explicitId,
  disabled = false,
  inline = false,
  provenance,
  labelAddon,
  className,
  children,
  ...rest
}: FieldProps) {
  const generated = useId();
  const id = explicitId ?? `${generated}-control`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint !== undefined ? hintId : null, error !== undefined ? errorId : null].filter(Boolean).join(' ') || undefined;
  const invalid = error !== undefined && error !== null && error !== false;
  const context: FieldContextValue = { id, describedBy, invalid, required, disabled };
  return (
    <div
      className={cx('psp-field', inline && 'psp-field--inline', className)}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      {...rest}
    >
      <div className="psp-field__head">
        <label className="psp-field__label" htmlFor={id}>
          {label}
          {required ? (
            <span className="psp-field__required" aria-hidden={requiredLabel ? true : undefined}>
              *
            </span>
          ) : null}
          {required && requiredLabel ? <VisuallyHidden> ({requiredLabel})</VisuallyHidden> : null}
        </label>
        {provenance !== undefined ? <span className="psp-field__provenance">{provenance}</span> : null}
        {labelAddon !== undefined ? <span className="psp-field__addon">{labelAddon}</span> : null}
      </div>
      <div className="psp-field__control">
        <FieldContext.Provider value={context}>{typeof children === 'function' ? children(context) : children}</FieldContext.Provider>
      </div>
      {hint !== undefined ? (
        <p className="psp-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {invalid ? (
        <p className="psp-field__error" id={errorId} role="alert">
          <span className="psp-field__error-icon" aria-hidden="true">
            <Icon name="warning" />
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
