/**
 * Composición: `planTemplate`/`planDocumentSheet` + `renderPlanToCanvas` con las fotos elegidas y
 * los logos del bundle (marca, anfitrión, patrocinador) → vista previa del resultado físico con
 * tamaño en mm, copias y hojas. Sube el PNG con `POST /composition`.
 */
import { useEffect, useRef, useState } from 'react';
import { BigButton, Icon, Notice, Spinner } from '@psp/ui';
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

const PREVIEW_DPI = 100;

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
      <SessionFrame title={t('kiosk.compose.title')}>
        <Notice tone="warn" position="static">{t('kiosk.compose.no_template')}</Notice>
      </SessionFrame>
    );
  }

  const confirm = async () => {
    const sources = sourcesRef.current;
    const composed = buildPlan(template.canvas.dpi);
    if (!sources || !composed) return;
    setSaving(true);
    try {
      const canvas = renderPlanToCanvas(composed.plan, sources);
      const updated = await stationApi.saveComposition(session.id, { imageBase64: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, copies: product.printCount > 0 ? copies : 0 });
      setSession(updated);
      await advance('composed');
    } catch (error) {
      setSaving(false);
      fail(error, 'composition_failed');
    }
  };

  const sheetsLabel = info ? t(info.sheets === 1 ? 'kiosk.compose.sheet_one' : 'kiosk.compose.sheets', { copies, sheets: info.sheets }) : '';

  return (
    <SessionFrame title={t('kiosk.compose.title')}>
      <div className="kiosk-edit">
        <div className="kiosk-stack">
          <div className="kiosk-preview" style={{ position: 'relative' }}>
            <canvas ref={canvasRef} data-testid="compose-canvas" style={{ maxWidth: '100%', maxHeight: '55vh', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }} />
            {rendering ? <Spinner size="xl" label={t('kiosk.compose.rendering')} /> : null}
          </div>
          <p className="kiosk-small kiosk-muted">
            {t('kiosk.compose.paper')}: {Math.round(template.canvas.widthMm)} × {Math.round(template.canvas.heightMm)} mm · {tl(template.name)}
          </p>
          {info?.fallback ? <Notice tone="warn" position="static">{t('kiosk.compose.no_template')}</Notice> : null}
        </div>
        <div className="kiosk-stack">
          {product.printCount > 0 ? (
            <div className="kiosk-card kiosk-stack">
              <p className="kiosk-lead" style={{ margin: 0 }}>{t('kiosk.compose.copies')}</p>
              <div className="kiosk-row" style={{ justifyContent: 'center' }}>
                <BigButton variant="secondary" icon={<Icon name="minus" />} disabled={copies <= 1} onClick={() => setCopies((c) => Math.max(1, c - 1))} aria-label={t('kiosk.common.previous')} />
                <span style={{ fontSize: '2.4rem', minWidth: '2.5em', textAlign: 'center' }} data-testid="compose-copies">{copies}</span>
                <BigButton variant="secondary" icon={<Icon name="plus" />} disabled={copies >= maxCopies} onClick={() => setCopies((c) => Math.min(maxCopies, c + 1))} aria-label={t('kiosk.common.next')} />
              </div>
              {info && isDocument ? <p className="kiosk-small">{t('kiosk.compose.per_sheet', { n: info.fitted })} · {sheetsLabel}</p> : null}
            </div>
          ) : null}
          <BigButton variant="primary" size="xl" block icon={<Icon name="check" />} disabled={rendering} loading={saving} loadingLabel={t('kiosk.common.loading')} onClick={() => void confirm()} data-testid="compose-confirm">
            {t('kiosk.compose.confirm')}
          </BigButton>
        </div>
      </div>
    </SessionFrame>
  );
}

function latestCaptures(captures: NonNullable<ReturnType<typeof useSession>['session']>['captures']) {
  const byIndex = new Map<number, (typeof captures)[number]>();
  for (const c of captures) byIndex.set(c.index, c);
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}
