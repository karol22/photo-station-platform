/** Plantillas de impresión. Toda `BoxMm` cae dentro del lienzo (lo verifica la prueba). */
import { PrintTemplate, type TemplateElement } from '@psp/contracts';
import { DEMO_IDS } from '../ids';
import { L, audit } from './common';

const ID = DEMO_IDS;
const T = ID.template;

const IN = 25.4;
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotationDeg: 0 });

function sheet(id: string, name: [string, string], paper: '4x6in' | '5x7in', photoW: number, photoH: number): PrintTemplate {
  const canvas = paper === '4x6in' ? { widthMm: 4 * IN, heightMm: 6 * IN, dpi: 300 } : { widthMm: 5 * IN, heightMm: 7 * IN, dpi: 300 };
  const gutter = 2;
  const cols = Math.floor((canvas.widthMm - gutter) / (photoW + gutter));
  const rows = Math.floor((canvas.heightMm - gutter) / (photoH + gutter));
  return PrintTemplate.parse({
    id, organizationId: undefined, name: L(name[0], name[1]), kind: 'document_sheet', paperSize: paper, canvas, orientation: 'portrait',
    photoSlots: cols * rows,
    elements: [
      { id: 'bg', type: 'background', box: box(0, 0, canvas.widthMm, canvas.heightMm), color: '#FFFFFF', zIndex: 0 },
      { id: 'cut', type: 'cutMarks', box: box(0, 0, canvas.widthMm, canvas.heightMm), lengthMm: 3, zIndex: 10 },
    ] satisfies TemplateElement[],
    documentSheet: { photoWidthMm: photoW, photoHeightMm: photoH, gutterMm: gutter, cutMarks: true },
    tags: ['document', paper], ...audit(ID.user.owner),
  });
}

