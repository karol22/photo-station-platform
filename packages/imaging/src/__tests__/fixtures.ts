/** Plantillas de prueba compartidas. Se construyen con `PrintTemplate.parse` para heredar los valores por defecto del contrato. */
import { PrintTemplate } from '@psp/contracts';

const PHOTO_BOX = (i: number) => ({ x: 4, y: 4 + i * 34, w: 42.8, h: 30 });

/** Tira 2×6 in (50.8×152.4 mm) con 4 fotos, fecha, título, QR y marcas; variantes por locale y papel. */
export function stripTemplate() {
  return PrintTemplate.parse({
    id: 'tpl_strip_test',
    name: { es: 'Tira de prueba' },
    kind: 'strip_vertical',
    paperSize: '2x6in-strip',
    canvas: { widthMm: 50.8, heightMm: 152.4, dpi: 300 },
    orientation: 'portrait',
    photoSlots: 4,
    createdAt: '2026-01-01T00:00:00Z',
    elements: [
      { id: 'title', type: 'text', box: { x: 4, y: 139, w: 42.8, h: 5 }, content: { es: 'Hola', en: 'Hello' }, style: { sizePt: 14, weight: 'bold', align: 'left' } },
      { id: 'photo-0', type: 'photo', box: PHOTO_BOX(0), slotIndex: 0, cornerRadiusMm: 2, borderMm: 1, borderColor: '#00FF00' },
      { id: 'photo-1', type: 'photo', box: PHOTO_BOX(1), slotIndex: 1 },
      { id: 'photo-2', type: 'photo', box: PHOTO_BOX(2), slotIndex: 2, fit: 'contain' },
      { id: 'photo-3', type: 'photo', box: PHOTO_BOX(3), slotIndex: 3 },
      { id: 'date', type: 'token', token: 'date', box: { x: 4, y: 145, w: 42.8, h: 4 }, style: { sizePt: 12 } },
      { id: 'legal', type: 'disclaimer', box: { x: 4, y: 149.5, w: 30, h: 2.5 }, content: { es: 'Sin validez oficial' } },
      { id: 'qr', type: 'qr', box: { x: 36, y: 144, w: 10, h: 10 }, payloadToken: 'deliveryUrl' },
      { id: 'logo', type: 'logo', box: { x: 4, y: 0.5, w: 20, h: 3 }, role: 'brand' },
      { id: 'sponsor', type: 'image', box: { x: 26, y: 0.5, w: 20, h: 3 }, assetId: 'ast_sponsor', opacity: 0.5 },
      { id: 'frame', type: 'frame', box: { x: 0, y: 0, w: 50.8, h: 152.4 }, assetId: 'ast_frame', zIndex: 5 },
      { id: 'marks', type: 'cutMarks', box: { x: 0, y: 0, w: 1, h: 1 }, lengthMm: 3, zIndex: 10 },
      { id: 'bg', type: 'background', box: { x: 0, y: 0, w: 50.8, h: 152.4 }, color: '#FFFFEE', zIndex: -10 },
    ],
    variants: [
      { key: 'en-a4', selector: { locale: 'en', paperSize: 'A4' }, canvas: { widthMm: 210, heightMm: 297 } },
      { key: 'en', selector: { locale: 'en' }, elements: [{ id: 'title-en', type: 'text', box: { x: 4, y: 139, w: 42.8, h: 5 }, content: { es: 'Hola variante', en: 'Hello variant' } }] },
      { key: 'a4', selector: { paperSize: 'A4' }, canvas: { widthMm: 210, heightMm: 297 } },
    ],
  });
}

/** Hoja documental 4×6 in (101.6×152.4 mm) a 300 dpi. */
export function sheetTemplate(overrides: Record<string, unknown> = {}) {
  return PrintTemplate.parse({
    id: 'tpl_sheet_test',
    name: { es: 'Hoja documental 4×6' },
    kind: 'document_sheet',
    paperSize: '4x6in',
    canvas: { widthMm: 101.6, heightMm: 152.4, dpi: 300 },
    orientation: 'portrait',
    photoSlots: 1,
    elements: [],
    createdAt: '2026-01-01T00:00:00Z',
    documentSheet: { photoWidthMm: 35, photoHeightMm: 45, gutterMm: 2, cutMarks: true },
    ...overrides,
  });
}
