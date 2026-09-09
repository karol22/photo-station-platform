import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { useFieldContext } from './Field';

export interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
  block?: boolean;
  'data-testid'?: string;
}

/** Área de texto. Dentro de `Field` enlaza ids y estado. */
export function Textarea({ invalid, block = false, className, id, disabled, required, rows = 3, ...rest }: TextareaProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <textarea
      className={cx('psp-textarea', block && 'psp-textarea--block', className)}
      id={id ?? field?.id}
      rows={rows}
      aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
      aria-invalid={isInvalid || undefined}
      data-invalid={isInvalid || undefined}
      disabled={disabled ?? field?.disabled}
      required={required ?? field?.required}
      {...rest}
    />
  );
}
