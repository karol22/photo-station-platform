import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon, type IconName } from '../icons';
import { VisuallyHidden } from '../shared/VisuallyHidden';

export type CriterionStatus = 'ok' | 'warn' | 'block' | 'na';

export interface CriteriaItem {
  key: string;
  label: string;
  status: CriterionStatus;
  /** Sugerencia de corrección en lenguaje simple. */
  hint?: string;
}

export const CRITERION_ICON: Record<CriterionStatus, IconName> = {
  ok: 'check',
  warn: 'warning',
  block: 'cross',
  na: 'dash',
};

export interface CriteriaListProps extends Omit<ComponentProps<'ul'>, 'children'> {
  items: CriteriaItem[];
  /** Texto accesible por estado (p. ej. { ok: 'Correcto', block: 'Bloquea' }). */
  statusLabels?: Partial<Record<CriterionStatus, string>>;
  compact?: boolean;
  /** Texto accesible de la lista. */
  label?: string;
  'data-testid'?: string;
}

/** Lista de criterios de cumplimiento: icono ✓ / ! / ✕ / – más color y texto. */
export function CriteriaList({ items, statusLabels, compact = false, label, className, ...rest }: CriteriaListProps) {
  return (
    <ul className={cx('psp-criteria', compact && 'psp-criteria--compact', className)} aria-label={label} {...rest}>
      {items.map((item) => (
        <li key={item.key} className="psp-criteria__item" data-status={item.status} data-key={item.key}>
          <span className="psp-criteria__icon" aria-hidden="true">
            <Icon name={CRITERION_ICON[item.status]} />
          </span>
          <span className="psp-criteria__text">
            {statusLabels?.[item.status] ? <VisuallyHidden>{statusLabels[item.status]}: </VisuallyHidden> : null}
            <span className="psp-criteria__label">{item.label}</span>
            {item.hint !== undefined ? <span className="psp-criteria__hint">{item.hint}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