export function buildTemplates(): PrintTemplate[] {
  const strip = { widthMm: 2 * IN, heightMm: 6 * IN, dpi: 300 };
  const p4x6 = { widthMm: 4 * IN, heightMm: 6 * IN, dpi: 300 };
  const p5x7 = { widthMm: 5 * IN, heightMm: 7 * IN, dpi: 300 };
  const thermal = { widthMm: 58, heightMm: 90, dpi: 203 };
  const stripPhotos = (locale: 'es' | 'en'): TemplateElement[] => [
    { id: 'bg', type: 'background', box: box(0, 0, strip.widthMm, strip.heightMm), color: '#FFFFFF', zIndex: 0 },
    ...[0, 1, 2, 3].map((i): TemplateElement => ({ id: `photo${i}`, type: 'photo', slotIndex: i, box: box(3, 4 + i * 33, 44.8, 30), fit: 'cover', borderMm: 0, borderColor: '#FFFFFF', cornerRadiusMm: 1, zIndex: 1 })),
    { id: 'logo', type: 'logo', role: 'brand', box: box(8, 136, 34.8, 9), fit: 'contain', zIndex: 2 },
    { id: 'date', type: 'token', token: 'date', box: box(3, 146, 44.8, 4), style: { fontFamily: 'sans-serif', sizePt: 7, color: '#0B1B3F', align: 'center', weight: 'normal' }, format: locale === 'es' ? 'dd/MM/yyyy' : 'MM/dd/yyyy', zIndex: 2 },
  ];
  return [
    sheet(T.sheet4x6, ['Hoja documental 4x6 (35x45)', 'Document sheet 4x6 (35x45)'], '4x6in', 35, 45),
    sheet(T.sheet5x7, ['Hoja documental 5x7 (50x70)', 'Document sheet 5x7 (50x70)'], '5x7in', 50, 70),
    sheet(T.sheet4x6Visa, ['Hoja documental 4x6 (51x51)', 'Document sheet 4x6 (51x51)'], '4x6in', 51, 51),
    sheet(T.sheet4x6Credential, ['Hoja documental 4x6 (25x30)', 'Document sheet 4x6 (25x30)'], '4x6in', 25, 30),
    PrintTemplate.parse({
      id: T.strip2x6, organizationId: ID.org.lumina, name: L('Tira 2x6 cuatro fotos', '2x6 strip, four photos'), kind: 'strip_vertical', paperSize: '2x6in-strip', canvas: strip, orientation: 'portrait', photoSlots: 4,
      elements: stripPhotos('es'),
      variants: [{ key: 'en', selector: { locale: 'en' }, elements: stripPhotos('en') }],
      tags: ['strip', 'fun'], ...audit(ID.user.adminLumina),
    }),
    PrintTemplate.parse({
      id: T.grid4x6, organizationId: ID.org.lumina, name: L('Cuadrícula 4x6 cuatro fotos', '4x6 grid, four photos'), kind: 'grid', paperSize: '4x6in', canvas: p4x6, orientation: 'portrait', photoSlots: 4,
      elements: [
        { id: 'bg', type: 'background', box: box(0, 0, p4x6.widthMm, p4x6.heightMm), color: '#FFFFFF', zIndex: 0 },
        ...[0, 1, 2, 3].map((i): TemplateElement => ({ id: `photo${i}`, type: 'photo', slotIndex: i, box: box(4 + (i % 2) * 48.8, 4 + Math.floor(i / 2) * 64, 44.8, 60), fit: 'cover', borderMm: 0, borderColor: '#FFFFFF', cornerRadiusMm: 0, zIndex: 1 })),
        { id: 'logo', type: 'logo', role: 'brand', box: box(30, 134, 41.6, 12), fit: 'contain', zIndex: 2 },
      ] satisfies TemplateElement[],
      tags: ['grid', 'birthday'], ...audit(ID.user.adminLumina),
    }),
    PrintTemplate.parse({
      id: T.single4x6, organizationId: ID.org.lumina, name: L('Foto sencilla 4x6', 'Single 4x6 photo'), kind: 'single', paperSize: '4x6in', canvas: p4x6, orientation: 'portrait', photoSlots: 1,
      elements: [
        { id: 'bg', type: 'background', box: box(0, 0, p4x6.widthMm, p4x6.heightMm), color: '#FFFFFF', zIndex: 0 },
        { id: 'photo0', type: 'photo', slotIndex: 0, box: box(4, 4, 93.6, 124), fit: 'cover', borderMm: 0, borderColor: '#FFFFFF', cornerRadiusMm: 0, zIndex: 1 },
        { id: 'logo', type: 'logo', role: 'brand', box: box(30, 131, 41.6, 10), fit: 'contain', zIndex: 2 },
        { id: 'location', type: 'token', token: 'locationName', box: box(4, 143, 93.6, 5), style: { fontFamily: 'sans-serif', sizePt: 8, color: '#0B1B3F', align: 'center', weight: 'normal' }, zIndex: 2 },
      ] satisfies TemplateElement[],
      tags: ['single', 'portrait'], ...audit(ID.user.adminLumina),
    }),
    PrintTemplate.parse({
      id: T.thermal58, organizationId: ID.org.lumina, name: L('Ticket térmico 58 mm', '58 mm thermal ticket'), kind: 'thermal_receipt', paperSize: '58mm-thermal', canvas: thermal, orientation: 'portrait', photoSlots: 1,
      elements: [
        { id: 'photo0', type: 'photo', slotIndex: 0, box: box(3, 3, 52, 52), fit: 'cover', borderMm: 0, borderColor: '#FFFFFF', cornerRadiusMm: 0, zIndex: 1 },
        { id: 'caption', type: 'text', content: L('Gracias por tu visita', 'Thanks for visiting'), box: box(3, 58, 52, 8), style: { fontFamily: 'monospace', sizePt: 9, color: '#000000', align: 'center', weight: 'bold' }, zIndex: 2 },
        { id: 'code', type: 'token', token: 'sessionCode', box: box(3, 68, 52, 6), style: { fontFamily: 'monospace', sizePt: 8, color: '#000000', align: 'center', weight: 'normal' }, zIndex: 2 },
        { id: 'date', type: 'token', token: 'date', box: box(3, 76, 52, 6), style: { fontFamily: 'monospace', sizePt: 7, color: '#000000', align: 'center', weight: 'normal' }, format: 'dd/MM/yyyy', zIndex: 2 },
      ] satisfies TemplateElement[],
      tags: ['thermal', 'receipt'], ...audit(ID.user.adminLumina),
    }),
    PrintTemplate.parse({
      id: T.postcard5x7, organizationId: ID.org.lumina, name: L('Postal navideña 5x7', 'Christmas postcard 5x7'), kind: 'postcard', paperSize: '5x7in', canvas: p5x7, orientation: 'portrait', photoSlots: 1,
      elements: [
        { id: 'bg', type: 'background', box: box(0, 0, p5x7.widthMm, p5x7.heightMm), color: '#FFF8F0', zIndex: 0 },
        { id: 'photo0', type: 'photo', slotIndex: 0, box: box(6, 6, 115, 140), fit: 'cover', borderMm: 0, borderColor: '#FFFFFF', cornerRadiusMm: 0, zIndex: 1 },
        { id: 'frame', type: 'frame', assetId: ID.asset.frameChristmas, box: box(0, 0, p5x7.widthMm, p5x7.heightMm), zIndex: 3 },
        { id: 'sponsor', type: 'logo', role: 'sponsor', box: box(6, 150, 50, 18), fit: 'contain', zIndex: 2 },
        { id: 'brand', type: 'logo', role: 'brand', box: box(71, 150, 50, 18), fit: 'contain', zIndex: 2 },
        { id: 'greeting', type: 'text', content: L('Felices fiestas', 'Happy holidays'), box: box(6, 170, 115, 6), style: { fontFamily: 'serif', sizePt: 10, color: '#B3001B', align: 'center', weight: 'bold' }, zIndex: 2 },
      ] satisfies TemplateElement[],
      tags: ['postcard', 'navidad'], ...audit(ID.user.adminLumina),
    }),
  ];
}
