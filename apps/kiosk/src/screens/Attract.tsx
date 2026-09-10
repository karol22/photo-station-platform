/**
 * Atracción: la pantalla que la plaza ve el noventa por ciento del tiempo.
 *
 * No es un salvapantallas ni el estado de reposo de una aplicación: es el cartel de la cabina, y
 * su único trabajo es que alguien que va caminando por un pasillo se detenga. Compite con tiendas
 * iluminadas y con máquinas que suenan, así que va a sangre, en color pleno, con algo moviéndose
 * siempre y sin un solo contenedor.
 *
 * El bucle tiene cinco compases y corta seco entre ellos, porque desde el pasillo se percibe
 * antes «cambió de color» que «cambió de contenido». El compás más fuerte y el más barato es el
 * espejo: la cámara ya está dentro y verse a uno mismo es el imán que ninguna pantalla de video
 * puede igualar. Ese compás entra en cuanto la cámara ve a alguien, y el video se apaga cuando no
 * hay nadie, para no tener la cámara encendida mirando un pasillo vacío.
 *
 * Ni una cadena de negocio vive aquí: el nombre, el precio y los avisos vienen del bundle y de
 * i18n, y los colores salen de los acentos de la marca.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlobFace, BLOB_VARIANTS, Marquee, Notice, StatusPill, type BlobVariant } from '@psp/ui';
import { CameraView } from '../components/CameraView';
import { Shell } from '../components/Shell';
import { useCamera, useFrameLoop } from '../camera/useCamera';
import { useT } from '../i18n';
import { minPrice, productViews } from '../lib/products';
import { ROUTES } from '../session/flow';
import { useKioskStore } from '../store';
import { configBool, configNumber, configString, type ConfigSource } from '../theme/assets';

/** Los cinco compases del bucle, con su duración en segundos. */
export const ATTRACT_BEATS = [
  { key: 'mirror', seconds: 12 },
  { key: 'price', seconds: 6 },
  { key: 'wall', seconds: 11 },
  { key: 'howto', seconds: 9 },
  { key: 'invite', seconds: 8 },
] as const;

/** Cuánto aguanta sin ver a nadie antes de dar por vacío el pasillo. */
const ABSENCE_MS = 8000;
/** Cuánto tiene que verse un rostro para creer que alguien llegó, y no que pasó una sombra. */
const PRESENCE_MS = 400;

