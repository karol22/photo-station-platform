import { describe, expect, it } from 'vitest';
import { stripTemplate } from '../__tests__/fixtures';
import { mmToPx, planTemplate, sortElements } from './plan';
import { selectVariant, variantByKey } from './select';

const ctx = { locale: 'es' as const, tokens: { date: '09/09/2026' }, photoCount: 4 };

describe('selectVariant', () => {
  const strip = stripTemplate();

  it('sin selector devuelve la base', () => {
    const base = selectVariant(strip);
    expect(base.variantKey).toBeUndefined();
    expect(base.canvas).toEqual({ widthMm: 50.8, heightMm: 152.4 });
    expect(base.elements).toBe(strip.elements);
  });

  it('elige por locale la primera variante cuyas claves definidas coinciden todas', () => {
    const en = selectVariant(strip, { locale: 'en' });
    expect(en.variantKey).toBe('en');
    expect(en.elements.map((e) => e.id)).toEqual(['title-en']);
    expect(en.canvas).toEqual({ widthMm: 50.8, heightMm: 152.4 });
    expect(selectVariant(strip, { locale: 'es' }).variantKey).toBeUndefined();
  });

  it('elige por paperSize y hereda los elementos base si la variante no los define', () => {
    const a4 = selectVariant(strip, { paperSize: 'A4', locale: 'es' });
    expect(a4.variantKey).toBe('a4');
    expect(a4.canvas).toEqual({ widthMm: 210, heightMm: 297 });
    expect(a4.elements).toBe(strip.elements);
    expect(selectVariant(strip, { locale: 'en', paperSize: 'A4' }).variantKey).toBe('en-a4');
  });

  it('variantByKey busca por clave explícita', () => {
    expect(variantByKey(strip, 'a4')?.canvas.widthMm).toBe(210);
    expect(variantByKey(strip, 'nope')).toBeUndefined();
  });
});

describe('planTemplate', () => {
  const strip = stripTemplate();

  it('tira 2×6 in a 300 dpi mide 600×1800 px con 4 fotos y la fecha del token', () => {
    const plan = planTemplate(strip, ctx);
    expect([plan.widthPx, plan.heightPx, plan.dpi]).toEqual([600, 1800, 300]);
    const photos = plan.primitives.filter((p) => p.kind === 'photo');
    expect(photos.map((p) => p.slotIndex)).toEqual([0, 1, 2, 3]);
    // 4 mm → 47.24 → 47; 34 mm → 401.57 → 402: los bordes se redondean por separado para que las cajas vecinas sigan adyacentes.
    expect(photos[0]).toMatchObject({ rect: { x: 47, y: 47, w: 506, h: 355 }, fit: 'cover', radiusPx: 24, borderPx: 12, borderColor: '#00FF00', elementId: 'photo-0' });
    expect(photos[1]?.rect.y).toBe(mmToPx(38, 300));
    expect(photos[2]?.fit).toBe('contain');
    const date = plan.primitives.find((p) => p.kind === 'text' && p.elementId === 'date');
    expect(date).toMatchObject({ text: '09/09/2026', style: { sizePx: 50, align: 'center', weight: 'normal', fontFamily: 'sans-serif', color: '#000000' } });
  });

  it('ordena por zIndex y luego por aparición', () => {
    const plan = planTemplate(strip, ctx);
    const ids = plan.primitives.map((p) => p.elementId);
    expect(ids[0]).toBe('bg');
    expect(plan.primitives[0]).toMatchObject({ kind: 'fill', color: '#FFFFEE', rect: { x: 0, y: 0, w: 600, h: 1800 } });
    expect(ids.indexOf('frame')).toBeGreaterThan(ids.indexOf('photo-3'));
    expect(ids.indexOf('marks')).toBeGreaterThan(ids.indexOf('frame'));
    expect(ids.indexOf('title')).toBeLessThan(ids.indexOf('photo-0'));
    expect(sortElements(strip.elements).map((e) => e.id)[0]).toBe('bg');
  });

  it('respeta photoCount, tokens ausentes y el texto por locale con caída a español', () => {
    const plan = planTemplate(strip, { ...ctx, photoCount: 2, tokens: {} });
    expect(plan.primitives.filter((p) => p.kind === 'photo')).toHaveLength(2);
    expect(plan.primitives.find((p) => p.kind === 'text' && p.elementId === 'date')).toMatchObject({ text: '' });
    const marks = plan.primitives.find((p) => p.kind === 'cutMarks');
    expect(marks).toMatchObject({ lengthPx: 35 });
    expect(marks?.kind === 'cutMarks' && marks.rects).toHaveLength(2);

    const es = planTemplate(strip, ctx).primitives.find((p) => p.elementId === 'title');
    expect(es).toMatchObject({ kind: 'text', text: 'Hola', style: { sizePx: 58, weight: 'bold', align: 'left' } });
    const legal = planTemplate(strip, { ...ctx, locale: 'en' }).primitives.find((p) => p.elementId === 'legal');
    expect(legal).toMatchObject({ kind: 'text', text: 'Sin validez oficial' });
  });

  it('usa la variante del selector para elementos y lienzo', () => {
    const en = planTemplate(strip, { ...ctx, locale: 'en', selector: { locale: 'en' } });
    expect(en.primitives).toHaveLength(1);
    expect(en.primitives[0]).toMatchObject({ kind: 'text', text: 'Hello variant' });
    const a4 = planTemplate(strip, { ...ctx, selector: { paperSize: 'A4' } });
    expect([a4.widthPx, a4.heightPx]).toEqual([mmToPx(210, 300), mmToPx(297, 300)]);
    expect(a4.widthPx).toBe(2480);
  });

  it('planifica qr, logo, imagen, marco y fondo con sus parámetros', () => {
    const plan = planTemplate(strip, { ...ctx, tokens: { deliveryUrl: 'https://example.test/s/abc' } });
    expect(plan.primitives.find((p) => p.elementId === 'qr')).toMatchObject({ kind: 'qr', payload: 'https://example.test/s/abc' });
    expect(planTemplate(strip, ctx).primitives.find((p) => p.elementId === 'qr')).toMatchObject({ kind: 'qr', payload: 'placeholder' });
    expect(plan.primitives.find((p) => p.elementId === 'logo')).toMatchObject({ kind: 'logo', role: 'brand', fit: 'contain' });
    expect(plan.primitives.find((p) => p.elementId === 'sponsor')).toMatchObject({ kind: 'asset', assetId: 'ast_sponsor', fit: 'contain', opacity: 0.5 });
    expect(plan.primitives.find((p) => p.elementId === 'frame')).toMatchObject({ kind: 'asset', assetId: 'ast_frame', fit: 'contain', opacity: 1 });
  });

  it('acepta un dpi alternativo para previsualizar', () => {
    const plan = planTemplate(strip, { ...ctx, dpi: 100 });
    expect([plan.widthPx, plan.heightPx]).toEqual([200, 600]);
  });
});
