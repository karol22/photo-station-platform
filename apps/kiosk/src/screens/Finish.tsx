/**
 * Cierre: la entrega y la despedida. Cierra la sesión en el aparato (`POST /finish`), enseña el
 * enlace efímero del Club cuando la marca lo tiene encendido, y vuelve sola a atracción limpiando
 * todo el estado.
 *
 * Muere la tarjeta blanca centrada de 720 px con el código de sesión y el estado de impresión: eso
 * son datos de la operación, no el momento en que alguien acaba de conseguir su foto. Lo que ocupa
 * la pantalla es el resultado o el cuadro del código; los seis colores y la familia celebran; el
 * código de rescate se lee de pie; y a quién llamar va en tinta plena en el zócalo, porque dos de
 * cada tres quejas formales documentadas contra cabinas de autoservicio incluyen «no pude localizar
 * al operador».
 *
 * Dos cosas que ya estaban resueltas y siguen igual:
 *
 * 1. El cierre reintenta y, si el agente no responde, cancela la sesión: la máquina queda libre
 *    pase lo que pase, porque la persona ya tiene lo suyo y la fila no puede quedarse trabada.
 * 2. El enlace del Club identifica a la persona y **nunca transporta la fotografía**. Aquí no se
 *    entrega ninguna imagen: las fotos no salen de la máquina.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CustomerHandoff, FinishSessionResponse, KioskBundle } from '@psp/contracts';
import { featureMode } from '@psp/domain';
import { BigButton, BlobFace, BLOB_VARIANTS, Marquee } from '@psp/ui';
import { stationApi } from '../api/station';
import { HandoffPanel } from '../components/HandoffPanel';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { productViews } from '../lib/products';
import { ROUTES } from '../session/flow';
import { useKioskStore } from '../store';
import { configString } from '../theme/assets';

const BACK_SECONDS = 10;
type Finished = ReturnType<typeof FinishSessionResponse.parse>;

/** Estados en los que el enlace sigue sirviendo para algo y no hace falta pedir otro. */
const LIVE_HANDOFF = new Set(['offered', 'pending', 'linked', 'coming_soon']);

/**
 * El enlace utilizable de la sesión, si ya existe.
 *
 * La composición lo pide antes de terminar el render en alta, precisamente para que al llegar aquí
 * ya esté hecho y nadie espere por un código. Si aquel intento falló, esta pantalla lo pide otra
 * vez; lo que no hace nunca es pedir un segundo enlace cuando ya hay uno vivo.
 */
export function existingHandoff(handoffs: readonly CustomerHandoff[]): CustomerHandoff | undefined {
  return [...handoffs].reverse().find((h) => h.purpose === 'loyalty' && LIVE_HANDOFF.has(h.state));
}