export function AttractScreen() {
  const { t, tl, money } = useT();
  const navigate = useNavigate();
  const bundle = useKioskStore((s) => s.bundle);
  const status = useKioskStore((s) => s.status);
  const releaseSession = useKioskStore((s) => s.releaseSession);
  const pendingRelease = useKioskStore((s) => s.pendingRelease);
  const [beat, setBeat] = useState(0);
  const [present, setPresent] = useState(false);

  const views = useMemo(() => productViews(bundle), [bundle]);
  const from = minPrice(views);
  const showPrices = configBool(bundle, 'kiosk.showPricesOnIdle', true);
  const printerReady = (status?.printers ?? []).some((p) => p.status === 'ready' || p.status === 'busy');
  const outOfService = status?.status === 'out_of_service' || status?.status === 'suspended' || status?.status === 'retired';
  const maintenance = status?.maintenance.on === true;
  const publicName = configString(bundle, 'branding.publicName') ?? bundle?.organization.name ?? '';
  const footerText = configString(bundle, 'branding.footerText');
  const shortest = views
    .filter((v) => v.availability.available)
    .map((v) => v.product.estimatedDurationSec)
    .sort((a, b) => a - b)[0];

  const releasing = !!pendingRelease;
  const blocked = outOfService || maintenance || !bundle || releasing;

  useEffect(() => {
    // Volver a atracción cierra la sesión anterior EN EL APARATO, no sólo en la pantalla.
    void releaseSession('returned_to_attract');
  }, [releaseSession]);

  useEffect(() => {
    if (!pendingRelease) return;
    const timer = setInterval(() => void releaseSession('release_retry'), 2500);
    return () => clearInterval(timer);
  }, [pendingRelease, releaseSession]);

  const current = ATTRACT_BEATS[beat] ?? ATTRACT_BEATS[0]!;

  useEffect(() => {
    if (blocked) return;
    const timer = setTimeout(() => setBeat((b) => (b + 1) % ATTRACT_BEATS.length), current.seconds * 1000);
    return () => clearTimeout(timer);
  }, [beat, blocked, current.seconds]);

  // Enseñar un pasillo vacío no atrae a nadie: sin gente delante, el espejo se salta.
  useEffect(() => {
    if (current.key === 'mirror' && !present) setBeat((b) => (b + 1) % ATTRACT_BEATS.length);
  }, [current.key, present]);

  // La cámara vive sólo mientras se necesita.
  const wantsCamera = !blocked && (current.key === 'mirror' || present);
  const camera = useCamera(wantsCamera);
  const lastFace = useRef(0);
  const since = useRef(0);

  useFrameLoop(
    camera.source,
    camera.analyzer,
    (frame) => {
      const now = frame.atMs;
      if (frame.faces.length > 0) {
        if (since.current === 0) since.current = now;
        lastFace.current = now;
        if (now - since.current >= PRESENCE_MS) setPresent(true);
        return;
      }
      since.current = 0;
      if (lastFace.current > 0 && now - lastFace.current > ABSENCE_MS) setPresent(false);
    },
    camera.phase === 'ready',
  );

  // Alguien llegó: lo primero que ve es su propia cara.
  useEffect(() => {
    if (present) setBeat(0);
  }, [present]);

  const blockedTitle = releasing
    ? t('kiosk.attract.releasing')
    : maintenance
      ? t('kiosk.attract.maintenance')
      : outOfService
        ? t('kiosk.attract.out_of_service')
        : t('kiosk.attract.no_bundle');
  const blockedText = releasing
    ? t('kiosk.attract.releasing_text')
    : maintenance
      ? status?.maintenance.message || t('kiosk.attract.maintenance_text')
      : outOfService
        ? t('kiosk.attract.out_of_service_text')
        : t('kiosk.attract.no_bundle_text');

  if (blocked) {
    return (
      <Shell bleed marquee={<Marquee cadence="still" />} hideHeader hideLang>
        <div className="kiosk-attract kiosk-attract--blocked" data-testid="attract">
          <Notice tone={maintenance || releasing ? 'info' : 'warn'} position="static" title={blockedTitle}>
            {blockedText}
          </Notice>
        </div>
      </Shell>
    );
  }

  return (
    <Shell bleed marquee={<Marquee cadence="call" />} hideHeader hideLang>
      {/* Toda la pantalla es el objetivo táctil: quien llega no busca un botón, toca donde sea. */}
      <button
        type="button"
        className="kiosk-attract"
        data-beat={current.key}
        data-testid="attract"
        aria-label={t('kiosk.attract.cta')}
        onClick={() => navigate(ROUTES.home)}
      >
        <div className="kiosk-attract__cartel">
          {current.key === 'mirror' ? (
            <div className="kiosk-attract__mirror">
              <CameraView source={camera.source} loadingLabel={t('kiosk.attract.loading')} />
              <LensEyes bundle={bundle} />
            </div>
          ) : null}

          {current.key === 'price' && showPrices && from ? (
            <div className="kiosk-attract__price">
              <span className="kiosk-attract__numeral" data-testid="attract-price">{money(from)}</span>
              {shortest ? <span className="kiosk-attract__aside">{t('kiosk.common.minutes_approx', { minutes: Math.round(shortest / 60) })}</span> : null}
              {/* Seis formas mirando hacia el precio dicen «mira el precio» en cualquier idioma. */}
              <div className="kiosk-attract__flock" aria-hidden="true">
                {BLOB_VARIANTS.map((variant, i) => (
                  <BlobFace
                    key={variant}
                    variant={variant}
                    size={120}
                    expression="curious"
                    mood="curious"
                    gaze={{ x: (i - 2.5) / 2.5, y: -1 }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {current.key === 'wall' ? <ResultWall count={views.filter((v) => v.availability.available).length} /> : null}

          {current.key === 'howto' ? (
            <div className="kiosk-attract__howto" aria-hidden="true">
              {/* Tres formas actuando los tres pasos. Sin una palabra: se entiende mirando. */}
              {([1, 3, 5] as BlobVariant[]).map((variant, i) => (
                <div key={variant} className="kiosk-attract__step" style={{ animationDelay: `${i * 0.4}s` }}>
                  {/* Tres gestos distintos cuentan los tres pasos: uno explica, otro se asoma,
                      el último celebra. Es el tutorial entero, sin una palabra que traducir. */}
                  <BlobFace
                    variant={variant}
                    size={200}
                    expression={i === 2 ? 'grin' : 'happy'}
                    mood={i === 0 ? 'talk' : i === 1 ? 'curious' : 'excited'}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {current.key === 'invite' ? (
            <div className="kiosk-attract__invite">
              <span className="kiosk-attract__rotulo">{publicName}</span>
              <div className="kiosk-attract__flock" aria-hidden="true">
                {BLOB_VARIANTS.map((variant, i) => (
                  <BlobFace key={variant} variant={variant} size={132} mood="excited" gaze={{ x: (i - 2.5) / 5, y: 1 }} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="kiosk-attract__repisa">
          {showPrices && from && current.key !== 'price' ? (
            <span className="kiosk-attract__desde">{t('kiosk.attract.from_price', { price: money(from) })}</span>
          ) : null}
        </div>

        <div className="kiosk-attract__alcance">
          <span className="kiosk-attract__cta">{t('kiosk.attract.cta')}</span>
        </div>

        <div className="kiosk-attract__zocalo">
          <span>{t('kiosk.attract.privacy_short')}</span>
          {configBool(bundle, 'kiosk.surveillanceNotice') ? <span>{t('kiosk.attract.surveillance')}</span> : null}
          {footerText ? <span>{footerText}</span> : null}
          {!printerReady ? <StatusPill tone="warn">{t('kiosk.attract.print_unavailable')}</StatusPill> : null}
          {(status?.notices ?? []).map((n) => (
            <StatusPill key={n.code} tone={n.kind === 'error' ? 'danger' : n.kind === 'warning' ? 'warn' : 'info'}>
              {tl(n.message)}
            </StatusPill>
          ))}
        </div>
      </button>
    </Shell>
  );
}

/**
 * Los ojos del lente: el elemento por el que esta pantalla se recuerda.
 *
 * Nadie mira al lente, porque nadie sabe dónde está: mira su propia cara, que es lo que la
 * pantalla le enseña. Dos ojos de la familia, quietos exactamente donde está la cámara física,
 * resuelven eso sin letrero y sin idioma. Son lo único que se puede poner encima del espejo.
 *
 * El sitio del lente cambia con el modelo de aparato, así que llega por configuración.
 */
function LensEyes({ bundle }: { bundle: ConfigSource | undefined }) {
  const x = configNumber(bundle, 'kiosk.lens.offsetX', 50);
  const y = configNumber(bundle, 'kiosk.lens.offsetY', 6);
  return (
    <div className="kiosk-lens" style={{ left: `${x}%`, top: `${Math.max(3, y)}%` }} aria-hidden="true">
      <span className="kiosk-lens__eye" />
      <span className="kiosk-lens__eye" />
    </div>
  );
}

/** El muro: fichas cayendo, una por acento. Lo que la persona se lleva, en el idioma de la marca. */
function ResultWall({ count }: { count: number }) {
  const tiles = Math.max(4, Math.min(6, count || 6));
  return (
    <div className="kiosk-attract__wall" aria-hidden="true">
      {Array.from({ length: tiles }, (_unused, i) => (
        <div
          key={i}
          className="kiosk-attract__tile"
          style={{ animationDelay: `${i * 0.24}s`, ['--psp-tile' as string]: `var(--psp-color-accent-${(i % 6) + 1})` }}
        >
          {/* La forma nunca lleva el color de su propia ficha: sobre sí misma desaparece y sólo
              quedarían los ojos flotando. Se desplaza tres puestos, que es media vuelta a la
              paleta y garantiza contraste venga la marca que venga. */}
          <BlobFace variant={(((i + 3) % 6) + 1) as BlobVariant} size={140} mood="idle" />
        </div>
      ))}
    </div>
  );
}
