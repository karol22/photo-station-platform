/**
 * PANTALLA 2 · Elegir: una habitación grande arriba y un riel de seis fichas abajo.
 *
 * Es la única pantalla de elección del recorrido social, y funde lo que antes eran dos: la lista
 * con scroll de secciones por categoría y la ficha de producto con cuatro tarjetas apiladas. El
 * recorrido canónico pide «pocas opciones grandes y claras» y las cabinas que funcionan de verdad
 * caben en tres o cuatro decisiones antes de la cámara: gastar dos pantallas y dos toques en una
 * sola decisión era el gasto más caro del recorrido.
 *
 * Se mira arriba y se toca abajo. La habitación es lo que la persona se va a llevar —su ejemplo,
 * su nombre y su precio en grande—, cambia de color entera al tocar otra ficha, y no tiene ni un
 * objetivo táctil: nada se toca a la altura de la cara. El riel enseña hasta seis fichas a la vez,
 * sin scroll, con una ya elegida, para que quien no quiera decidir nada pueda confirmar y seguir.
 *
 * La ficha completa del producto no desaparece: vive en una hoja opcional, porque la información
 * que alguien de pie pide antes de pagar (cuántas fotos, cuánto tarda, qué pasa con ellas) tiene
 * que existir, pero no puede ser el precio de entrada para todos.
 *
 * El reloj es la marquesina: los focos se van apagando y, al acabarse, la máquina vuelve a su
 * cartel. Por eso no hay botón de volver: aquí todavía no hay sesión que perder.
 *
 * Ni una cadena de negocio vive aquí: nombre, precio y avisos vienen del bundle y de i18n.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton, BlobFace, Marquee, Notice, Sheet, type BlobVariant } from '@psp/ui';
import { stationApi } from '../api/station';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { accentIndex, defaultView, finalPrice, listPrice, productViews, railViews, type ProductView } from '../lib/products';
import { ROUTES, firstWorkingStage, flowOptionsFor, screenForStage } from '../session/flow';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { configNumber, configString, resolveAssetUrl } from '../theme/assets';

/** Etapas en las que la sesión existe pero todavía no ha empezado a trabajar. */
const PRE_WORK = ['started', 'product_selected', 'configuring'];

/**
 * Los ocho radios del contenedor, en fracción del radio base.
 *
 * Un contenedor no es el personaje escalado: es una supraelipse del tamaño que pide el contenido,
 * con los mismos ocho puntos de control desplazados una fracción de lo que se desplazan en la
 * familia. La amplitud dice cuánto: alta para la habitación, baja para las fichas. El giro rota el
 * arranque del arreglo, para que dos contenedores seguidos no se vean calcados.
 */
const BASE_RADII = [1.0, 0.78, 1.12, 0.86, 1.06, 0.8, 1.14, 0.9] as const;
const BOX = 100;
const BOX_CENTER = BOX / 2;
/**
 * Radio base dentro del lienzo. Deja margen a propósito: las tangentes de la curva se salen del
 * arco que pasa por los ocho puntos, así que con el radio pegado al borde el canto se recortaría
 * justo en la parte más abombada. Con 43 aguanta hasta amplitud 1 sin tocar el borde.
 */
const BOX_RADIUS = 43;

/**
 * Curva cerrada y suave por los ocho puntos, con tangentes tipo Catmull-Rom. El lienzo es
 * cuadrado y se estira al tamaño del contenedor (`preserveAspectRatio="none"`), que es justo lo
 * que quiere decir «del tamaño que pide el contenido».
 */
