import { describe, expect, it } from 'vitest';
import { createMask, featherMask, maskBounds, maskCoverage, scaleMask } from './mask';
import { MockPersonSegmenter, defaultMaskSize, personSilhouetteMask } from './segmentation';
import type { ImageDataLike, SegmentationMask } from './types';

/** Máscara 4×4 con un bloque de persona 2×2 en el centro. */
function blockMask(): SegmentationMask {
  const mask = createMask(4, 4);
  for (const i of [5, 6, 9, 10]) mask.data[i] = 255;
  return mask;
}

const emptyFrame = (width: number, height: number): ImageDataLike => ({
  data: new Uint8ClampedArray(0),
  width,
  height,
});

describe('maskCoverage y maskBounds', () => {
  it('mide la fracción de persona y su caja normalizada', () => {
    const mask = blockMask();
    expect(maskCoverage(mask)).toBeCloseTo(0.25, 6);
    expect(maskBounds(mask)).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });

  it('sin nadie delante devuelve cobertura cero y ninguna caja', () => {
    const mask = createMask(4, 4);
    expect(maskCoverage(mask)).toBe(0);
    expect(maskBounds(mask)).toBeUndefined();
    expect(maskBounds(createMask(0, 0))).toBeUndefined();
  });
});

describe('scaleMask', () => {
  it('duplica el tamaño conservando la cobertura y la caja', () => {
    const scaled = scaleMask(blockMask(), 8, 8);
    expect(scaled.width).toBe(8);
    expect(scaled.height).toBe(8);
    expect(maskCoverage(scaled)).toBeCloseTo(0.25, 6);
    expect(maskBounds(scaled)).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });

  it('al mismo tamaño devuelve una copia independiente', () => {
    const mask = blockMask();
    const same = scaleMask(mask, 4, 4);
    expect(Array.from(same.data)).toEqual(Array.from(mask.data));
    same.data[0] = 255;
    expect(mask.data[0]).toBe(0);
  });

  it('reduce sin inventar píxeles fuera de la máscara', () => {
    const small = scaleMask(blockMask(), 2, 2);
    expect(small.width).toBe(2);
    expect(Array.from(small.data).every((v) => v === 0 || v === 255)).toBe(true);
  });
});

describe('featherMask', () => {
  it('con radio 0 devuelve una copia binaria', () => {
    const mask = blockMask();
    expect(Array.from(featherMask(mask, 0).data)).toEqual(Array.from(mask.data));
  });

  it('reparte el borde en valores intermedios (deterministas)', () => {
    const soft = featherMask(blockMask(), 1);
    const at = (x: number, y: number) => soft.data[y * 4 + x];
    expect(at(1, 0)).toBe(57); // el borde se derrama hacia el fondo
    expect(at(1, 1)).toBe(113); // el interior deja de estar saturado
    expect(at(0, 0)).toBe(28); // hasta la esquina llega un halo, no un escalón
    expect(Array.from(soft.data).some((v) => v > 0 && v < 255)).toBe(true);
  });
});

describe('personSilhouetteMask', () => {
  it('dibuja una silueta centrada de cabeza y hombros', () => {
    const mask = personSilhouetteMask({ width: 64, height: 64 });
    const bounds = maskBounds(mask);
    expect(bounds).toBeDefined();
    if (!bounds) return;
    expect(bounds.x + bounds.w / 2).toBeCloseTo(0.5, 1);
    // La cabeza empieza arriba y el torso se sale por abajo del cuadro.
    expect(bounds.y).toBeLessThan(0.2);
    expect(bounds.y + bounds.h).toBeCloseTo(1, 1);
    expect(maskCoverage(mask)).toBeGreaterThan(0.2);
  });

  it('acepta posición y tamaño inyectados', () => {
    const base = personSilhouetteMask({ width: 64, height: 64 });
    const left = maskBounds(personSilhouetteMask({ width: 64, height: 64, cx: 0.25 }));
    const bigHead = maskBounds(personSilhouetteMask({ width: 64, height: 64, headHeight: 0.5 }));
    const wide = personSilhouetteMask({ width: 64, height: 64, shoulderWidth: 1 });
    expect(left?.x).toBeLessThan(0.2);
    // Una cabeza más grande empieza más arriba; hombros más anchos ocupan más cuadro.
    expect(bigHead?.y).toBeLessThan(maskBounds(base)?.y ?? 1);
    expect(maskCoverage(wide)).toBeGreaterThan(maskCoverage(base));
  });
});

describe('MockPersonSegmenter', () => {
  it('devuelve la máscara a menor resolución que el cuadro, y siempre la misma', async () => {
    const segmenter = new MockPersonSegmenter();
    await segmenter.init();
    const frame = emptyFrame(640, 480);
    const a = await segmenter.segment(frame, 0);
    const b = await segmenter.segment(frame, 5000);
    expect(defaultMaskSize(frame)).toEqual({ width: 256, height: 192 });
    expect({ width: a.width, height: a.height }).toEqual({ width: 256, height: 192 });
    expect(Array.from(b.data)).toEqual(Array.from(a.data));
    segmenter.dispose();
  });

  it('acepta un guion que mueve la silueta con el tiempo', async () => {
    const segmenter = new MockPersonSegmenter((atMs) => ({ cx: atMs < 1000 ? 0.3 : 0.7 }));
    const frame = emptyFrame(320, 240);
    const early = maskBounds(await segmenter.segment(frame, 0));
    const late = maskBounds(await segmenter.segment(frame, 2000));
    expect(early?.x).toBeLessThan(late?.x ?? 0);
  });
});
