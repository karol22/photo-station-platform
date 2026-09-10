/**
 * Error comprensible: qué pasó, qué hacer, cómo pedir ayuda y código de incidente.
 * Los textos salen de `kiosk.errors.<code>.*` con respaldo genérico.
 *
 * Un aviso de que la máquina no puede ocupa la pantalla entera, no una tarjeta de 480 px en el
 * centro: si la cabina falló, eso tiene que verse desde el pasillo para que nadie haga fila para
 * nada. Se usan las mismas cinco bandas del resto del recorrido, y el canal de contacto va en el
 * zócalo en tinta plena: dos de cada tres quejas formales documentadas contra cabinas de
 * autoservicio incluyen «no pude localizar al operador».
 */
import { useNavigate } from 'react-router-dom';
import { BigButton, ErrorPanel, Icon, Marquee } from '@psp/ui';
import { EXTRA_TABLE } from '../i18n/extra';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { ROUTES } from '../session/flow';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';
import { ClosingFooter } from './Finish';

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
    <Shell bleed hideHeader hideLang marquee={<Marquee cadence="still" />}>
      <div className="kiosk-cierre kiosk-cierre--error" data-stage="error" data-testid="error">
        <div className="kiosk-cierre__cartel">
          {/* El panel conserva su semántica de aviso (`role="alert"`) y su orden —qué pasó, qué
              hacer, cómo pedir ayuda—; lo que cambia es que ya no vive dentro de una tarjeta. */}
          <ErrorPanel
            what={t(`kiosk.errors.${code}.title`)}
            whatToDo={t(`kiosk.errors.${code}.what`)}
            help={support ? t('kiosk.errors.help_contact', { contact: support }) : t('kiosk.errors.help')}
            incidentCode={incident}
            incidentLabel={t('kiosk.errors.incident')}
            size="lg"
            data-testid="error-panel"
          />
        </div>

        <div className="kiosk-cierre__repisa" />

        <div className="kiosk-cierre__alcance">
          <BigButton className="kiosk-cierre__accion" variant="primary" size="xl" block onClick={home} data-testid="error-home">
            {t('kiosk.errors.home')}
          </BigButton>
          {session ? (
            <BigButton className="kiosk-cierre__salida" variant="ghost" icon={<Icon name="retry" />} onClick={() => navigate(-1)}>
              {t('kiosk.errors.retry')}
            </BigButton>
          ) : null}
        </div>

        <ClosingFooter bundle={bundle} />
      </div>
    </Shell>
  );
}
