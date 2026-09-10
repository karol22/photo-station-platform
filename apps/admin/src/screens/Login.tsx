/** Pantalla pública de inicio de sesión. */
import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Button, Field, Input } from '@psp/ui';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';
import { useSessionStore } from '../store/session';

export function Login() {
  const token = useSessionStore((s) => s.token);
  const status = useSessionStore((s) => s.status);
  const error = useSessionStore((s) => s.error);
  const login = useSessionStore((s) => s.login);
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (token) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  return (
    <div className="psp-admin" style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <form
        style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          void login(email, password);
        }}
      >
        <h1>{tr.t('admin.auth.titulo')}</h1>
        {error !== undefined ? <Alert tone="danger">{tr.t('admin.auth.credencialesInvalidas')}</Alert> : null}
        <Field label={tr.t('admin.auth.correo')} required>
          <Input type="email" value={email} autoComplete="username" onChange={(event) => setEmail(event.target.value)} block required />
        </Field>
        <Field label={tr.t('admin.auth.contrasena')} required>
          <Input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} block required />
        </Field>
        <Button type="submit" variant="primary" loading={status === 'loading'} block>
          {tr.t('admin.auth.entrar')}
        </Button>
      </form>
    </div>
  );
}
