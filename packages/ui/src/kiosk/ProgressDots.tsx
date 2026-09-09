import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { VisuallyHidden } from '../shared/VisuallyHidden';

export interface ProgressDotsProps extends Omit<ComponentProps<'ol'>, 'children'> {
  /** Número total de pasos. */
  steps: number;
  /** Índice (base 0) del paso actual. */
  current: number;
  /** Nombres de paso para lectores de pantalla y `title`. */
  labels?: string[];
  /** Texto accesible del conjunto ("Progreso"). */
  label?: string;
  /** Muestra el número dentro de cada punto. */
  showNumbers?: boolean;
  size?: 'md' | 'lg';
  'data-testid'?: string;
}

/** Indicador de pasos: hechos (✓), actual (número, mayor) y pendientes. */
export function ProgressDots({ steps, current, labels, label, showNumbers = true, size = 'md', className, ...rest }: ProgressDotsProps) {
  const items = Array.from({ length: Math.max(0, steps) }, (_, index) => index);
  return (
    <ol className={cx('psp-dots', className)} aria-label={label} data-size={size} {...rest}>
      {items.map((index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        const name = labels?.[index];
        return (
          <li
            key={index}
            className="psp-dots__dot"
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
            title={name}
          >
            {state === 'done' ? (
              <span className="psp-dots__icon" aria-hidden="true">
                <Icon name="check" />
              </span>
            ) : showNumbers ? (
              <span className="psp-dots__number" aria-hidden="true">
                {index + 1}
              </span>
            ) : null}
            <VisuallyHidden>{name ?? String(index + 1)}</VisuallyHidden>
          </li>
        );
      })}
    </ol>
  );
}
