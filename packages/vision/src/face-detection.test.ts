import { describe, expect, it } from 'vitest';
import { MockFaceDetector, groupFraming } from './face-detection';
import type { Box, ImageDataLike } from './types';

const FRAME = { width: 640, height: 480 };
const frame: ImageDataLike = { data: new Uint8ClampedArray(0), ...FRAME };

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

describe('groupFraming', () => {
  it('sin rostros no inventa un encuadre', () => {
    expect(groupFraming([], FRAME)).toEqual({ box: box(0, 0, 0, 0), advice: 'nobody' });
  });

  it('con un rostro bien plantado deja el encuadre en paz', () => {
    const result = groupFraming([box(0.35, 0.3, 0.3, 0.4)], FRAME);
    expect(result.advice).toBe('ok');
    // La caja rodea al rostro con margen y cabe en el cuadro.
    expect(result.box.x).toBeCloseTo(0.245, 3);
    expect(result.box.w).toBeCloseTo(0.51, 3);
    expect(result.box.x + result.box.w).toBeLessThanOrEqual(1);
    expect(result.box.y + result.box.h).toBeLessThanOrEqual(1);
  });

  it('con tres rostros abarca a todo el grupo', () => {
    const faces = [box(0.25, 0.32, 0.1, 0.16), box(0.45, 0.32, 0.1, 0.16), box(0.65, 0.32, 0.1, 0.16)];
    const result = groupFraming(faces, FRAME);
    expect(result.advice).toBe('ok');
    expect(result.box.x).toBeLessThanOrEqual(0.25);
    expect(result.box.x + result.box.w).toBeGreaterThanOrEqual(0.75);
  });

  it('un grupo que ya no cabe pide retroceder, y la caja se recorta al cuadro', () => {
    const faces = [box(0.02, 0.3, 0.14, 0.2), box(0.43, 0.28, 0.14, 0.2), box(0.84, 0.3, 0.14, 0.2)];
    const result = groupFraming(faces, FRAME);
    expect(result.advice).toBe('step_back');
    // La caja se recorta al cuadro: que el grupo no quepa se dice en `advice`, no se esconde.
    expect(result.box.x).toBe(0);
    expect(result.box.w).toBe(1);
    expect(result.box.y).toBe(0);
    expect(result.box.h).toBeCloseTo(0.948, 3);
  });

  it('un rostro diminuto pide acercarse y uno de lado pide centrarse', () => {
    expect(groupFraming([box(0.47, 0.45, 0.06, 0.08)], FRAME).advice).toBe('step_closer');
    expect(groupFraming([box(0.05, 0.3, 0.3, 0.4)], FRAME).advice).toBe('move_center');
  });

  it('los umbrales son ajustables sin tocar el algoritmo', () => {
    const faces = [box(0.47, 0.45, 0.06, 0.08)];
    expect(groupFraming(faces, FRAME, { minCoverage: 0.01 }).advice).toBe('ok');
  });
});

describe('MockFaceDetector', () => {
  it('por defecto ve un rostro centrado y bien encuadrado', async () => {
    const detector = new MockFaceDetector();
    await detector.init();
    const result = await detector.detect(frame, 42);
    expect(result.atMs).toBe(42);
    expect(result.faces).toHaveLength(1);
    expect(groupFraming(result.faces, FRAME).advice).toBe('ok');
    detector.dispose();
  });

  it('acepta cajas fijas o un guion por instante', async () => {
    const fixed = new MockFaceDetector([box(0.1, 0.1, 0.2, 0.2), box(0.6, 0.1, 0.2, 0.2)]);
    expect((await fixed.detect(frame, 0)).faces).toHaveLength(2);

    const scripted = new MockFaceDetector((atMs) => (atMs < 500 ? [] : [box(0.4, 0.3, 0.2, 0.3)]));
    expect(groupFraming((await scripted.detect(frame, 0)).faces, FRAME).advice).toBe('nobody');
    expect((await scripted.detect(frame, 500)).faces).toHaveLength(1);
  });
});
