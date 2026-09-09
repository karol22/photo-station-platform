/**
 * Tira de filtros con vista previa real.
 *
 * Cada opción se calcula sobre la foto de la persona, no sobre una muestra genérica: se elige con
 * los ojos, no leyendo un nombre. Las miniaturas se generan a resolución muy baja, así que el
 * cálculo es barato incluso en un aparato modesto, y se recalculan sólo cuando cambia la foto.
 */
import { useEffect, useRef, useState } from 'react';
import type { EditOp } from '@psp/contracts';
import { COLOR_FILTERS, applyEditOps, resize, type Raster } from '@psp/imaging';
import { rasterToDataUrl } from '@psp/imaging/browser';
import { useT } from '../i18n';

/** Ancho de la miniatura. Suficiente para juzgar el color, ridículo para el procesador. */
const THUMB_WIDTH = 132;

export interface FilterOption {
  key: string;
  ops: EditOp[];
}

/** El primero es "sin filtro": siempre hay forma de volver al original. */
export function filterOptions(allowed: string[]): FilterOption[] {
  const named = Object.entries(COLOR_FILTERS)
    .filter(([key]) => allowed.length === 0 || allowed.includes(key))
    .map(([key, ops]) => ({ key, ops: ops as EditOp[] }));
  return [{ key: 'none', ops: [] }, ...named];
}

export function FilterStrip({ source, options, activeKey, onPick }: {
  source: Raster | undefined;
  options: FilterOption[];
  activeKey: string;
  onPick: (option: FilterOption) => void;
}): React.ReactElement | null {
  const { t } = useT();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const jobId = useRef(0);

  useEffect(() => {
    if (!source) return undefined;
    const id = ++jobId.current;
    const height = Math.max(1, Math.round((source.height / source.width) * THUMB_WIDTH));
    const small = resize(source, THUMB_WIDTH, height);
    let cancelled = false;
    // Una miniatura por cuadro de animación: la interfaz no se congela mientras se calculan.
    const pending = [...options];
    const step = (): void => {
      if (cancelled || id !== jobId.current) return;
      const option = pending.shift();
      if (!option) return;
      try {
        const raster = option.ops.length === 0 ? small : applyEditOps(small, option.ops);
        const url = rasterToDataUrl(raster, 'image/jpeg', 0.72);
        setThumbs((prev) => ({ ...prev, [option.key]: url }));
      } catch {
        // Un filtro que falla simplemente no ofrece miniatura; el resto sigue.
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => {
      cancelled = true;
    };
  }, [source, options]);

  if (options.length <= 1) return null;

  return (
    <div className="kiosk-filters" data-testid="filter-strip">
      <p className="kiosk-small kiosk-muted">{t('kiosk.edit.filters')}</p>
      <div className="kiosk-filters__row">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className="kiosk-filters__item"
            aria-pressed={activeKey === option.key}
            onClick={() => onPick(option)}
            data-testid={`filter-${option.key}`}
          >
            {thumbs[option.key] ? (
              <img src={thumbs[option.key]} alt="" className="kiosk-filters__thumb" />
            ) : (
              <span className="kiosk-filters__thumb kiosk-filters__thumb--empty" />
            )}
            <span className="kiosk-filters__label">{t(`kiosk.edit.filter.${option.key}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
