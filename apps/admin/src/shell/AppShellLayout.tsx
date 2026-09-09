/**
 * Marco de la consola: navegación filtrada por permisos (`lib/navFilter.ts`), selector de alcance
 * y menú de usuario en la barra superior. El portal de franquicia es esta misma app: el shell
 * sólo muestra lo permitido (`ScopeSwitcher` fija el alcance cuando el principal ve uno solo).
 */
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@psp/ui';
import type { AppShellNavItem } from '@psp/ui';
import { createTranslator } from '../i18n/extra';
import { filterNavigation } from '../lib/navFilter';
import { usePrefsStore } from '../store/prefs';
import { useSessionStore } from '../store/session';
import { ScopeSwitcher } from './ScopeSwitcher';
import { UserMenu } from './UserMenu';
import { NAVIGATION, activeNavKey } from './navigation';

export function AppShellLayout() {
  const principal = useSessionStore((s) => s.principal);
  const locale = usePrefsStore((s) => s.locale);
  const collapsed = usePrefsStore((s) => s.sidebarCollapsed);
  const setCollapsed = usePrefsStore((s) => s.setSidebarCollapsed);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const location = useLocation();
  const navigate = useNavigate();

  const sections = useMemo(() => filterNavigation(NAVIGATION, principal), [principal]);
  const nav: AppShellNavItem[] = useMemo(
    () => sections.flatMap((section) => section.items.map((item) => ({ key: item.key, label: tr.t(item.labelKey), to: item.path, group: tr.t(section.labelKey) }))),
    [sections, tr],
  );

  return (
    <div className="psp-admin">
      <AppShell
        nav={nav}
        activeKey={activeNavKey(location.pathname)}
        renderLink={(item, content, attrs) => (
          <a
            {...attrs}
            href={item.to}
            onClick={(event) => {
              event.preventDefault();
              navigate(item.to);
            }}
          >
            {content}
          </a>
        )}
        brand={<strong>PSP Admin</strong>}
        title={tr.t('admin.nav.dashboard')}
        scopeSwitcher={<ScopeSwitcher />}
        user={<UserMenu />}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        sidebarFooter={
          <a href="/saved-views" onClick={(event) => { event.preventDefault(); navigate('/saved-views'); }}>
            {tr.t('admin.savedViews.title')}
          </a>
        }
      >
        <Outlet />
      </AppShell>
    </div>
  );
}