export function blobBoxPath(amplitude: number, spin = 0): string {
  const n = BASE_RADII.length;
  const points = Array.from({ length: n }, (_unused, i) => {
    const base = BASE_RADII[(i + spin) % n] ?? 1;
    const radius = BOX_RADIUS * (1 + amplitude * (base - 1));
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: BOX_CENTER + Math.cos(angle) * radius, y: BOX_CENTER + Math.sin(angle) * radius };
  });
  const at = (i: number) => points[((i % n) + n) % n]!;
  let d = `M${at(0).x.toFixed(2)} ${at(0).y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += `C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)}`;
    d += ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)}`;
    d += ` ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Amplitudes del plan: la habitación se nota curva, la ficha apenas. */
const ROOM_AMPLITUDE = 0.45;
const TILE_AMPLITUDE = 0.3;

export interface ChooseScreenProps {
  /** Producto que llega elegido por la ruta (recuperación de sesión tras una recarga). */
  initialProductId?: string | undefined;
}

export function ChooseScreen({ initialProductId }: ChooseScreenProps) {
  const { t, tl, money } = useT();
  const navigate = useNavigate();
  const bundle = useKioskStore((s) => s.bundle);
  const status = useKioskStore((s) => s.status);
  const locale = useKioskStore((s) => s.locale);
  const setSession = useKioskStore((s) => s.setSession);
  const session = useKioskStore((s) => s.session);
  const { fail } = useSession();

  const views = useMemo(() => productViews(bundle), [bundle]);
  const rail = useMemo(() => railViews(views), [views]);
  const [pickedId, setPickedId] = useState<string | undefined>(initialProductId);
  const [accessible, setAccessible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [starting, setStarting] = useState(false);

  const selected = useMemo(() => defaultView(rail, pickedId), [rail, pickedId]);
  const position = selected ? rail.findIndex((v) => v.product.id === selected.product.id) : 0;
  const accent = accentIndex(Math.max(0, position));

  // El único cronómetro de esta pantalla son los focos apagándose. Al acabarse, la máquina vuelve
  // a llamar desde el pasillo: aquí todavía no hay dinero ni fotografías que perder.
  const budget = configNumber(bundle, 'timing.idleTimeoutSec', 60);
  const remaining = useBudget(budget, useCallback(() => navigate(ROUTES.attract), [navigate]));

  const start = async () => {
    if (!selected || !selected.availability.available) return;
    const { product } = selected;
    setStarting(true);
    try {
      // Con una sesión ya abierta para este mismo producto (recarga a media elección), se sigue con
      // ella: abrir otra dejaría la máquina ocupada por una sesión que nadie va a terminar.
      const reuse = session && PRE_WORK.includes(session.stage) && session.product.id === product.id ? session : undefined;
      const created = reuse ?? (await stationApi.createSession({ productId: product.id, locale, isDemo: status?.demoMode ?? false, accessible }));
      const flow = flowOptionsFor({ product: created.product, bundle, status, session: created });
      const stage = firstWorkingStage(created.product, flow);
      const advanced = created.stage === stage ? created : await stationApi.advanceStage(created.id, stage, 'product_start');
      setSession(advanced);
      navigate(screenForStage(advanced.stage, advanced.product));
    } catch (error) {
      setStarting(false);
      fail(error);
    }
  };

  if (views.length === 0 || !selected) {
    return (
      <Shell bleed marquee={<Marquee cadence="still" />} hideHeader hideLang>
        <div className="kiosk-elegir kiosk-elegir--vacia" data-testid="choose">
          <Notice tone="warn" position="static" title={t('kiosk.home.empty')}>
            {t('kiosk.home.empty_hint')}
          </Notice>
        </div>
      </Shell>
    );
  }

  const { product, availability } = selected;
  const final = finalPrice(selected);
  const list = listPrice(selected);
  const example = resolveAssetUrl(bundle, product.coverAssetId);
  const footerText = configString(bundle, 'branding.footerText');
  const reason = availability.reasons[0];
  const stateText = availability.available
    ? undefined
    : reason
      ? t(`kiosk.product.motivo.${reason}`)
      : t('kiosk.home.unavailable');

  return (
    <Shell bleed marquee={<Marquee cadence="wait" remaining={remaining} />} hideHeader hideLang>
      <div className="kiosk-elegir" data-room={accent} data-testid="choose">
        {/* CARTEL: la habitación. Se mira, no se toca. */}
        <div className="kiosk-elegir__cartel">
          <h1 className="kiosk-elegir__titulo">{t('kiosk.choose.title')}</h1>
          {/* La clave reinicia la entrada: cambiar de ficha se ve como que entra otra habitación. */}
          <Room key={product.id} accent={accent}>
            <div className="kiosk-elegir__ejemplo">
              {example ? (
                <img src={example} alt={t('kiosk.product.example')} />
              ) : (
                <BlobFace variant={accent as BlobVariant} size={320} animated />
              )}
            </div>
            <span className="kiosk-elegir__nombre">{tl(product.displayName)}</span>
            {stateText ? (
              <span className="kiosk-elegir__estado" data-testid="choose-unavailable">
                {stateText}
              </span>
            ) : (
              <span className="kiosk-elegir__precio" data-testid="choose-price">
                {final.amount === 0 ? t('kiosk.common.free') : money(final)}
                {list.amount > final.amount ? <s className="kiosk-elegir__antes">{money(list)}</s> : null}
              </span>
            )}
          </Room>
        </div>

        {/* REPISA: el riel. Seis a la vez, sin scroll, una ya elegida. */}
        <div className="kiosk-elegir__repisa" role="group" aria-label={t('kiosk.choose.rail')}>
          {rail.map((view, i) => (
            <RailTile
              key={view.product.id}
              view={view}
              accent={accentIndex(i)}
              active={view.product.id === product.id}
              label={tl(view.product.displayName)}
              cover={resolveAssetUrl(bundle, view.product.coverAssetId)}
              onPick={() => setPickedId(view.product.id)}
            />
          ))}
        </div>

        {/* ALCANCE: una acción primaria y, debajo, lo opcional en letra de a pie. */}
        <div className="kiosk-elegir__alcance">
          <button
            type="button"
            className="kiosk-elegir__cta"
            disabled={!availability.available || starting}
            onClick={() => void start()}
            data-testid="product-start"
          >
            {starting ? t('kiosk.common.loading') : t('kiosk.choose.confirm')}
          </button>
          <div className="kiosk-elegir__secundarias">
            <button type="button" className="kiosk-elegir__enlace" onClick={() => setShowDetails(true)} data-testid="choose-details">
              {t('kiosk.choose.details')}
            </button>
            <button
              type="button"
              className="kiosk-elegir__enlace"
              aria-pressed={accessible}
              onClick={() => setAccessible((v) => !v)}
              data-testid="choose-more-time"
            >
              {accessible ? t('kiosk.home.more_time_on') : t('kiosk.home.more_time')}
            </button>
          </div>
        </div>

        {/* ZÓCALO: lo que la operación obliga a decir, en tinta plena y fuera del camino. */}
        <div className="kiosk-elegir__zocalo">
          <span>{t('kiosk.attract.privacy_short')}</span>
          {footerText ? <span>{footerText}</span> : null}
        </div>
      </div>

      <DetailsSheet open={showDetails} onClose={() => setShowDetails(false)} view={selected} />
    </Shell>
  );
}

/** La habitación: el contenedor de curva completa, con su relieve duro debajo. */
function Room({ accent, children }: { accent: number; children: ReactNode }) {
  const path = useMemo(() => blobBoxPath(ROOM_AMPLITUDE, accent), [accent]);
  return (
    <div className="kiosk-elegir__habitacion">
      <svg className="kiosk-elegir__blob kiosk-elegir__blob--sombra" viewBox={`0 0 ${BOX} ${BOX}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
      <svg className="kiosk-elegir__blob" viewBox={`0 0 ${BOX} ${BOX}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
      <div className="kiosk-elegir__contenido">{children}</div>
    </div>
  );
}

/**
 * Una ficha del riel. Lleva dentro el ejemplo del producto recortado con su propia curva: seis
 * manchas de color sin nada dentro no dicen qué es cada cosa, y leer seis nombres de pie a metro y
 * medio tampoco. Lo que se reconoce a esa distancia es la foto que uno se va a llevar.
 */
function RailTile({
  view,
  accent,
  active,
  label,
  cover,
  onPick,
}: {
  view: ProductView;
  accent: number;
  active: boolean;
  label: string;
  cover: string | undefined;
  onPick: () => void;
}) {
  const clipId = useId();
  const path = useMemo(() => blobBoxPath(TILE_AMPLITUDE, accent + 3), [accent]);
  return (
    <button
      type="button"
      className="kiosk-elegir__ficha"
      data-accent={accent}
      data-active={active ? 'true' : undefined}
      data-state={view.availability.available ? undefined : 'off'}
      aria-pressed={active}
      aria-label={label}
      onClick={onPick}
      data-testid={`product-${view.product.id}`}
    >
      <svg className="kiosk-elegir__ficha-blob" viewBox={`0 0 ${BOX} ${BOX}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path d={path} />
          </clipPath>
        </defs>
        <path className="kiosk-elegir__ficha-campo" d={path} />
        {cover ? <image href={cover} x="0" y="0" width={BOX} height={BOX} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} /> : null}
        <path className="kiosk-elegir__ficha-canto" d={path} />
      </svg>
      {cover ? null : <BlobFace variant={accent as BlobVariant} size={96} className="kiosk-elegir__ficha-cara" />}
    </button>
  );
}

