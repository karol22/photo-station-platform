import { DOCUMENT_SAFE_TOOLS } from '@psp/contracts';
import type { EditOp, EditingPreset } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { EDIT_OPS, EDIT_OP_KEYS, TEXT_MAX_SIZE_PX, applyEditOps, editingPresetToOps, expandEditOps, validateEditOps } from './edit-ops';
import { measureText } from './font';
import { createRaster, getPixel, setPixel } from './raster';

const op = (name: string, params: EditOp['params'] = {}): EditOp => ({ op: name, params });

describe('EDIT_OPS', () => {
  it('deriva documentSafe de DOCUMENT_SAFE_TOOLS', () => {
    expect(EDIT_OPS.crop.documentSafe).toBe(true);
    expect(EDIT_OPS.brightness.documentSafe).toBe(true);
    expect(EDIT_OPS.sticker.documentSafe).toBe(false);
    expect(EDIT_OPS.frame.documentSafe).toBe(false);
    for (const key of EDIT_OP_KEYS) expect(EDIT_OPS[key].documentSafe).toBe(DOCUMENT_SAFE_TOOLS.includes(EDIT_OPS[key].tool));
  });
});

describe('validateEditOps', () => {
  it('rechaza stickers cuando sólo se permiten herramientas documentales', () => {
    const result = validateEditOps([op('brightness', { amount: 0.2 }), op('sticker', { assetId: 'ast_1', x: 0, y: 0 })], DOCUMENT_SAFE_TOOLS);
    expect(result.ok).toBe(false);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.op).toBe('sticker');
    expect(result.problems[0]?.reason).toMatch(/not allowed/);
  });

  it('acepta ops documentales con parámetros en rango', () => {
    const result = validateEditOps([op('crop', { x: 0, y: 0, w: 10, h: 10 }), op('levelRotation', { degrees: -3 }), op('grayscale')], DOCUMENT_SAFE_TOOLS);
    expect(result.ok).toBe(true);
    expect(result.rejected).toHaveLength(0);
  });

  it('rechaza parámetros fuera de rango, faltantes o de tipo incorrecto y claves desconocidas', () => {
    const result = validateEditOps([op('brightness', { amount: 3 }), op('crop', { x: 0, y: 0 }), op('rotate', { degrees: 45 }), op('sparkle')], ['brightness', 'crop', 'rotate']);
    expect(result.ok).toBe(false);
    expect(result.rejected).toHaveLength(4);
    expect(result.problems.map((p) => p.reason)).toEqual(expect.arrayContaining([expect.stringMatching(/above 1/), expect.stringMatching(/missing param "w"/), expect.stringMatching(/one of 90\|180\|270/), expect.stringMatching(/unknown op/)]));
  });
});

