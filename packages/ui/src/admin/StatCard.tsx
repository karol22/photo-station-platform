import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import type { Tone } from '../types';
import { Skeleton } from './Skeleton';

export interface StatDelta {
  /** Texto ya formateado ("+12 %"). */
  value: string;
  direction?: 'up' | 'down' | 'flat';
  tone?: Tone;
  /** Contexto ("vs. semana anterior"). */
  label?: ReactNode;
}

export interface StatCardProps extends Omit<ComponentProps<'div'>, 'children'> {
  label: ReactNode;
  value: ReactNode;
  delta?: StatDelta;
  tone?: Tone;
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  action?: ReactNode;
  'data-testid'?: string;
}

/** Métrica destacada con variación (flecha + texto) y tono. */
export function StatCard({ label, value, delta, tone = 'neutral', hint, icon, loading = false, action, className, ...rest }: StatCardProps) {
  const direction = delta?.direction ?? 'flat';
  return (
    <div className={cx('psp-stat', className)} data-tone={tone} aria-busy={loading || undefined} {...rest}>
      <div className="psp-stat__top">
        <span className="psp-stat__label">{label}</span>
        {icon !== undefined ? (
          <span className="psp-stat__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="psp-stat__value">{loading ? <Skeleton width="60%" height="1.6em" /> : value}</div>
      {delta !== undefined && !loading ? (
        <div className="psp-stat__delta" data-direction={direction} data-tone={delta.tone ?? 'neutral'}>
          <span className="psp-stat__delta-icon" aria-hidden="true">
            <Icon name={direction === 'up' ? 'trendUp' : direction === 'down' ? 'trendDown' : 'dash'} />
          </span>
          <span className="psp-stat__delta-value">{delta.value}</span>
          {delta.label !== undefined ? <span className="psp-stat__delta-label">{delta.label}</span> : null}
        </div>
      ) : null}
      {hint !== undefined ? <div className="psp-stat__hint">{hint}</div> : null}
      {action !== undefined ? <div className="psp-stat__action">{action}</div> : null}
    </div>
  );
}
