import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';
import { IconButton } from '../kiosk/IconButton';
import type { LinkRenderer } from '../types';

export interface AppShellNavItem {
  key: string;
  label: string;
  icon?: ReactNode;
  to: string;
  badge?: string | number;
  /** Encabezado de grupo; los ítems consecutivos con el mismo grupo se agrupan. */
  group?: string;
  disabled?: boolean;
}

export interface AppShellProps extends Omit<ComponentProps<'div'>, 'children' | 'title'> {
  nav: AppShellNavItem[];
  /** `key` del ítem activo (`aria-current="page"`). */
  activeKey?: string;
  /** Integra el router; por defecto renderiza `<a href>`. */
  renderLink?: LinkRenderer<AppShellNavItem>;
  brand?: ReactNode;
  /** Pie del sidebar (versión, soporte). */
  sidebarFooter?: ReactNode;
  /** Selector de alcance (organización / franquicia / ubicación) en la barra superior. */
  scopeSwitcher?: ReactNode;
  /** Menú de usuario en la barra superior. */
  user?: ReactNode;
  topbarStart?: ReactNode;
  topbarEnd?: ReactNode;
  title?: ReactNode;
  /** Estado controlado del sidebar. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Textos accesibles. */
  collapseLabel?: string;
  expandLabel?: string;
  navLabel?: string;
  children?: ReactNode;
  'data-testid'?: string;
}

/** Marco de la consola: sidebar colapsable con navegación por grupos, barra superior y contenido. */
export function AppShell({
  nav,
  activeKey,
  renderLink,
  brand,
  sidebarFooter,
  scopeSwitcher,
  user,
  topbarStart,
  topbarEnd,
  title,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  collapseLabel = 'Contraer menú',
  expandLabel = 'Expandir menú',
  navLabel = 'Navegación principal',
  className,
  children,
  ...rest
}: AppShellProps) {
  const [internal, setInternal] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internal;
  const toggle = () => {
    const next = !isCollapsed;
    if (collapsed === undefined) setInternal(next);
    onCollapsedChange?.(next);
  };
  const groups: Array<{ group: string | undefined; items: AppShellNavItem[] }> = [];
  for (const item of nav) {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return (
    <div className={cx('psp-appshell', className)} data-collapsed={isCollapsed || undefined} {...rest}>
      <aside className="psp-appshell__sidebar">
        <div className="psp-appshell__sidebar-head">
          {brand !== undefined ? <div className="psp-appshell__brand">{brand}</div> : null}
          <IconButton
            className="psp-appshell__collapse"
            label={isCollapsed ? expandLabel : collapseLabel}
            icon={<Icon name="menu" />}
            aria-expanded={!isCollapsed}
            onClick={toggle}
          />
        </div>
        <nav className="psp-appshell__nav" aria-label={navLabel}>
          {groups.map((group, groupIndex) => (
            <div key={group.group ?? `g${groupIndex}`} className="psp-appshell__group">
              {group.group !== undefined ? <div className="psp-appshell__group-title">{group.group}</div> : null}
              <ul className="psp-appshell__list">
                {group.items.map((item) => {
                  const active = item.key === activeKey;
                  const content = (
                    <>
                      <span className="psp-appshell__item-icon" aria-hidden="true">
                        {item.icon ?? <span className="psp-appshell__item-initial">{item.label.slice(0, 1)}</span>}
                      </span>
                      <span className="psp-appshell__item-label">{item.label}</span>
                      {item.badge !== undefined ? <span className="psp-appshell__item-badge">{item.badge}</span> : null}
                    </>
                  );
                  const attrs = {
                    className: cx('psp-appshell__item', active && 'psp-appshell__item--active'),
                    'aria-current': active ? ('page' as const) : undefined,
                    title: isCollapsed ? item.label : undefined,
                  };
                  return (
                    <li key={item.key} className="psp-appshell__list-item" data-active={active || undefined} data-disabled={item.disabled || undefined}>
                      {item.disabled ? (
                        <span className={attrs.className} aria-disabled="true" title={attrs.title}>
                          {content}
                        </span>
                      ) : renderLink ? (
                        renderLink(item, content, attrs)
                      ) : (
                        <a href={item.to} {...attrs}>
                          {content}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        {sidebarFooter !== undefined ? <div className="psp-appshell__sidebar-footer">{sidebarFooter}</div> : null}
      </aside>
      <div className="psp-appshell__body">
        <header className="psp-appshell__topbar">
          <div className="psp-appshell__topbar-start">
            {topbarStart}
            {scopeSwitcher !== undefined ? <div className="psp-appshell__scope">{scopeSwitcher}</div> : null}
            {title !== undefined ? <div className="psp-appshell__title">{title}</div> : null}
          </div>
          <div className="psp-appshell__topbar-end">
            {topbarEnd}
            {user !== undefined ? <div className="psp-appshell__user">{user}</div> : null}
          </div>
        </header>
        <main className="psp-appshell__main">{children}</main>
      </div>
    </div>
  );
}
