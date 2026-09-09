import { describe, expect, it } from 'vitest';
import { renderPlan } from './render';
import { createRaster, getPixel, setPixel } from './raster';
import type { RGBA, Raster, Rect } from './raster';
import type { Primitive, RenderPlan } from './primitives';
import { sheetTemplate } from './__tests__/fixtures';
import { planDocumentSheet } from './template/document-sheet';

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const WHITE: RGBA = [255, 255, 255, 255];

function solid(width: number, height: number, color: RGBA): Raster {
  return createRaster(width, height, color);
}

function plan(widthPx: number, heightPx: number, primitives: Primitive[], dpi = 300): RenderPlan {
  return { widthPx, heightPx, dpi, primitives };
}

function countDark(r: Raster, rect: Rect): number {
  let n = 0;
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (getPixel(r, x, y)[0] < 128) n++;
  return n;
}

describe('renderPlan', () => {
  it('hoja documental: tamaño correcto, foto no blanca en su rect y marcas de corte negras', () => {
    const { plan: sheet } = planDocumentSheet(sheetTemplate(), { widthMm: 35, heightMm: 45 }, 4);
    const out = renderPlan(sheet, { photos: [solid(70, 90, RED)] });
    expect([out.width, out.height]).toEqual([1200, 1800]);
    expect(getPixel(out, 1, 1)).toEqual(WHITE);
    const photo = sheet.primitives.find((p) => p.kind === 'photo');
    if (!photo || photo.kind !== 'photo') throw new Error('sin foto');
    const { rect } = photo;
    expect(getPixel(out, rect.x + Math.floor(rect.w / 2), rect.y + Math.floor(rect.h / 2))).toEqual(RED);
    expect(getPixel(out, rect.x, rect.y)).toEqual(RED);
    expect(getPixel(out, rect.x + rect.w - 1, rect.y + rect.h - 1)).toEqual(RED);
    // Marca horizontal a la altura del borde superior, justo a la izquierda de la foto.
    expect(getPixel(out, rect.x - 2, rect.y)).toEqual([0, 0, 0, 255]);
    // Marca vertical sobre el borde izquierdo, justo encima de la foto.
    expect(getPixel(out, rect.x, rect.y - 2)).toEqual([0, 0, 0, 255]);
  });

  it('es determinista', () => {
    const p = plan(40, 40, [{ kind: 'qr', rect: { x: 2, y: 2, w: 36, h: 36 }, payload: 'abc' }]);
    expect(renderPlan(p, { photos: [] }).data).toEqual(renderPlan(p, { photos: [] }).data);
  });

  it('cover recorta centrado y contain deja bandas', () => {
    const src = createRaster(4, 2, BLUE);
    setPixel(src, 0, 0, RED);
    const cover = renderPlan(plan(10, 10, [{ kind: 'photo', rect: { x: 0, y: 0, w: 10, h: 10 }, slotIndex: 0, fit: 'cover', radiusPx: 0, borderPx: 0, borderColor: '#FFF' }]), { photos: [src] });
    expect(getPixel(cover, 5, 5)).toEqual(BLUE);
    expect(getPixel(cover, 9, 9)).toEqual(BLUE);
    const contain = renderPlan(plan(10, 10, [{ kind: 'photo', rect: { x: 0, y: 0, w: 10, h: 10 }, slotIndex: 0, fit: 'contain', radiusPx: 0, borderPx: 0, borderColor: '#FFF' }]), { photos: [src] });
    expect(getPixel(contain, 5, 5)).toEqual(BLUE);
    expect(getPixel(contain, 5, 0)).toEqual(WHITE);
    expect(getPixel(contain, 5, 9)).toEqual(WHITE);
  });

  it('gira la foto 90° cuando la primitiva lo pide', () => {
    const src = createRaster(4, 2, BLUE);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) setPixel(src, x, y, RED);
    const out = renderPlan(plan(4, 8, [{ kind: 'photo', rect: { x: 0, y: 0, w: 4, h: 8 }, slotIndex: 0, fit: 'cover', radiusPx: 0, borderPx: 0, borderColor: '#FFF', rotationDeg: 90 }]), { photos: [src] });
    expect(getPixel(out, 2, 1)).toEqual(RED);
    expect(getPixel(out, 2, 6)).toEqual(BLUE);
  });

  it('esquinas redondeadas y borde', () => {
    const out = renderPlan(plan(40, 40, [{ kind: 'photo', rect: { x: 0, y: 0, w: 40, h: 40 }, slotIndex: 0, fit: 'cover', radiusPx: 12, borderPx: 4, borderColor: '#00FF00' }]), { photos: [solid(8, 8, RED)] });
    expect(getPixel(out, 0, 0)).toEqual(WHITE);
    expect(getPixel(out, 20, 1)).toEqual([0, 255, 0, 255]);
    expect(getPixel(out, 20, 20)).toEqual(RED);
  });

  it('recursos ausentes se dibujan como marcador gris sin lanzar', () => {
    const out = renderPlan(
      plan(60, 20, [
        { kind: 'photo', rect: { x: 0, y: 0, w: 20, h: 20 }, slotIndex: 3, fit: 'cover', radiusPx: 0, borderPx: 0, borderColor: '#FFF' },
        { kind: 'asset', rect: { x: 20, y: 0, w: 20, h: 20 }, assetId: 'ast_missing', fit: 'contain', opacity: 1 },
        { kind: 'logo', rect: { x: 40, y: 0, w: 20, h: 20 }, role: 'brand', fit: 'contain' },
      ]),
      { photos: [] },
    );
    for (const cx of [10, 30, 50]) expect(getPixel(out, cx, 10)).toEqual([224, 224, 224, 255]);
    expect(getPixel(out, 0, 10)).toEqual([158, 158, 158, 255]);
  });

  it('activos y logos presentes se componen con opacidad', () => {
    const out = renderPlan(
      plan(20, 10, [
        { kind: 'asset', rect: { x: 0, y: 0, w: 10, h: 10 }, assetId: 'ast_blue', fit: 'cover', opacity: 0.5 },
        { kind: 'logo', rect: { x: 10, y: 0, w: 10, h: 10 }, role: 'brand', fit: 'cover' },
      ]),
      { photos: [], assets: { ast_blue: solid(2, 2, BLUE) }, logos: { brand: solid(2, 2, RED) } },
    );
    expect(getPixel(out, 5, 5)).toEqual([128, 128, 255, 255]);
    expect(getPixel(out, 15, 5)).toEqual(RED);
  });

  it('texto con la fuente bitmap: alineación y recorte al rect', () => {
    const rect = { x: 10, y: 10, w: 100, h: 20 };
    const style = { fontFamily: 'sans-serif', sizePx: 14, color: '#000000', align: 'left' as const, weight: 'normal' as const };
    const left = renderPlan(plan(120, 40, [{ kind: 'text', rect, text: 'AB', style }]), { photos: [] });
    const right = renderPlan(plan(120, 40, [{ kind: 'text', rect, text: 'AB', style: { ...style, align: 'right' } }]), { photos: [] });
    expect(countDark(left, rect)).toBeGreaterThan(0);
    expect(countDark(left, { x: 0, y: 0, w: 120, h: 10 })).toBe(0);
    expect(countDark(left, { x: 10, y: 10, w: 30, h: 20 })).toBeGreaterThan(0);
    expect(countDark(left, { x: 80, y: 10, w: 30, h: 20 })).toBe(0);
    expect(countDark(right, { x: 80, y: 10, w: 30, h: 20 })).toBeGreaterThan(0);
    expect(countDark(right, { x: 10, y: 10, w: 30, h: 20 })).toBe(0);
    const bold = renderPlan(plan(120, 40, [{ kind: 'text', rect, text: 'AB', style: { ...style, weight: 'bold' } }]), { photos: [] });
    expect(countDark(bold, rect)).toBeGreaterThan(countDark(left, rect));
    expect(renderPlan(plan(120, 40, [{ kind: 'text', rect, text: '', style }]), { photos: [] }).data).toEqual(createRaster(120, 40, WHITE).data);
  });

  it('qr: marco y módulos deterministas que dependen del payload', () => {
    const rect = { x: 5, y: 5, w: 50, h: 50 };
    const a = renderPlan(plan(60, 60, [{ kind: 'qr', rect, payload: 'https://a.test' }]), { photos: [] });
    const b = renderPlan(plan(60, 60, [{ kind: 'qr', rect, payload: 'https://b.test' }]), { photos: [] });
    expect(getPixel(a, 5, 5)).toEqual([0, 0, 0, 255]);
    expect(countDark(a, rect)).toBeGreaterThan(200);
    expect(a.data).not.toEqual(b.data);
    expect(getPixel(a, 0, 0)).toEqual(WHITE);
  });
});
