/**
 * Edición: sólo las herramientas de `product.editing.allowedTools` (documental = lista segura del
 * preset). Sliders táctiles, toggles, rotación fina, presets permitidos, marcos/stickers de la
 * experiencia; deshacer/rehacer/restaurar/antes-después. Aplica con `applyEditOps` sobre el raster
 * y sube `resultBase64`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditOp, EditingTool } from '@psp/contracts';
import { EDIT_OPS, applyEditOps, editingPresetToOps, validateEditOps, type EditOpKey, type Raster } from '@psp/imaging';
import { canvasToRaster, loadRaster, rasterToCanvas, rasterToDataUrl } from '@psp/imaging/browser';
import { BigButton, Icon, IconButton, Spinner, Toggle, TouchSlider } from '@psp/ui';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { resolveAssetUrl } from '../theme/assets';

type SliderKey = 'brightness' | 'contrast' | 'exposure' | 'saturation' | 'temperature';
const SLIDERS: Array<{ key: SliderKey; param: string; min: number; max: number; step: number }> = [
  { key: 'brightness', param: 'amount', min: -1, max: 1, step: 0.05 },
  { key: 'contrast', param: 'amount', min: -1, max: 1, step: 0.05 },
  { key: 'exposure', param: 'stops', min: -2, max: 2, step: 0.1 },
  { key: 'saturation', param: 'amount', min: -1, max: 1, step: 0.05 },
  { key: 'temperature', param: 'amount', min: -1, max: 1, step: 0.05 },
];

const PREVIEW_MAX = 900;

export function EditScreen() {
  const { t, tl } = useT();
  const { session, product, experience, advance, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const setSession = useKioskStore((s) => s.setSession);
  const [captureIndex, setCaptureIndex] = useState(0);
  const [original, setOriginal] = useState<Raster | undefined>();
  const [history, setHistory] = useState<EditOp[][]>([[]]);
  const [cursor, setCursor] = useState(0);
  const [preview, setPreview] = useState<string | undefined>();
  const [showBefore, setShowBefore] = useState(false);
  const [saving, setSaving] = useState(false);
  const assets = useRef<Record<string, Raster>>({});

  const captures = useMemo(() => {
    if (!session) return [];
    const byIndex = new Map<number, (typeof session.captures)[number]>();
    for (const c of session.captures) byIndex.set(c.index, c);
    const list = [...byIndex.values()].sort((a, b) => a.index - b.index);
    return session.selection.length > 0 ? list.filter((c) => session.selection.includes(c.id)) : list;
  }, [session]);
  const capture = captures[captureIndex];
  const ops = history[cursor] ?? [];
  const allowed: EditingTool[] = product?.editing.allowedTools ?? [];
  const isDocument = product?.kind === 'document';
  const presets = useMemo(
    () => (bundle?.editingPresets ?? []).filter((p) => (product?.editing.allowedPresetIds.length ? product.editing.allowedPresetIds.includes(p.id) : true) && (!isDocument || p.documentSafe)),
    [bundle?.editingPresets, product?.editing.allowedPresetIds, isDocument],
  );
  const presetMap = useMemo(() => Object.fromEntries(presets.map((p) => [p.id, p])), [presets]);
  const frames = !isDocument && allowed.includes('frames') ? experience?.frameAssetIds ?? [] : [];
  const stickers = !isDocument && allowed.includes('stickers') ? experience?.stickerAssetIds ?? [] : [];

  useEffect(() => {
    if (!capture) return;
    let active = true;
    setOriginal(undefined);
    setPreview(undefined);
    setHistory([session?.edits[capture.id] ?? []]);
    setCursor(0);
    loadRaster(capture.url)
      .then((raster) => {
        if (active) setOriginal(raster);
      })
      .catch((error) => fail(error, 'edit_failed'));
    return () => {
      active = false;
    };
    // Recarga sólo cuando cambia la captura elegida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture?.id]);

  useEffect(() => {
    if (!original) return;
    let active = true;
    (async () => {
      for (const id of [...frames, ...stickers]) {
        if (assets.current[id]) continue;
        const url = resolveAssetUrl(bundle, id);
        if (!url) continue;
        try {
          assets.current[id] = await loadRaster(url);
        } catch {
          // Un activo que no carga simplemente no se ofrece.
        }
      }
      if (!active) return;
      const scale = Math.min(1, PREVIEW_MAX / Math.max(original.width, original.height));
      const base = scale < 1 ? downscale(original, scale) : original;
      const result = applyEditOps(base, scaleOps(ops, scale), { assets: assets.current, presets: presetMap });
      if (active) setPreview(rasterToDataUrl(result, 'image/jpeg', 0.9));
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [original, ops, frames, stickers, bundle, presetMap]);

  if (!session || !product) return null;

  const push = (next: EditOp[]) => {
    const valid = validateEditOps(next, allowed);
    const kept = next.filter((op) => !valid.rejected.includes(op));
    setHistory([...history.slice(0, cursor + 1), kept]);
    setCursor(cursor + 1);
  };
  const setParam = (key: EditOpKey, param: string, value: number) => {
    const others = ops.filter((o) => o.op !== key);
    push(value === 0 ? others : [...others, { op: key, params: { [param]: value } }]);
  };
  const valueOf = (key: EditOpKey, param: string): number => {
    const raw = ops.find((o) => o.op === key)?.params[param];
    return typeof raw === 'number' ? raw : 0;
  };
  const toggleFlag = (key: EditOpKey) => {
    push(ops.some((o) => o.op === key) ? ops.filter((o) => o.op !== key) : [...ops, { op: key, params: {} }]);
  };
  const applyPreset = (presetId: string) => {
    const preset = presetMap[presetId];
    if (!preset) return;
    push([...ops.filter((o) => o.op !== 'preset'), ...editingPresetToOps(preset)]);
  };
  const setOverlay = (key: 'frame' | 'sticker', assetId: string | undefined) => {
    const others = ops.filter((o) => o.op !== key);
    push(assetId ? [...others, { op: key, params: key === 'frame' ? { assetId } : { assetId, x: Math.round((original?.width ?? 0) * 0.65), y: Math.round((original?.height ?? 0) * 0.65) } }] : others);
  };

  const save = async () => {
    if (!capture || !original) return;
    setSaving(true);
    try {
      const result = applyEditOps(original, ops, { assets: assets.current, presets: presetMap });
      const toolsUsed = [...new Set(ops.map((o) => (o.op in EDIT_OPS ? EDIT_OPS[o.op as EditOpKey].tool : undefined)).filter((x): x is EditingTool => !!x))];
      const updated = await stationApi.saveEdits(session.id, { captureId: capture.id, ops, toolsUsed, resultBase64: rasterToDataUrl(result, 'image/png') });
      setSession(updated);
      if (captureIndex + 1 < captures.length) {
        setCaptureIndex(captureIndex + 1);
        setSaving(false);
      } else {
        await advance('edit_done');
      }
    } catch (error) {
      setSaving(false);
      fail(error, 'edit_failed');
    }
  };

  const skip = async () => {
    if (captureIndex + 1 < captures.length) setCaptureIndex(captureIndex + 1);
    else await advance('edit_skipped');
  };

  const has = (tool: EditingTool) => allowed.includes(tool);
  const canUndo = cursor > 0;
  const canRedo = cursor < history.length - 1;

  return (
    <SessionFrame title={t('kiosk.edit.title')}>
      {captures.length > 1 ? <p className="kiosk-lead">{t('kiosk.common.photo_n_of_m', { n: captureIndex + 1, m: captures.length })}</p> : null}
      <div className="kiosk-edit">
        <div className="kiosk-stack">
          <div className="kiosk-preview" style={{ position: 'relative' }}>
            {preview || (showBefore && capture) ? <img src={showBefore ? capture?.url : preview} alt={t('kiosk.edit.title')} data-testid="edit-preview" /> : <Spinner size="xl" label={t('kiosk.common.loading')} />}
          </div>
          <div className="kiosk-row" style={{ justifyContent: 'center' }}>
            <IconButton label={t('kiosk.edit.undo')} icon={<Icon name="back" />} size="lg" variant="outline" showLabel disabled={!canUndo} onClick={() => setCursor(cursor - 1)} />
            <IconButton label={t('kiosk.edit.redo')} icon={<Icon name="forward" />} size="lg" variant="outline" showLabel disabled={!canRedo} onClick={() => setCursor(cursor + 1)} />
            <IconButton label={t('kiosk.edit.reset')} icon={<Icon name="retry" />} size="lg" variant="outline" showLabel disabled={ops.length === 0} onClick={() => push([])} />
            <IconButton label={showBefore ? t('kiosk.edit.after') : t('kiosk.edit.before')} icon={<Icon name="image" />} size="lg" variant={showBefore ? 'primary' : 'outline'} showLabel onPointerDown={() => setShowBefore(true)} onPointerUp={() => setShowBefore(false)} onPointerLeave={() => setShowBefore(false)} />
          </div>
        </div>
        <div className="kiosk-stack">
          <div className="kiosk-edit__tools">
            {allowed.length === 0 ? <p>{t('kiosk.edit.no_tools')}</p> : null}
            {SLIDERS.filter((s) => has(s.key)).map((s) => (
              <TouchSlider key={s.key} label={t(`kiosk.edit.tool.${s.key}`)} min={s.min} max={s.max} step={s.step} value={valueOf(s.key, s.param)} onChange={(v) => setParam(s.key, s.param, Math.round(v * 100) / 100)} centerMark formatValue={(v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`} decreaseLabel={t('kiosk.common.previous')} increaseLabel={t('kiosk.common.next')} />
            ))}
            {has('levelRotation') ? <TouchSlider label={t('kiosk.edit.tool.rotate')} min={-15} max={15} step={0.5} value={valueOf('levelRotation', 'degrees')} onChange={(v) => setParam('levelRotation', 'degrees', v)} centerMark formatValue={(v) => `${v}°`} decreaseLabel={t('kiosk.edit.rotate_left')} increaseLabel={t('kiosk.edit.rotate_right')} /> : null}
            {has('sharpen') ? <TouchSlider label={t('kiosk.edit.tool.sharpen')} min={0} max={1} step={0.1} value={valueOf('sharpen', 'amount')} onChange={(v) => setParam('sharpen', 'amount', v)} /> : null}
            {has('vignette') ? <TouchSlider label={t('kiosk.edit.tool.vignette')} min={0} max={1} step={0.1} value={valueOf('vignette', 'strength')} onChange={(v) => setParam('vignette', 'strength', v)} /> : null}
            {has('backgroundAdjust') ? <TouchSlider label={t('kiosk.edit.tool.backgrounds')} min={0} max={1} step={0.1} value={valueOf('backgroundAdjust', 'lighten')} onChange={(v) => setParam('backgroundAdjust', 'lighten', v)} /> : null}
            {has('grayscale') ? <Toggle checked={ops.some((o) => o.op === 'grayscale')} onChange={() => toggleFlag('grayscale')} label={t('kiosk.edit.tool.grayscale')} /> : null}
            {has('mirror') ? <Toggle checked={ops.some((o) => o.op === 'mirror')} onChange={() => toggleFlag('mirror')} label={t('kiosk.edit.tool.mirror')} /> : null}
            {has('rotate') ? (
              <div className="kiosk-row">
                <BigButton variant="secondary" onClick={() => push([...ops, { op: 'rotate', params: { degrees: 270 } }])}>{t('kiosk.edit.rotate_left')}</BigButton>
                <BigButton variant="secondary" onClick={() => push([...ops, { op: 'rotate', params: { degrees: 90 } }])}>{t('kiosk.edit.rotate_right')}</BigButton>
              </div>
            ) : null}
            {has('presets') && presets.length > 0 ? (
              <div>
                <p className="kiosk-small">{t('kiosk.edit.tool.presets')}</p>
                <div className="kiosk-chips">
                  <button type="button" className="kiosk-chip" aria-pressed={!ops.some((o) => o.op === 'preset')} onClick={() => push(ops.filter((o) => o.op !== 'preset'))}>{t('kiosk.edit.no_preset')}</button>
                  {presets.map((p) => (
                    <button key={p.id} type="button" className="kiosk-chip" aria-pressed={ops.some((o) => o.op === 'preset' && o.params['presetId'] === p.id)} onClick={() => applyPreset(p.id)}>
                      {tl(p.name)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {frames.length > 0 ? (
              <div>
                <p className="kiosk-small">{t('kiosk.edit.tool.frames')}</p>
                <div className="kiosk-chips">
                  <button type="button" className="kiosk-chip" aria-pressed={!ops.some((o) => o.op === 'frame')} onClick={() => setOverlay('frame', undefined)}>{t('kiosk.edit.no_frame')}</button>
                  {frames.map((id) => (
                    <button key={id} type="button" className="kiosk-chip" aria-pressed={ops.some((o) => o.op === 'frame' && o.params['assetId'] === id)} onClick={() => setOverlay('frame', id)}>
                      <img src={resolveAssetUrl(bundle, id)} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {stickers.length > 0 ? (
              <div>
                <p className="kiosk-small">{t('kiosk.edit.tool.stickers')}</p>
                <div className="kiosk-chips">
                  {stickers.map((id) => (
                    <button key={id} type="button" className="kiosk-chip" aria-pressed={ops.some((o) => o.op === 'sticker' && o.params['assetId'] === id)} onClick={() => setOverlay('sticker', ops.some((o) => o.op === 'sticker' && o.params['assetId'] === id) ? undefined : id)}>
                      <img src={resolveAssetUrl(bundle, id)} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <BigButton variant="primary" size="xl" block icon={<Icon name="check" />} disabled={!original} loading={saving} loadingLabel={t('kiosk.edit.applying')} onClick={() => void save()} data-testid="edit-apply">
            {t('kiosk.edit.apply')}
          </BigButton>
          <BigButton variant="ghost" block onClick={() => void skip()}>
            {t('kiosk.edit.skip')}
          </BigButton>
        </div>
      </div>
    </SessionFrame>
  );
}

/** Reduce el raster para la vista previa usando el canvas (rápido) en lugar del resize puro. */
function downscale(r: Raster, scale: number): Raster {
  return canvasToRaster(rasterToCanvas(r), { width: Math.round(r.width * scale), height: Math.round(r.height * scale) });
}

/** Las ops con coordenadas en px (recorte, stickers, texto) se escalan para la vista previa. */
function scaleOps(ops: EditOp[], scale: number): EditOp[] {
  if (scale >= 1) return ops;
  return ops.map((op) => {
    if (op.op !== 'crop' && op.op !== 'sticker' && op.op !== 'text' && op.op !== 'overlay') return op;
    const params: Record<string, EditOp['params'][string]> = { ...op.params };
    for (const key of ['x', 'y', 'w', 'h']) {
      const v = params[key];
      if (typeof v === 'number') params[key] = Math.round(v * scale);
    }
    return { op: op.op, params };
  });
}
