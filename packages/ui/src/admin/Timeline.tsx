import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { TONE_ICON } from '../kiosk/StatusPill';
import type { Tone } from '../types';

export interface TimelineItem {
  key?: string;
  /** Marca de tiempo (ISO o ya formateada); se muestra con `formatAt` si existe. */
  at: string;
  title: ReactNode;
  body?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /** Quién lo hizo (usuario, máquina, sistema). */
  actor?: ReactNode;
}

export interface TimelineProps extends Omit<ComponentProps<'ol'>, 'children'> {
  items: TimelineItem[];
  formatAt?: (at: string) => ReactNode;
  /** Texto accesible. */
  label?: string;
  dense?: boolean;
  'data-testid'?: string;
}

/** Línea de tiempo vertical de eventos con tono e icono. */
export function Timeline({ items, formatAt, label, dense = false, className, ...rest }: TimelineProps) {
  return (
    <ol className={cx('psp-timeline', dense && 'psp-timeline--dense', className)} aria-label={label} {...rest}>
      {items.map((item, index) => {
        const tone = item.tone ?? 'neutral';
        return (
          <li key={item.key ?? `${index}`} className="psp-timeline__item" data-tone={tone}>
            <span className="psp-timeline__marker" aria-hidden="true">
              {item.icon ?? <Icon name={TONE_ICON[tone]} />}
            </span>
            <div className="psp-timeline__content">
              <div className="psp-timeline__head">
                <span className="psp-timeline__title">{item.title}</span>
                <time className="psp-timeline__at" dateTime={item.at}>
                  {formatAt ? formatAt(item.at) : item.at}
                </time>
              </div>
              {item.actor !== undefined ? <span className="psp-timeline__actor">{item.actor}</span> : null}
              {item.body !== undefined ? <div className="psp-timeline__body">{item.body}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
