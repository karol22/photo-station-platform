/**
 * Error comprensible: qué pasó, qué hacer, cómo pedir ayuda y código de incidente.
 * Los textos salen de `kiosk.errors.<code>.*` con respaldo genérico.
 */
import { useNavigate } from 'react-router-dom';
import { BigButton, ErrorPanel, Icon } from '@psp/ui';
import { EXTRA_TABLE } from '../i18n/extra';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { ROUTES } from '../session/flow';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';

export function ErrorScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const error = useKioskStore((s) => s.lastError);
  const bundle = useKioskStore((s) => s.bundle);
  const { session, cancel } = useSession();
  const rawCode = error?.code === 'session_closed' || error?.code === 'session_expired' ? 'session_expired' : error?.code;
  const code = rawCode && `kiosk.errors.${rawCode}.title` in EXTRA_TABLE ? rawCode : 'generic';
  const support = configString(bundle, 'legal.supportContact') ?? bundle?.organization.support?.phone ?? bundle?.organization.support?.email;
  const incident = error?.incidentCode ?? session?.errors.at(-1)?.incidentCode;

  const home = () => {
    if (session) void cancel(`error:${error?.code ?? 'generic'}`);
    else navigate(ROUTES.attract);
  };

  return (
    <Shell contentAlign="center">
      <ErrorPanel
        what={t(`kiosk.errors.${code}.title`)}
        whatToDo={t(`kiosk.errors.${code}.what`)}
        help={support ? t('kiosk.errors.help_contact', { contact: support }) : t('kiosk.errors.help')}
        incidentCode={incident}
        incidentLabel={t('kiosk.errors.incident')}
        size="lg"
        actions={
          <>
            {session ? (
              <BigButton variant="secondary" icon={<Icon name="retry" />} onClick={() => navigate(-1)}>
                {t('kiosk.errors.retry')}
              </BigButton>
            ) : null}
            <BigButton variant="primary" size="xl" onClick={home} data-testid="error-home">
              {t('kiosk.errors.home')}
            </BigButton>
          </>
        }
        data-testid="error-panel"
      />
    </Shell>
  );
}
