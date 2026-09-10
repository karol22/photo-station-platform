import { DOCUMENT_SAFE_TOOLS } from '@psp/contracts';
import type { EditOp, EditingPreset } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { EDIT_OPS, EDIT_OP_KEYS, applyEditOps, editingPresetToOps, expandEditOps, validateEditOps } from './edit-ops';
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
