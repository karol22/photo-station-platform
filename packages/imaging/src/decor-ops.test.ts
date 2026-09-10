import { describe, expect, it } from 'vitest';
import { anchorToStickerOp, captionLayout, captionOp } from './decor-ops';
import { EDIT_OPS, applyEditOps, validateEditOps } from './edit-ops';
import { createRaster, getPixel } from './raster';

describe('anchorToStickerOp', () => {
  const anchor = { x: 0.5, y: 0.25, width: 0.4, height: 0.2, angleDeg: 12.34 };

  it('pasa el ancla normalizada a píxeles de la foto y la deja centrada', () => {
    const op = anchorToStickerOp('ast_hat', anchor, { width: 1000, height: 800 });
    expect(op.params).toEqual({ assetId: 'ast_hat', x: 500, y: 200, w: 400, h: 160, angle: 12.3, anchor: 'center' });
  });

  it('produce una op que el pipeline valida y aplica', () => {
    const op = anchorToStickerOp('ast_hat', anchor, { width: 20, height: 20 });
    expect(validateEditOps([op], ['stickers']).ok).toBe(true);
    const photo = createRaster(20, 20, [255, 255, 255, 255]);
    const asset = createRaster(4, 4, [255, 0, 0, 255]);
    // Centrada en (10, 5): el píxel del centro queda pintado.
    expect(getPixel(applyEditOps(photo, [op], { assets: { ast_hat: asset } }), 10, 5)).toEqual([255, 0, 0, 255]);
  });

  it('nunca produce una caja de lado cero', () => {
    const op = anchorToStickerOp('ast_x', { ...anchor, width: 0.0001, height: 0.0001 }, { width: 100, height: 100 });
    expect(op.params['w']).toBe(1);
    expect(op.params['h']).toBe(1);
  });
});

describe('captionLayout', () => {
  it('pone el nombre abajo, centrado y legible', () => {
    const l = captionLayout({ width: 1200, height: 1600 });
    expect(l.x).toBe(600);
    expect(l.y).toBe(1392);
    expect(l.sizePx).toBe(136);
    expect(l.outlineWidth).toBe(10);
  });

  it('nunca pasa del tamaño que la operación admite ni baja de lo legible', () => {
    expect(captionLayout({ width: 40, height: 40 }).sizePx).toBe(8);
    expect(captionLayout({ width: 12000, height: 16000 }).sizePx).toBe(EDIT_OPS.text.params['sizePx']?.max);
  });
});

describe('captionOp', () => {
  const layout = captionLayout({ width: 600, height: 800 });

  it('arma una op de texto válida, centrada y con contorno', () => {
    const op = captionOp('  ANA  ', layout, { color: '#FF6FA5' })!;
    expect(op.params['text']).toBe('ANA');
    expect(op.params['anchor']).toBe('center');
    expect(op.params['align']).toBe('center');
    expect(op.params['outlineWidth']).toBe(layout.outlineWidth);
    expect(validateEditOps([op], ['text']).ok).toBe(true);
  });

  it('un texto vacío no produce nada', () => {
    expect(captionOp('   ', layout, { color: '#FFFFFF' })).toBeUndefined();
  });

  it('no lleva tipografía salvo que la marca la pida', () => {
    expect(captionOp('ANA', layout, { color: '#FFFFFF' })!.params['font']).toBeUndefined();
    expect(captionOp('ANA', layout, { color: '#FFFFFF', font: 'Fraunces' })!.params['font']).toBe('Fraunces');
  });
});
