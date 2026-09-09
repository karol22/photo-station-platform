import type { ComponentProps, ReactNode } from 'react';
import { cx } from './internal';

/** Nombres del set mínimo de iconos SVG inline (trazo, `currentColor`). */
export type IconName =
  | 'check'
  | 'warning'
  | 'cross'
  | 'camera'
  | 'print'
  | 'back'
  | 'forward'
  | 'retry'
  | 'close'
  | 'plus'
  | 'minus'
  | 'language'
  | 'settings'
  | 'info'
  | 'lock'
  | 'clock'
  | 'sparkles'
  | 'dash'
  | 'menu'
  | 'chevronDown'
  | 'chevronUp'
  | 'search'
  | 'user'
  | 'sort'
  | 'image'
  | 'edit'
  | 'eyeOff'
  | 'range'
  | 'trendUp'
  | 'trendDown'
  | 'inbox'
  | 'filter';

const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  warning: (
    <>
      <path d="M12 3.5L2.5 20h19L12 3.5z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17.2h.01" />
    </>
  ),
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  camera: (
    <>
      <path d="M4 8h3.2l1.8-3h6l1.8 3H20v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V4h10v5" />
      <path d="M4 9h16v7h-3v4H7v-4H4z" />
      <path d="M7 16h10" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  retry: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v5h-5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  dash: <path d="M6 12h12" />,
  language: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3.5 3 14.5 0 18" />
      <path d="M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  sort: <path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3" />,
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="16" cy="9" r="1.5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M13.5 6.5l3 3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.3A10 10 0 0 1 12 6c5 0 8.5 4 9.5 6-.4.8-1.2 2-2.4 3.1M6.6 6.7C4.4 8 3 10 2.5 12c1 2 4.5 6 9.5 6 1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  range: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  trendUp: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  trendDown: (
    <>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M15 17h6v-6" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
    </>
  ),
  filter: <path d="M4 5h16l-6 8v5l-4 2v-7z" />,
};

export interface IconProps extends Omit<ComponentProps<'svg'>, 'name' | 'children'> {
  name: IconName;
  /** Tamaño en px o unidad CSS; por defecto `1em` (escala con el texto). */
  size?: number | string;
  /** Texto accesible. Sin él, el icono es decorativo (`aria-hidden`). */
  title?: string;
  'data-testid'?: string;
}

/** Icono SVG inline de trazo. Decorativo salvo que reciba `title`. */
export function Icon({ name, size = '1em', title, className, ...rest }: IconProps) {
  return (
    <svg
      className={cx('psp-icon', className)}
      data-icon={name}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}

export const ICON_NAMES: IconName[] = Object.keys(PATHS) as IconName[];