export function FinishScreen() {
  const { t, tl } = useT();
  const navigate = useNavigate();
  const session = useKioskStore((s) => s.session);
  const bundle = useKioskStore((s) => s.bundle);
  const releaseSession = useKioskStore((s) => s.releaseSession);
  const [result, setResult] = useState<Finished | undefined>();
  const [settled, setSettled] = useState(false);
  const [seconds, setSeconds] = useState(BACK_SECONDS);
  const finished = useRef(false);

  useEffect(() => {
    if (!session || finished.current) return;
    finished.current = true;
    if (session.stage === 'done') {
      setSettled(true);
      return;
    }
    // Cerrar puede fallar. La pantalla igual celebra —la persona ya tiene sus fotos— pero la
    // sesión no puede quedarse viva en el aparato: si el cierre no responde, se reintenta y, si
    // sigue sin responder, `releaseSession` la cancela. La máquina queda libre pase lo que pase.
    const close = async (attempt = 0): Promise<void> => {
      try {
        setResult(await stationApi.finish(session.id));
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          return close(attempt + 1);
        }
        await releaseSession('finish_failed');
      }
    };
    void close().finally(() => setSettled(true));
  }, [session, releaseSession]);

  useEffect(() => {
    if (session && !settled) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [settled, session]);

  useEffect(() => {
    if (seconds <= 0) navigate(ROUTES.attract, { replace: true });
  }, [seconds, navigate]);

  const promo = useMemo(() => productViews(bundle).find((v) => v.availability.available && v.product.id !== session?.product.id && v.product.kind !== 'document'), [bundle, session?.product.id]);
  const handoffMode = featureMode(bundle?.features ?? [], 'customer.handoff');
  const delivery = featureMode(bundle?.features ?? [], 'delivery.digital');
  const existing = useMemo(() => existingHandoff(session?.handoffs ?? []), [session?.handoffs]);
  const [handoff, setHandoff] = useState<CustomerHandoff | undefined>(undefined);
  const status = useKioskStore((s) => s.status);
  const canSimulate = Boolean(status?.demoMode || session?.isDemo || import.meta.env.DEV);
  const requested = useRef(false);

  // Membresía del Club: el enlace identifica a la persona, nunca transporta la fotografía.
  // Nace en la composición, antes de que termine el render en alta, y muere con la sesión; aquí
  // sólo se recoge. Si aquel intento no llegó a existir, se pide ahora.
  useEffect(() => {
    if (handoffMode !== 'enabled' || !session || requested.current) return;
    if (existing) {
      setHandoff((current) => current ?? existing);
      return;
    }
    requested.current = true;
    void stationApi.createHandoff(session.id, 'loyalty').then(setHandoff).catch(() => undefined);
  }, [handoffMode, session, existing]);

  const simulate = async (outcome: 'link' | 'expire'): Promise<void> => {
    if (!handoff) return;
    setHandoff(await stationApi.simulateHandoff(handoff.id, outcome).catch(() => handoff));
  };
  const completion = configString(bundle, 'branding.completionMessage');
  const retention = result ? tl(result.retentionNotice) : session ? tl(session.retention.customerText) : '';
  // El cuadro del código sólo aparece cuando de verdad hay algo que escanear. Cuando no lo hay
  // —que es el recorrido anónimo normal—, el cartel lo ocupa el resultado, no un hueco vacío.
  const showsLink = handoffMode === 'enabled' && !!handoff && handoff.state !== 'unavailable';
  const resultUrl = session?.composition?.url;

  return (
    <Shell bleed hideHeader hideLang marquee={<Marquee cadence="still" />}>
      <div className="kiosk-cierre" data-stage="done" data-testid="finish">
        <div className="kiosk-cierre__cartel">
          {/* El rótulo es siempre corto y del sistema: la frase de la marca puede ser una oración
              entera y a 96 px se comería el cartel. Esa frase va abajo, donde sí cabe. */}
          <p className="kiosk-cierre__rotulo" data-testid="finish-rotulo">{t('kiosk.done.rotulo')}</p>
          <div className={showsLink ? 'kiosk-cierre__entrega' : 'kiosk-cierre__entrega kiosk-cierre__entrega--sola'}>
            {showsLink ? (
              <HandoffPanel handoff={handoff} canSimulate={canSimulate} onSimulate={(outcome) => void simulate(outcome)} />
            ) : resultUrl ? (
              <img className="kiosk-cierre__resultado" src={resultUrl} alt={t('kiosk.compose.result')} data-testid="finish-result" />
            ) : (
              <ClosingFlock />
            )}
          </div>
        </div>

        <div className="kiosk-cierre__repisa">
          {completion ? <span className="kiosk-cierre__estado" data-testid="finish-completion">{completion}</span> : null}
          {/* Con el código en el cartel, el resultado baja aquí: se ve, pero nunca debajo del QR. */}
          {showsLink && resultUrl ? <img className="kiosk-cierre__miniatura" src={resultUrl} alt={t('kiosk.compose.result')} data-testid="finish-result" /> : null}
          {/* Lo que la máquina todavía no ofrece se dice en una línea, no en una pastilla de
              estado: aquí nadie está leyendo un tablero. */}
          {!showsLink && delivery !== 'enabled' && delivery !== 'hidden' ? (
            <span className="kiosk-cierre__estado">{delivery === 'locked' ? t('kiosk.delivery.locked') : t('kiosk.delivery.coming_soon')}</span>
          ) : null}
          <ClosingFlock />
        </div>

        <div className="kiosk-cierre__alcance">
          <BigButton className="kiosk-cierre__accion" variant="primary" size="xl" block onClick={() => setSeconds(0)} data-testid="finish-home">
            {t('kiosk.done.ready_now')}
          </BigButton>
          {promo ? <span className="kiosk-cierre__estado">{t('kiosk.done.promo')}: {tl(promo.product.displayName)}</span> : null}
        </div>

        <ClosingFooter bundle={bundle}>
          {retention ? <span data-testid="finish-retention">{retention}</span> : null}
          <span>{t('kiosk.done.back_in', { seconds: Math.max(0, seconds) })}</span>
        </ClosingFooter>
      </div>
    </Shell>
  );
}

/**
 * Los seis, no tres. La marca es el conjunto de colores, y el cierre es el único momento del
 * recorrido en que se enseñan todos juntos y celebrando.
 */
export function ClosingFlock(): ReactElement {
  return (
    <div className="kiosk-cierre__familia" aria-hidden="true">
      {BLOB_VARIANTS.map((variant, i) => (
        <span key={variant} style={{ animationDelay: `${i * 0.09}s` }}>
          <BlobFace variant={variant} size={132} expression="grin" />
        </span>
      ))}
    </div>
  );
}

/**
 * El zócalo del cierre: qué máquina es, a quién se llama y qué pasa con las fotos.
 *
 * Va en tinta plena y sale del bundle, nunca del código. Es el único texto que la operación obliga
 * a leer, y por eso no se atenúa.
 */
export function ClosingFooter({ bundle, children }: { bundle: KioskBundle | undefined; children?: ReactNode }): ReactElement {
  const code = bundle?.machine.code;
  const support = configString(bundle, 'legal.supportContact') ?? bundle?.organization.support?.phone ?? bundle?.organization.support?.email;
  return (
    <div className="kiosk-cierre__zocalo">
      {code ? <span data-testid="machine-code">{code}</span> : null}
      {support ? <span data-testid="support-contact">{support}</span> : null}
      {children}
    </div>
  );
}
