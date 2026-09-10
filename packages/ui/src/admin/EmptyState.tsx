import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';

export interface EmptyStateProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  icon?: ReactNode | false;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'neutral' | 'danger' | 'info';
  'data-testid'?: string;
}

/** Estado vacío / sin resultados / error de carga con acción sugerida. */
export function EmptyState({ icon, title, body, action, size = 'md', tone = 'neutral', className, ...rest }: EmptyStateProps) {
  return (
    <div className={cx('psp-empty', className)} data-size={size} data-tone={tone} role={tone === 'danger' ? 'alert' : undefined} {...rest}>
      {icon === false ? null : (
        <span className="psp-empty__icon" aria-hidden="true">
          {icon ?? <Icon name={tone === 'danger' ? 'warning' : 'inbox'} />}
        </span>
      )}
      <p className="psp-empty__title">{title}</p>
      {body !== undefined ? <p className="psp-empty__body">{body}</p> : null}
      {action !== undefined ? <div className="psp-empty__action">{action}</div> : null}
    </div>
  );
}