/**
 * La ficha completa del producto (requisito 4.3), en una hoja a pantalla completa.
 *
 * Sigue estando todo: ejemplo, descripción, qué recibes, capturas, impresiones, formato, tiempo,
 * precio, restricciones, privacidad, retención, requisitos documentales y disponibilidad. Lo que
 * cambia es que ya no es un peaje: quien no la abre no se pierde nada que necesite para decidir.
 */
function DetailsSheet({ open, onClose, view }: { open: boolean; onClose: () => void; view: ProductView }) {
  const { t, tl, money, duration } = useT();
  const bundle = useKioskStore((s) => s.bundle);
  const { product, availability } = view;
  const final = finalPrice(view);
  const list = listPrice(view);
  const preset = product.presetId ? bundle?.presets.find((p) => p.id === product.presetId) : undefined;
  const presetVersion = product.presetId ? bundle?.presetVersions.find((p) => p.presetId === product.presetId) : undefined;
  const template = bundle?.templates.find((tpl) => tpl.id === product.output.templateId);
  const retentionId = product.retentionPolicyId ?? configString(bundle, 'privacy.defaultRetentionPolicyId');
  const retention = bundle?.retentionPolicies.find((r) => r.id === retentionId);
  const businessMode = configString(bundle, 'payment.businessMode') ?? 'paid';

  const rows: Array<[string, string]> = [
    [t('kiosk.choose.category'), t(`kiosk.category.${product.category}`)],
    [t('kiosk.product.captures'), product.captureCount === 1 ? t('kiosk.common.photo_one') : t('kiosk.common.photos_n', { n: product.captureCount })],
    [t('kiosk.product.prints'), product.printCount === 0 ? t('kiosk.common.no_prints') : product.printCount === 1 ? t('kiosk.common.print_one') : t('kiosk.common.prints_n', { n: product.printCount })],
    [t('kiosk.product.format'), `${t(`kiosk.paper.${product.output.paperSize}`)}${template ? ` · ${tl(template.name)}` : ''}`],
    [t('kiosk.product.duration'), duration(product.estimatedDurationSec)],
    [t('kiosk.product.price'), final.amount === 0 ? t('kiosk.common.free') : `${money(final)}${list.amount > final.amount ? ` (${money(list)})` : ''}`],
    [t('kiosk.product.availability'), availability.available ? t('kiosk.product.available') : availability.reasons[0] ? t(`kiosk.product.motivo.${availability.reasons[0]}`) : t('kiosk.home.unavailable')],
  ];

  return (
    <Sheet
      open={open}
      title={tl(product.displayName)}
      onClose={onClose}
      closeLabel={t('kiosk.common.close')}
      size="full"
      actions={
        <BigButton variant="primary" size="xl" onClick={onClose}>
          {t('kiosk.common.ok')}
        </BigButton>
      }
      data-testid="choose-details-sheet"
    >
      <div className="kiosk-elegir__ficha-larga">
        <p className="kiosk-lead">{tl(product.description)}</p>
        <h2>{t('kiosk.product.what_you_get')}</h2>
        <p>{tl(product.whatYouGet)}</p>
        <ul className="kiosk-list">
          {rows.map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
        {preset || presetVersion ? (
          <>
            <h2>{t('kiosk.product.requirements')}</h2>
            {preset ? <p><strong>{tl(preset.name)}</strong></p> : null}
            {presetVersion ? <p>{tl(presetVersion.spec.customerInstructions)}</p> : null}
            {presetVersion?.spec.attire ? <p>{tl(presetVersion.spec.attire)}</p> : null}
            <p className="kiosk-small">{preset?.acceptanceDisclaimer ? tl(preset.acceptanceDisclaimer) : t('kiosk.product.disclaimer')}</p>
          </>
        ) : null}
        {product.restrictions ? (
          <>
            <h2>{t('kiosk.product.restrictions')}</h2>
            <p>{tl(product.restrictions)}</p>
          </>
        ) : null}
        <h2>{t('kiosk.product.privacy')}</h2>
        <p>{product.privacyNote ? tl(product.privacyNote) : t('kiosk.attract.privacy_short')}</p>
        {retention ? (
          <p className="kiosk-small">
            <strong>{t('kiosk.product.retention')}:</strong> {tl(retention.customerText)}
          </p>
        ) : null}
        {businessMode !== 'paid' ? <p className="kiosk-small">{t(`kiosk.business.${businessMode}`)}</p> : null}
      </div>
    </Sheet>
  );
}

/**
 * El presupuesto de la pantalla, en fracción de 1. Cualquier toque lo devuelve al principio: quien
 * está decidiendo no está inactivo. Al agotarse, quien decide es la máquina.
 */
function useBudget(seconds: number, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(1);
  const deadline = useRef(Date.now() + seconds * 1000);
  const expired = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    const reset = () => {
      deadline.current = Date.now() + seconds * 1000;
      setRemaining(1);
    };
    reset();
    for (const event of ['pointerdown', 'keydown'] as const) document.addEventListener(event, reset, { passive: true });
    const timer = setInterval(() => {
      const left = Math.max(0, (deadline.current - Date.now()) / (seconds * 1000));
      setRemaining(left);
      if (left <= 0 && !expired.current) {
        expired.current = true;
        expire.current();
      }
    }, 500);
    return () => {
      for (const event of ['pointerdown', 'keydown'] as const) document.removeEventListener(event, reset);
      clearInterval(timer);
    };
  }, [seconds]);

  return remaining;
}

export function HomeScreen() {
  return <ChooseScreen />;
}
