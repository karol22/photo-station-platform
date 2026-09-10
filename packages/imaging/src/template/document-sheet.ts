/**
 * Hoja documental: empaqueta N copias de una foto de documento (en mm) en el lienzo de la plantilla.
 * Prueba la orientación natural y la girada 90°, se queda con la que más copias admite, centra la grilla
 * y añade marcas de corte alrededor de cada copia.
 */
import type { PrintTemplate } from '@psp/contracts';
import { mmToPx, mmToPxExact } from '../primitives';
import type { DocumentSheetOptions, DocumentSheetPlan, Primitive } from '../primitives';
import { normalizeRect } from '../raster';
import type { Rect } from '../raster';

export const DOCUMENT_SHEET_MARGIN_MM = 3;
export const DOCUMENT_SHEET_CUT_MARK_MM = 3;

type Layout = { cols: number; rows: number; fitted: number; photoW: number; photoH: number; rotated: boolean };

function layoutFor(sheetW: number, sheetH: number, photoW: number, photoH: number, gutter: number, margin: number, rotated: boolean): Layout {
  const usableW = sheetW - 2 * margin;
  const usableH = sheetH - 2 * margin;
  const cols = photoW <= 0 ? 0 : Math.max(0, Math.floor((usableW + gutter + 1e-9) / (photoW + gutter)));
  const rows = photoH <= 0 ? 0 : Math.max(0, Math.floor((usableH + gutter + 1e-9) / (photoH + gutter)));
  return { cols, rows, fitted: cols * rows, photoW, photoH, rotated };
}

export function planDocumentSheet(
  template: PrintTemplate,
  photo: { widthMm: number; heightMm: number },
  copies: number,
  opts: DocumentSheetOptions = {},
): DocumentSheetPlan {
  const dpi = opts.dpi ?? template.canvas.dpi ?? 300;
  const sheetW = template.canvas.widthMm;
  const sheetH = template.canvas.heightMm;
  const gutter = Math.max(0, opts.gutterMm ?? template.documentSheet?.gutterMm ?? 2);
  const margin = Math.max(0, opts.marginMm ?? DOCUMENT_SHEET_MARGIN_MM);
  const wantCutMarks = opts.cutMarks ?? template.documentSheet?.cutMarks ?? true;

  const natural = layoutFor(sheetW, sheetH, photo.widthMm, photo.heightMm, gutter, margin, false);
  const turned = layoutFor(sheetW, sheetH, photo.heightMm, photo.widthMm, gutter, margin, true);
  const wanted = Math.max(0, Math.floor(copies));
  // Orientación natural salvo que girar permita caber las copias pedidas y la natural no.
  const layout = natural.fitted >= wanted || natural.fitted >= turned.fitted ? natural : turned;

  const widthPx = Math.max(1, mmToPx(sheetW, dpi));
  const heightPx = Math.max(1, mmToPx(sheetH, dpi));
  const count = Math.min(wanted, layout.fitted);
  const sheets = layout.fitted === 0 || wanted === 0 ? 0 : Math.ceil(wanted / layout.fitted);

  const primitives: Primitive[] = [{ kind: 'fill', rect: { x: 0, y: 0, w: widthPx, h: heightPx }, color: '#FFFFFF' }];
  const rects: Rect[] = [];
  if (count > 0) {
    const usedCols = Math.min(count, layout.cols);
    const usedRows = Math.ceil(count / layout.cols);
    const gridW = usedCols * layout.photoW + (usedCols - 1) * gutter;
    const gridH = usedRows * layout.photoH + (usedRows - 1) * gutter;
    const x0 = (sheetW - gridW) / 2;
    const y0 = (sheetH - gridH) / 2;
    for (let i = 0; i < count; i++) {
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);
      const xMm = x0 + col * (layout.photoW + gutter);
      const yMm = y0 + row * (layout.photoH + gutter);
      const rect = normalizeRect({ x: mmToPxExact(xMm, dpi), y: mmToPxExact(yMm, dpi), w: mmToPxExact(layout.photoW, dpi), h: mmToPxExact(layout.photoH, dpi) });
      rects.push(rect);
      const primitive: Primitive = { kind: 'photo', rect, slotIndex: 0, fit: 'cover', radiusPx: 0, borderPx: 0, borderColor: '#FFFFFF' };
      if (layout.rotated) primitive.rotationDeg = 90;
      primitives.push(primitive);
    }
    if (wantCutMarks) primitives.push({ kind: 'cutMarks', rects, lengthPx: mmToPx(DOCUMENT_SHEET_CUT_MARK_MM, dpi) });
  }

  return {
    plan: { widthPx, heightPx, dpi, primitives },
    fitted: layout.fitted,
    sheets,
    rows: layout.rows,
    cols: layout.cols,
    rotated: layout.rotated,
  };
}
