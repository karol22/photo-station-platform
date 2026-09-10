/**
 * Edición: la pantalla donde la foto se vuelve un recuerdo (PANTALLA 7).
 *
 * En el recorrido social hay **una sola decisión**: cuál de los estilos. Va a sangre, la foto
 * ocupa la banda alta entera, y los estilos se eligen mirándose —cada miniatura está renderizada
 * sobre la cara de quien está enfrente, no sobre una muestra genérica ni sobre un nombre—. La
 * salida está presente desde el segundo cero: nunca hay que buscar cómo terminar.
 *
 * Lo que aquí murió, y por qué: la rejilla lienzo+inspector, el panel de herramientas con barra de
 * desplazamiento y la vista previa como tarjeta blanca con sombra. Eso es un editor de escritorio
 * y esto es una cabina: de pie, a metro y medio, con alguien esperando detrás. Cero deslizadores,
 * cero listas con scroll, cero antes/después —enseñar el «antes» rompe el hechizo y cuesta un
 * toque—, y ningún objetivo táctil por encima de la banda REPISA.
 *
 * En el recorrido documental no aplica nada de lo anterior: ahí cada imagen es un trámite
 * distinto, se edita foto por foto y los ajustes finos siguen existiendo, porque lo que se juzga
 * es la fidelidad y no el gusto.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditOp, EditingTool } from '@psp/contracts';
import { EDIT_OPS, applyEditOps, editingPresetToOps, validateEditOps, type EditOpKey, type Raster } from '@psp/imaging';
import { canvasToRaster, loadRaster, rasterToCanvas, rasterToDataUrl } from '@psp/imaging/browser';
import { BigButton, Icon, IconButton, Marquee, Spinner, Toggle, TouchSlider } from '@psp/ui';
import { FilterStrip, filterOptions, type FilterOption } from '../components/FilterStrip';
import { StickerLayer, type PlacedSticker } from '../components/StickerLayer';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useSessionTimeout } from '../session/useSessionTimeout';
import { useKioskStore } from '../store';
import { configString, resolveAssetUrl } from '../theme/assets';

type SliderKey = 'brightness' | 'contrast' | 'exposure' | 'saturation' | 'temperature';
const SLIDERS: Array<{ key: SliderKey; param: string; min: number; max: number; step: number }> = [
  { key: 'brightness', param: 'amount', min: -1, max: 1, step: 0.05 },
  { key: 'contrast', param: 'amount', min: -1, max: 1, step: 0.05 },
  { key: 'exposure', param: 'stops', min: -2, max: 2, step: 0.1 },
  { key: 'saturation', param: 'amount', min: -1, max: 1, step: 0.05 },
  { key: 'temperature', param: 'amount', min: -1, max: 1, step: 0.05 },
];

const PREVIEW_MAX = 900;
/**
 * La vista previa se recalcula en cada cambio y `applyEditOps` es síncrono. A 900 px un cambio
 * cuesta lo bastante como para que arrastrar un deslizador se vea a tirones, así que mientras la
 * mano está encima se trabaja en pequeño y sólo al soltar se sube a la resolución de vista previa.
 */
const PREVIEW_LIVE = 360;
const SETTLE_MS = 220;

/**
 * Cuánto suaviza «un poquito». Es piel y luz, nunca geometría de la cara: nadie se agranda los
 * ojos ni se afina la nariz, porque el default de 2026 es que la persona siga reconociéndose.
 * Vive aquí, y no en la interfaz, porque no es una preferencia que se pregunte: es un valor de
 * producto, y su casa definitiva es una clave de bundle cuando exista.
 */