describe('applyEditOps', () => {
  const photo = createRaster(2, 1, [255, 255, 255, 255]);
  setPixel(photo, 0, 0, [255, 0, 0, 255]);

  it('aplica en orden y devuelve un raster nuevo', () => {
    const out = applyEditOps(photo, [op('mirror'), op('grayscale')]);
    expect(out).not.toBe(photo);
    expect(getPixel(out, 1, 0)).toEqual([54, 54, 54, 255]);
    expect(getPixel(out, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(getPixel(photo, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('recorta valores fuera de rango, omite overlays sin activo y lanza ante claves desconocidas', () => {
    expect(getPixel(applyEditOps(photo, [op('brightness', { amount: 5 })]), 0, 0)).toEqual([255, 255, 255, 255]);
    expect(applyEditOps(photo, [op('sticker', { assetId: 'ast_missing', x: 0, y: 0 })]).data).toEqual(photo.data);
    expect(() => applyEditOps(photo, [op('sparkle')])).toThrow(/unknown op/);
  });

  it('compone un sticker con su activo', () => {
    const sticker = createRaster(1, 1, [0, 0, 255, 255]);
    const out = applyEditOps(photo, [op('sticker', { assetId: 'ast_dot', x: 1, y: 0 })], { assets: { ast_dot: sticker } });
    expect(getPixel(out, 1, 0)).toEqual([0, 0, 255, 255]);
  });

  it('expande presets un solo nivel', () => {
    const preset = { id: 'edp_bw', ops: [{ op: 'grayscale', params: {} }, { op: 'preset', params: { presetId: 'edp_bw' } }] } as unknown as EditingPreset;
    expect(editingPresetToOps(preset)).toEqual([op('grayscale'), op('preset', { presetId: 'edp_bw' })]);
    expect(expandEditOps([op('preset', { presetId: 'edp_bw' })], { edp_bw: preset })).toEqual([op('grayscale')]);
    expect(expandEditOps([op('preset', { presetId: 'edp_none' })], {})).toEqual([]);
    expect(getPixel(applyEditOps(photo, [op('preset', { presetId: 'edp_bw' })], { presets: { edp_bw: preset } }), 0, 0)).toEqual([54, 54, 54, 255]);
  });
});

describe('texto sobre la foto', () => {
  const white = () => createRaster(160, 90, [255, 255, 255, 255]);
  const hasColor = (r: ReturnType<typeof createRaster>, rgb: [number, number, number]): boolean => {
    for (let i = 0; i < r.data.length; i += 4) {
      if (r.data[i] === rgb[0] && r.data[i + 1] === rgb[1] && r.data[i + 2] === rgb[2]) return true;
    }
    return false;
  };

  it('admite letras del tamaño de una foto de cabina, no de veinte píxeles', () => {
    expect(EDIT_OPS.text.params['sizePx']?.max).toBe(TEXT_MAX_SIZE_PX);
    expect(validateEditOps([op('text', { text: 'ANA', x: 10, y: 10, sizePx: 140 })], ['text']).ok).toBe(true);
    // Y lo que ya existía sigue validando igual.
    expect(validateEditOps([op('text', { text: 'ANA', x: 10, y: 10, sizePx: 14 })], ['text']).ok).toBe(true);
    expect(validateEditOps([op('text', { text: 'ANA', x: 10, y: 10, sizePx: 900 })], ['text']).ok).toBe(false);
  });

  it('sigue sin ser una herramienta documental', () => {
    expect(EDIT_OPS.text.documentSafe).toBe(false);
    expect(validateEditOps([op('text', { text: 'ANA', x: 0, y: 0, sizePx: 60 })], DOCUMENT_SAFE_TOOLS).ok).toBe(false);
  });

  it('con contorno el nombre se lee sobre un fondo de su mismo color', () => {
    const sinContorno = applyEditOps(white(), [op('text', { text: 'ANA', x: 8, y: 8, sizePx: 35, color: '#FFFFFF' })]);
    expect(sinContorno.data).toEqual(white().data);
    const conContorno = applyEditOps(white(), [
      op('text', { text: 'ANA', x: 8, y: 8, sizePx: 35, color: '#FFFFFF', outlineColor: '#101010', outlineWidth: 3 }),
    ]);
    expect(hasColor(conContorno, [16, 16, 16])).toBe(true);
  });

  it('centra el bloque cuando el ancla es el centro', () => {
    // 'I' a escala 4 (sizePx 28, siete píxeles por unidad) mide 20×28 px con la fuente interna:
    // centrado en (80, 44) es exactamente lo mismo que colocado por su esquina en (70, 30).
    expect(measureText('I', 4)).toEqual({ width: 20, height: 28 });
    const centrado = applyEditOps(white(), [op('text', { text: 'I', x: 80, y: 44, sizePx: 28, color: '#000000', anchor: 'center' })]);
    const esquina = applyEditOps(white(), [op('text', { text: 'I', x: 70, y: 30, sizePx: 28, color: '#000000' })]);
    expect(centrado.data).toEqual(esquina.data);
  });

  it('gira el texto con el ángulo pedido', () => {
    const recto = applyEditOps(white(), [op('text', { text: 'ANA', x: 40, y: 30, sizePx: 35, color: '#000000' })]);
    const girado = applyEditOps(white(), [op('text', { text: 'ANA', x: 40, y: 30, sizePx: 35, color: '#000000', angle: 25 })]);
    expect(girado.data).not.toEqual(recto.data);
    expect(hasColor(girado, [0, 0, 0])).toBe(true);
  });

  it('usa el rasterizador inyectado cuando lo hay y cae a la fuente interna cuando no', () => {
    const seen: string[] = [];
    const rasterizer = (spec: { text: string; sizePx: number; bold: boolean }) => {
      seen.push(`${spec.text}:${spec.sizePx}:${spec.bold ? 'bold' : 'regular'}`);
      return createRaster(4, 4, [0, 128, 255, 255]);
    };
    const out = applyEditOps(white(), [op('text', { text: 'ANA', x: 20, y: 20, sizePx: 140, weight: 'bold' })], { textRasterizer: rasterizer });
    expect(seen).toEqual(['ANA:140:bold']);
    expect(getPixel(out, 21, 21)).toEqual([0, 128, 255, 255]);
    // Un rasterizador que no puede no rompe nada: se dibuja con la fuente interna.
    const fallback = applyEditOps(white(), [op('text', { text: 'ANA', x: 20, y: 20, sizePx: 35, color: '#000000' })], { textRasterizer: () => undefined });
    expect(hasColor(fallback, [0, 0, 0])).toBe(true);
  });
});

describe('overlays girados y centrados', () => {
  const base = () => createRaster(21, 21, [255, 255, 255, 255]);
  const asset = createRaster(5, 5, [0, 0, 0, 255]);

  it('centra el activo cuando el ancla es el centro', () => {
    const centrado = applyEditOps(base(), [op('sticker', { assetId: 'ast_1', x: 10, y: 10, anchor: 'center' })], { assets: { ast_1: asset } });
    const esquina = applyEditOps(base(), [op('sticker', { assetId: 'ast_1', x: 8, y: 8 })], { assets: { ast_1: asset } });
    expect(centrado.data).toEqual(esquina.data);
  });

  it('gira el activo, que antes se perdía entre la vista previa y la composición', () => {
    const recto = applyEditOps(base(), [op('sticker', { assetId: 'ast_1', x: 8, y: 8 })], { assets: { ast_1: asset } });
    const girado = applyEditOps(base(), [op('sticker', { assetId: 'ast_1', x: 8, y: 8, angle: 45 })], { assets: { ast_1: asset } });
    expect(girado.data).not.toEqual(recto.data);
    // La punta del cuadrado girado sale del rect original: en (10, 7) el recto es blanco y el
    // girado ya está pintado.
    expect(getPixel(recto, 10, 7)).toEqual([255, 255, 255, 255]);
    expect(getPixel(girado, 10, 7)).toEqual([0, 0, 0, 255]);
  });

  it('sin ángulo el resultado es idéntico al de antes', () => {
    const conParametro = applyEditOps(base(), [op('sticker', { assetId: 'ast_1', x: 3, y: 4, angle: 0, anchor: 'topLeft' })], { assets: { ast_1: asset } });
    const sinParametro = applyEditOps(base(), [op('sticker', { assetId: 'ast_1', x: 3, y: 4 })], { assets: { ast_1: asset } });
    expect(conParametro.data).toEqual(sinParametro.data);
  });
});
