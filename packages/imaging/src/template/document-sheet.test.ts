import { describe, expect, it } from 'vitest';
import { sheetTemplate } from '../__tests__/fixtures';
import { intersectRect } from '../raster';
import type { Rect } from '../raster';
import { planDocumentSheet } from './document-sheet';

const photoRects = (plan: { primitives: Array<{ kind: string; rect?: Rect }> }): Rect[] => plan.primitives.filter((p) => p.kind === 'photo').map((p) => p.rect as Rect);

describe('planDocumentSheet', () => {
  const sheet = sheetTemplate();

  it('35×45 mm en 4×6 in: caben al menos 6 copias, con marcas de corte', () => {
    const { plan, fitted, sheets, rotated, rows, cols } = planDocumentSheet(sheet, { widthMm: 35, heightMm: 45 }, 4, { gutterMm: 2 });
    expect(fitted).toBeGreaterThanOrEqual(6);
    expect(fitted).toBe(rows * cols);
    expect(sheets).toBe(1);
    expect([plan.widthPx, plan.heightPx, plan.dpi]).toEqual([1200, 1800, 300]);
    const photos = plan.primitives.filter((p) => p.kind === 'photo');
    expect(photos).toHaveLength(4);
    for (const p of photos) expect(p).toMatchObject({ slotIndex: 0, fit: 'cover', ...(rotated ? { rotationDeg: 90 } : {}) });
    const marks = plan.primitives.find((p) => p.kind === 'cutMarks');
    expect(marks?.kind === 'cutMarks' && marks.rects).toHaveLength(4);
    expect(marks).toMatchObject({ lengthPx: 35 });
    expect(plan.primitives[0]).toMatchObject({ kind: 'fill', color: '#FFFFFF' });
  });

  it('elige la orientación que más copias admite y gira la foto', () => {
    const { fitted, rotated } = planDocumentSheet(sheet, { widthMm: 35, heightMm: 45 }, 8);
    expect(rotated).toBe(true);
    expect(fitted).toBe(8);
  });

  it('respeta margen de 3 mm, sin solapes y centrado', () => {
    const { plan, fitted } = planDocumentSheet(sheet, { widthMm: 35, heightMm: 45 }, 100);
    const rects = photoRects(plan);
    expect(rects).toHaveLength(fitted);
    const margin = 35; // 3 mm a 300 dpi
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(margin);
      expect(r.y).toBeGreaterThanOrEqual(margin);
      expect(r.x + r.w).toBeLessThanOrEqual(plan.widthPx - margin);
      expect(r.y + r.h).toBeLessThanOrEqual(plan.heightPx - margin);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(intersectRect(rects[i]!, rects[j]!)).toBeUndefined();
    const minX = Math.min(...rects.map((r) => r.x));
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxY = Math.max(...rects.map((r) => r.y + r.h));
    expect(Math.abs(minX - (plan.widthPx - maxX))).toBeLessThanOrEqual(1);
    expect(Math.abs(minY - (plan.heightPx - maxY))).toBeLessThanOrEqual(1);
  });

  it('visa 51×51 mm: al menos 2 copias por hoja y varias hojas si hacen falta', () => {
    const result = planDocumentSheet(sheet, { widthMm: 51, heightMm: 51 }, 6);
    expect(result.fitted).toBeGreaterThanOrEqual(2);
    expect(result.rotated).toBe(false);
    expect(result.sheets).toBe(Math.ceil(6 / result.fitted));
    expect(photoRects(result.plan)).toHaveLength(result.fitted);
  });

  it('las opciones y la plantilla controlan gutter y marcas', () => {
    const noMarks = planDocumentSheet(sheet, { widthMm: 35, heightMm: 45 }, 2, { cutMarks: false });
    expect(noMarks.plan.primitives.some((p) => p.kind === 'cutMarks')).toBe(false);
    const templateNoMarks = planDocumentSheet(sheetTemplate({ documentSheet: { photoWidthMm: 35, photoHeightMm: 45, gutterMm: 2, cutMarks: false } }), { widthMm: 35, heightMm: 45 }, 2);
    expect(templateNoMarks.plan.primitives.some((p) => p.kind === 'cutMarks')).toBe(false);
    const wide = planDocumentSheet(sheet, { widthMm: 35, heightMm: 45 }, 2, { gutterMm: 20 });
    expect(wide.fitted).toBeLessThan(planDocumentSheet(sheet, { widthMm: 35, heightMm: 45 }, 2).fitted);
  });

  it('foto más grande que la hoja: nada cabe y no hay hojas', () => {
    const result = planDocumentSheet(sheet, { widthMm: 300, heightMm: 300 }, 2);
    expect(result.fitted).toBe(0);
    expect(result.sheets).toBe(0);
    expect(result.plan.primitives).toHaveLength(1);
  });
});
