/**
 * Composición: `planTemplate`/`planDocumentSheet` + `renderPlanToCanvas` con las fotos elegidas y
 * los logos del bundle (marca, anfitrión, patrocinador) → el resultado ocupando la pantalla. Sube
 * el PNG con `POST /composition`.
 *
 * Aquí ya no hay una rejilla de dos columnas con el lienzo a la izquierda y una tarjeta blanca de
 * copias a la derecha: eso es la forma de un panel de administración. El resultado es lo único que
 * se mira, debajo hay exactamente una acción, y los milímetros de papel se quedan en el recorrido
 * documental, que es donde el formato es el trámite.
 *
 * Esta pantalla conserva `SessionFrame` a propósito: el temporizador que no cancela una sesión con
 * fotografías de por medio vive ahí, y `onAutoAdvance` es lo que hace que al agotarse el tiempo la
 * composición se confirme en vez de tirarse. Eso no se toca.
 */
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { BigButton, BlobFace, BLOB_VARIANTS, Icon } from '@psp/ui';
import { featureMode } from '@psp/domain';
import type { KioskBundle } from '@psp/contracts';
import type { CanvasSources } from '@psp/imaging/browser';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { planForDocument, planForTemplate } from '../compose/plan';
import { renderPlanToCanvas } from '../compose/plan';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { configBool, configNumber, configString, resolveAssetUrl } from '../theme/assets';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${url}`));
    img.src = url;
  });
}

/**
 * Resolución de la vista previa. Es el doble de la que había: el resultado ya no vive en una
 * tarjeta de 400 px sino ocupando la pantalla, y a ese tamaño 100 ppp se ve blando. Sigue muy por
 * debajo de la resolución de impresión, que es la que bloquea el hilo al confirmar.
 */
const PREVIEW_DPI = 200;

export function ComposeScreen() {
  const { t, tl } = useT();
  const { session, product, preset, template, advance, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const locale = useKioskStore((s) => s.locale);
  const setSession = useKioskStore((s) => s.setSession);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copies, setCopies] = useState(session?.copies ?? configNumber(bundle, 'printing.defaultCopies', 1));
  const [info, setInfo] = useState<{ fitted: number; sheets: number; fallback: boolean } | undefined>();
  const [rendering, setRendering] = useState(true);
  const [saving, setSaving] = useState(false);
  const sourcesRef = useRef<CanvasSources | undefined>(undefined);

  const isDocument = product?.kind === 'document' && !!preset;
  const maxCopies = 10;

  useEffect(() => {
    if (!session || !product || !template) return;
    let active = true;
    setRendering(true);
    (async () => {
      const chosen = session.selection.length > 0 ? session.selection.map((id) => session.captures.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c) : latestCaptures(session.captures);
      const photos = await Promise.all(chosen.map((c) => loadImage(c.editedUrl ?? c.url)));
      const logos: CanvasSources['logos'] = {};
      const logoIds: Array<[keyof NonNullable<CanvasSources['logos']>, string | undefined]> = [
        ['brand', configString(bundle, 'branding.printLogoAssetId') ?? configString(bundle, 'branding.logoAssetId')],
        ['host', configString(bundle, 'branding.hostLogoAssetId')],
        ['sponsor', configString(bundle, 'branding.sponsorLogoAssetId')],
      ];
      for (const [role, id] of logoIds) {
        const url = resolveAssetUrl(bundle, id);
        if (url) logos[role] = await loadImage(url).catch(() => undefined as unknown as HTMLImageElement);
      }
      const assets: Record<string, HTMLImageElement> = {};
      for (const el of template.elements) {
        const assetId = 'assetId' in el ? el.assetId : undefined;
        const url = resolveAssetUrl(bundle, assetId);
        if (assetId && url && !assets[assetId]) assets[assetId] = await loadImage(url).catch(() => undefined as unknown as HTMLImageElement);
      }
      if (!active) return;
      sourcesRef.current = { photos, assets, logos };
      renderPreview();
    })().catch((error) => fail(error, 'composition_failed'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, template?.id]);

  const buildPlan = (dpi: number) => {
    if (!template || !product || !session) return undefined;
    const tokens = { date: new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-MX'), time: new Date().toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit' }), locationName: bundle?.location?.publicName ?? '', sessionCode: session.code, machineCode: bundle?.machine.code ?? '', userMessage: session.userMessage ?? '', campaignCode: '' };
    if (isDocument) {
      const { widthMm, heightMm } = preset.spec.physical;
      const perSheet = Math.max(1, session?.presetVersion?.spec.defaultCopies ?? 1);
      return planForDocument(template, { widthMm, heightMm }, perSheet, { cutMarks: configBool(bundle, 'printing.cutMarks', true), dpi });
    }
    return planForTemplate(template, { locale, tokens, photoCount: sourcesRef.current?.photos.length ?? 0, dpi });
  };

  const renderPreview = () => {
    const sources = sourcesRef.current;
    const canvas = canvasRef.current;
    const composed = buildPlan(PREVIEW_DPI);
    if (!sources || !canvas || !composed) return;
    renderPlanToCanvas(composed.plan, sources, canvas);
    setInfo({ fitted: composed.fitted, sheets: composed.sheets, fallback: composed.fallback });
    setRendering(false);
  };

  useEffect(() => {
    if (sourcesRef.current) renderPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copies]);

  if (!session || !product) return null;
  if (!template) {
    return (
      <SessionFrame title={t('kiosk.compose.no_template')}>
        <div className="kiosk-composicion" data-stage="compose" data-testid="compose">
          <div className="kiosk-composicion__cartel" />
          <div className="kiosk-composicion__repisa" />
          <div className="kiosk-composicion__alcance" />
          <ComposeFooter bundle={bundle} />
        </div>
      </SessionFrame>
    );
  }

  const confirm = async () => {
    const sources = sourcesRef.current;
    const composed = buildPlan(template.canvas.dpi);
    if (!sources || !composed) return;
    setSaving(true);
    // El enlace del Club nace ANTES de que termine el render en alta, no después: es instantáneo,
    // no depende de la imagen y así en el cierre nunca hay nadie mirando un cargador esperando un
    // código. El enlace identifica a la persona; la fotografía no viaja por él ni por ningún otro
    // lado. Si falla, el cierre lo vuelve a intentar: es una mejora de tiempo, no un requisito.
    const linking =
      featureMode(bundle?.features ?? [], 'customer.handoff') === 'enabled'
        ? stationApi.createHandoff(session.id, 'loyalty').catch(() => undefined)
        : undefined;
    try {
      // Componer a resolución de impresión bloquea el hilo. Ceder un cuadro antes deja que el
      // botón pinte su estado de carga; si no, el toque parece perdido y la gente toca otra vez.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = renderPlanToCanvas(composed.plan, sources);
      const updated = await stationApi.saveComposition(session.id, { imageBase64: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, copies: product.printCount > 0 ? copies : 0 });
      await linking;
      setSession(updated);
      await advance('composed');
    } catch (error) {
      setSaving(false);
      fail(error, 'composition_failed');
    }
  };

  const sheetsLabel = info ? t(info.sheets === 1 ? 'kiosk.compose.sheet_one' : 'kiosk.compose.sheets', { copies, sheets: info.sheets }) : '';

  return (
    <SessionFrame title={isDocument ? t('kiosk.compose.title') : t('kiosk.compose.result')} onAutoAdvance={() => void confirm()}>
      <div className="kiosk-composicion" data-stage="compose" data-testid="compose">
        <div className="kiosk-composicion__cartel">
          <canvas ref={canvasRef} className="kiosk-composicion__lienzo" data-testid="compose-canvas" />
          {/* Nadie mira un cargador: mientras se arma la foto, la familia trabaja. */}
          {rendering ? (
            <div className="kiosk-composicion__armando" data-testid="compose-working">
              <ComposeFlock />
              <span className="kiosk-composicion__armando-texto">{t('kiosk.compose.working')}</span>
            </div>
          ) : null}
        </div>

        <div className="kiosk-composicion__repisa">
          {product.printCount > 0 ? (
            <div className="kiosk-composicion__copias">
              <span className="kiosk-composicion__copias-label">{t('kiosk.compose.copies')}</span>
              <BigButton variant="secondary" icon={<Icon name="minus" />} disabled={copies <= 1} onClick={() => setCopies((c) => Math.max(1, c - 1))} aria-label={t('kiosk.common.previous')} />
              <span className="kiosk-composicion__copias-valor" data-testid="compose-copies">{copies}</span>
              <BigButton variant="secondary" icon={<Icon name="plus" />} disabled={copies >= maxCopies} onClick={() => setCopies((c) => Math.min(maxCopies, c + 1))} aria-label={t('kiosk.common.next')} />
            </div>
          ) : null}
          {/* Los milímetros de papel son un dato de la máquina, no de la persona. En el recorrido
              social sobran; en el documental sí importan, porque el formato es el trámite. */}
          {isDocument ? (
            <p className="kiosk-composicion__papel">
              {t('kiosk.compose.paper')}: {Math.round(template.canvas.widthMm)} × {Math.round(template.canvas.heightMm)} mm · {tl(template.name)}
              {info ? ` · ${t('kiosk.compose.per_sheet', { n: info.fitted })} · ${sheetsLabel}` : ''}
            </p>
          ) : null}
          {info?.fallback ? <p className="kiosk-composicion__aviso">{t('kiosk.compose.no_template')}</p> : null}
        </div>

        <div className="kiosk-composicion__alcance">
          <BigButton
            className="kiosk-composicion__accion"
            variant="primary"
            size="xl"
            block
            disabled={rendering}
            loading={saving}
            loadingLabel={t('kiosk.common.loading')}
            onClick={() => void confirm()}
            data-testid="compose-confirm"
          >
            {t('kiosk.compose.ok')}
          </BigButton>
        </div>

        <ComposeFooter bundle={bundle} />
      </div>
    </SessionFrame>
  );
}

/** Los seis, uno por acento: la marca es el conjunto, no un color. */
export function ComposeFlock(): ReactElement {
  return (
    <div className="kiosk-composicion__familia" aria-hidden="true">
      {BLOB_VARIANTS.map((variant, i) => (
        <span key={variant} style={{ animationDelay: `${i * 0.18}s` }}>
          <BlobFace variant={variant} size={120} expression="happy" />
        </span>
      ))}
    </div>
  );
}

/**
 * El zócalo de las pantallas de composición: qué máquina es y a quién se llama.
 *
 * No es letra chica: dos de cada tres quejas formales documentadas contra cabinas de autoservicio
 * incluyen «no pude localizar al operador». Va en tinta plena y sale del bundle, nunca del código.
 */
export function ComposeFooter({ bundle, children }: { bundle: KioskBundle | undefined; children?: ReactNode }): ReactElement {
  return (
    <div className="kiosk-composicion__zocalo">
      <MachineLine bundle={bundle} />
      {children}
    </div>
  );
}

/** Identificador corto de la máquina y canal de contacto, ambos de configuración. */
export function MachineLine({ bundle }: { bundle: KioskBundle | undefined }): ReactElement {
  const code = bundle?.machine.code;
  const support = configString(bundle, 'legal.supportContact') ?? bundle?.organization.support?.phone ?? bundle?.organization.support?.email;
  return (
    <>
      {code ? <span data-testid="machine-code">{code}</span> : null}
      {support ? <span>{support}</span> : null}
    </>
  );
}

function latestCaptures(captures: NonNullable<ReturnType<typeof useSession>['session']>['captures']) {
  const byIndex = new Map<number, (typeof captures)[number]>();
  for (const c of captures) byIndex.set(c.index, c);
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}