const RETOUCH_AMOUNT = 0.55;

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
  /** Cuántas fotos del lote llevan aplicado el estilo. Se usa para el progreso real. */
  const [savedCount, setSavedCount] = useState(0);
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

  // No hay una operación "filtro": un filtro es la cola de operaciones que agrega, así que el
  // filtro activo se deduce de las operaciones reales y sobrevive a deshacer y rehacer sin estado
  // paralelo que se pueda desincronizar. Sólo se ofrecen los que el producto permite aplicar.
  const filters = useMemo(() => filterOptions(allowed), [allowed]);
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

  // Un cambio recién hecho se dibuja en pequeño; si no llega otro en `SETTLE_MS`, se redibuja
  // grande. Así el dedo ve movimiento inmediato y el resultado final no pierde calidad.
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    setSettled(false);
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ops]);

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
      const target = settled ? PREVIEW_MAX : PREVIEW_LIVE;
      const scale = Math.min(1, target / Math.max(original.width, original.height));
      const base = scale < 1 ? downscale(original, scale) : original;
      const result = applyEditOps(base, scaleOps(ops, scale), { assets: assets.current, presets: presetMap });
      if (active) setPreview(rasterToDataUrl(result, 'image/jpeg', settled ? 0.9 : 0.7));
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [original, ops, frames, stickers, bundle, presetMap, settled]);

  const push = (next: EditOp[], options: { transient?: boolean } = {}) => {
    const valid = validateEditOps(next, allowed);
    const kept = next.filter((op) => !valid.rejected.includes(op));
    if (options.transient) {
      // Un gesto en curso reemplaza el estado actual: deshacer debe revertir el arrastre entero,
      // no cada píxel que recorrió el dedo.
      const replaced = [...history];
      replaced[cursor] = kept;
      setHistory(replaced);
      return;
    }
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

  /**
   * En el recorrido social el estilo es del conjunto, no de cada foto: se elige una vez y se
   * aplica a las cuatro. Ajustar seis fotos una por una es el paso que la propia industria está
   * recortando, y aquí sería el más caro: cada foto es un toque más con alguien esperando detrás.
   *
   * En el documental sigue siendo foto por foto, porque ahí cada imagen es un trámite distinto.
   */
  const applyToWholeSet = !isDocument && captures.length > 1;

  const save = async () => {
    if (!session || !capture || !original) return;
    setSaving(true);
    setSavedCount(0);
    const toolsUsed = [...new Set(ops.map((o) => (o.op in EDIT_OPS ? EDIT_OPS[o.op as EditOpKey].tool : undefined)).filter((x): x is EditingTool => !!x))];
    try {
      const targets = applyToWholeSet ? captures : [capture];
      for (const target of targets) {
        // Cada foto cede el hilo antes de trabajar: sin esto el progreso nunca llega a pintarse
        // y la pantalla se queda congelada durante todo el lote.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const raster = target.id === capture.id ? original : await loadRaster(target.url);
        const result = applyEditOps(raster, ops, { assets: assets.current, presets: presetMap });
        const updated = await stationApi.saveEdits(session.id, { captureId: target.id, ops, toolsUsed, resultBase64: rasterToDataUrl(result, 'image/png') });
        setSession(updated);
        setSavedCount((n) => n + 1);
      }
      await advance('edit_done');
    } catch (error) {
      setSaving(false);
      fail(error, 'edit_failed');
    }
  };

  const skip = async () => {
    if (applyToWholeSet || captureIndex + 1 >= captures.length) {
      await advance('edit_skipped');
      return;
    }
    setCaptureIndex(captureIndex + 1);
  };

  /**
   * Una sola salida en la banda de alcance. Sin operaciones no hay nada que componer, así que
   * termina sin volver a escribir cuatro fotos idénticas a las originales: en un aparato modesto
   * ese trabajo son segundos de la persona a cambio de nada.
   */
  const finish = () => {
    if (saving) return;
    void (ops.length === 0 ? skip() : save());
  };

  // El reloj de la pantalla es la marquesina: los focos se van apagando. Nunca hay un contador en
  // rojo sobre la foto de nadie. En documental lo trae el marco de sesión.
  const timeout = useSessionTimeout(!isDocument, undefined, { onAutoAdvance: () => void skip() });

  if (!session || !product) return null;

  /**
   * En el recorrido social la interfaz es la tira de estilos y nada más: cada deslizador es una
   * decisión que no cambia el resultado lo suficiente para pagarla con el tiempo de la fila.
   * Los ajustes finos siguen existiendo donde importan, que es el trámite documental.
   */
  const has = (tool: EditingTool) => isDocument && allowed.includes(tool);

  const endsWith = (list: EditOp[], tail: EditOp[]): boolean =>
    tail.length > 0 &&
    list.length >= tail.length &&
    JSON.stringify(list.slice(list.length - tail.length)) === JSON.stringify(tail);

  const activeFilter = filters.find((f) => endsWith(ops, f.ops))?.key ?? 'none';

  const pickFilter = (option: FilterOption): void => {
    const current = filters.find((f) => endsWith(ops, f.ops));
    const manual = current ? ops.slice(0, ops.length - current.ops.length) : ops;
    push([...manual, ...option.ops]);
  };

  /** El único control de retoque: dos estados, sin jerga, sin porcentajes y sin nombres de la cara. */
  const canRetouch = !isDocument && allowed.includes('filterIntensity');
  const retouching = ops.some((o) => o.op === 'smoothSkin');
  const setRetouch = (on: boolean) => {
    const others = ops.filter((o) => o.op !== 'smoothSkin');
    push(on ? [...others, { op: 'smoothSkin', params: { amount: RETOUCH_AMOUNT } }] : others);
  };

  /**
   * Las pegatinas colocadas se leen de las propias ops, no de un estado paralelo: así deshacer y
   * rehacer las mueven igual que a todo lo demás y no hay dos verdades que se puedan separar.
   */
  const placed: PlacedSticker[] = ops
    .map((op, index) => ({ op, index }))
    .filter(({ op }) => op.op === 'sticker')
    .map(({ op, index }) => ({
      key: `${index}:${String(op.params['assetId'] ?? '')}`,
      assetId: String(op.params['assetId'] ?? ''),
      url: resolveAssetUrl(bundle, String(op.params['assetId'] ?? '')) ?? '',
      x: Number(op.params['x'] ?? 0),
      y: Number(op.params['y'] ?? 0),
      size: Number(op.params['w'] ?? Math.round((original?.width ?? 600) * 0.2)),
      angle: Number(op.params['angle'] ?? 0),
    }));

  const setPlaced = (next: PlacedSticker[], options: { transient?: boolean } = {}) => {
    const others = ops.filter((op) => op.op !== 'sticker');
    push([
      ...others,
      ...next.map((sticker) => ({
        op: 'sticker',
        params: {
          assetId: sticker.assetId,
          x: Math.round(sticker.x),
          y: Math.round(sticker.y),
          w: Math.round(sticker.size),
          h: Math.round(sticker.size),
        },
      })),
    ], options);
  };

  const addSticker = (assetId: string) => {
    const side = Math.round((original?.width ?? 600) * 0.22);
    setPlaced([
      ...placed,
      {
        key: `nuevo:${assetId}:${placed.length}`,
        assetId,
        url: resolveAssetUrl(bundle, assetId) ?? '',
        // Entra un poco arriba del centro y desplazada por cuántas hay, para que dos seguidas no
        // se tapen y se vea que la segunda es otra.
        x: Math.round((original?.width ?? 600) * (0.5 + placed.length * 0.06)),
        y: Math.round((original?.height ?? 600) * (0.45 + placed.length * 0.05)),
        size: side,
        angle: 0,
      },
    ]);
  };

  const canUndo = cursor > 0;
  const canRedo = cursor < history.length - 1;

  const photo = (
    <div
      className="kiosk-edicion__foto"
      // La proporción real de la foto: el marco se ciñe a ella, así que una pegatina cae donde el
      // dedo la suelta y no desplazada por una banda de campo entre el borde y la imagen.
      style={{ ['--psp-foto-ratio' as string]: original ? `${original.width} / ${original.height}` : undefined }}
    >
      {preview ? <img src={preview} alt={t('kiosk.edit.title')} data-testid="edit-preview" /> : <Spinner size="xl" label={t('kiosk.common.loading')} />}
      {stickers.length > 0 && original && preview ? (
        <StickerLayer
          stickers={placed}
          onChange={setPlaced}
          imageWidth={original.width}
          imageHeight={original.height}
          removeLabel={t('kiosk.edit.remove_sticker')}
        />
      ) : null}
    </div>
  );

  if (!isDocument) {
    return (
      <Shell bleed hideHeader hideLang marquee={<Marquee cadence="wait" remaining={timeout.total > 0 ? timeout.remaining / timeout.total : 1} />}>
        <div className="kiosk-edicion" data-testid="edit">
          {/* CARTEL: la foto y nada más, a sangre y sin tarjeta debajo. */}
          <div className="kiosk-edicion__cartel">{photo}</div>

          {/* REPISA: el riel de estilos y, debajo, la fila de accesorios. */}
          <div className="kiosk-edicion__repisa">
            <FilterStrip source={original} options={filters} activeKey={typeof activeFilter === 'string' ? activeFilter : 'none'} onPick={pickFilter} />
            {/*
              Hueco previsto para los accesorios que se anclan al rostro (sombrero, gafas, bigote) y
              para la herramienta de texto: el componente nuevo se monta AQUÍ dentro, como una fila
              más de esta misma banda, y hereda su altura y su área táctil. Hoy lo ocupan los
              marcos y las pegatinas que declara la experiencia; cuando llegue la fila anclada al
              rostro, convive con ellos en el mismo contenedor sin tocar el resto de la pantalla.
            */}
            {frames.length > 0 || stickers.length > 0 ? (
              <div className="kiosk-edicion__accesorios" data-slot="accesorios" role="group" aria-label={t('kiosk.edit.props_label')}>
                {frames.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="kiosk-edicion__accesorio"
                    aria-pressed={ops.some((o) => o.op === 'frame' && o.params['assetId'] === id)}
                    onClick={() => setOverlay('frame', ops.some((o) => o.op === 'frame' && o.params['assetId'] === id) ? undefined : id)}
                  >
                    <img src={resolveAssetUrl(bundle, id)} alt="" />
                  </button>
                ))}
                {/* Tocar agrega otra: caben varias y cada una se arrastra a donde quiera. */}
                {stickers.map((id) => (
                  <button key={id} type="button" className="kiosk-edicion__accesorio" onClick={() => addSticker(id)} data-testid={`sticker-${id}`}>
                    <img src={resolveAssetUrl(bundle, id)} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* ALCANCE: la salida, presente desde el segundo cero, y el único control de retoque. */}
          <div className="kiosk-edicion__alcance">
            <button type="button" className="kiosk-edicion__accion" disabled={!original || saving} onClick={finish} data-testid="edit-apply">
              {saving
                ? applyToWholeSet
                  ? t('kiosk.edit.applying_n', { n: savedCount + 1, m: captures.length })
                  : t('kiosk.edit.applying')
                : t('kiosk.edit.looks_good')}
            </button>
            {canRetouch ? (
              <div className="kiosk-edicion__retoque" role="group" aria-label={t('kiosk.edit.retouch_label')}>
                <button type="button" className="kiosk-edicion__ficha" aria-pressed={!retouching} onClick={() => setRetouch(false)} data-testid="retouch-none">
                  {t('kiosk.edit.retouch_none')}
                </button>
                <button type="button" className="kiosk-edicion__ficha" aria-pressed={retouching} onClick={() => setRetouch(true)} data-testid="retouch-soft">
                  {t('kiosk.edit.retouch_soft')}
                </button>
              </div>
            ) : null}
          </div>

          <div className="kiosk-edicion__zocalo">
            {applyToWholeSet ? <span>{t('kiosk.edit.applies_to_all', { n: captures.length })}</span> : null}
            <span>{bundle?.machine.code}</span>
            {configString(bundle, 'branding.footerText') ? <span>{configString(bundle, 'branding.footerText')}</span> : null}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <SessionFrame title={t('kiosk.edit.title')} onAutoAdvance={() => void skip()}>
      {captures.length > 1 ? <p className="kiosk-lead">{t('kiosk.common.photo_n_of_m', { n: captureIndex + 1, m: captures.length })}</p> : null}
      <div className="kiosk-edicion-doc">
        <div className="kiosk-edicion-doc__vista">
          <div className="kiosk-edicion-doc__marco">
            {preview || (showBefore && capture) ? <img src={showBefore ? capture?.url : preview} alt={t('kiosk.edit.title')} data-testid="edit-preview" /> : <Spinner size="xl" label={t('kiosk.common.loading')} />}
          </div>
          <div className="kiosk-row" style={{ justifyContent: 'center' }}>
            <IconButton label={t('kiosk.edit.undo')} icon={<Icon name="back" />} size="lg" variant="outline" showLabel disabled={!canUndo} onClick={() => setCursor(cursor - 1)} />
            <IconButton label={t('kiosk.edit.redo')} icon={<Icon name="forward" />} size="lg" variant="outline" showLabel disabled={!canRedo} onClick={() => setCursor(cursor + 1)} />
            <IconButton label={t('kiosk.edit.reset')} icon={<Icon name="retry" />} size="lg" variant="outline" showLabel disabled={ops.length === 0} onClick={() => push([])} />
            {/* Comparar sólo existe aquí: es la prueba de que la imagen de trámite no se alteró. */}
            <IconButton label={showBefore ? t('kiosk.edit.after') : t('kiosk.edit.before')} icon={<Icon name="image" />} size="lg" variant={showBefore ? 'primary' : 'outline'} showLabel onPointerDown={() => setShowBefore(true)} onPointerUp={() => setShowBefore(false)} onPointerLeave={() => setShowBefore(false)} />
          </div>
        </div>
        {/* Los ajustes finos, en columna y sin barra de desplazamiento: son pocos y caben. */}
        <div className="kiosk-edicion-doc__ajustes">
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
