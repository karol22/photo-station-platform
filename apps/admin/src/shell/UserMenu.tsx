/** Usuario y sesión en la barra superior: nombre, cambio de idioma y cerrar sesión. */
import { useMemo } from 'react';
import { Button } from '@psp/ui';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';
import { useSessionStore } from '../store/session';

export function UserMenu() {
  const principal = useSessionStore((s) => s.principal);
  const logout = useSessionStore((s) => s.logout);
  const locale = usePrefsStore((s) => s.locale);
  const setLocale = usePrefsStore((s) => s.setLocale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  if (!principal) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span>{principal.user.name}</span>
      <Button variant="ghost" size="sm" onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}>
        {locale === 'es' ? 'EN' : 'ES'}
      </Button>
      <Button variant="secondary" size="sm" onClick={logout}>
        {tr.t('admin.action.logout')}
      </Button>
    </div>
  );
}
