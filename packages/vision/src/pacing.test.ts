import { describe, expect, it } from 'vitest';
import { FramePacer, lerpBox } from './pacing';

describe('FramePacer', () => {
  it('analiza el primer cuadro y luego uno de cada N', () => {
    const pacer = new FramePacer<number>({ everyFrames: 3 });
    expect([0, 1, 2, 3, 4, 5, 6].map((f) => pacer.shouldRun(f * 33))).toEqual([
      true, false, false, true, false, false, true,
    ]);
  });

  it('respeta también un intervalo en milisegundos', () => {
    const pacer = new FramePacer<number>({ everyFrames: 2, everyMs: 100 });
    expect(pacer.shouldRun(0)).toBe(true);
    expect(pacer.shouldRun(50)).toBe(false); // faltan cuadros
    expect(pacer.shouldRun(100)).toBe(true);
    expect(pacer.shouldRun(150)).toBe(false); // faltan cuadros
    expect(pacer.shouldRun(160)).toBe(false); // falta tiempo
    expect(pacer.shouldRun(200)).toBe(true);
  });

  it('guarda el último resultado para los cuadros que no se analizan', () => {
    const pacer = new FramePacer<string>({ everyFrames: 2 });
    expect(pacer.last).toBeUndefined();
    expect(pacer.ageMs(0)).toBe(Infinity);
    pacer.shouldRun(0);
    pacer.keep('mascara', 0);
    expect(pacer.shouldRun(33)).toBe(false);
    expect(pacer.last).toEqual({ value: 'mascara', atMs: 0 });
    expect(pacer.ageMs(33)).toBe(33);
    pacer.reset();
    expect(pacer.last).toBeUndefined();
    expect(pacer.shouldRun(66)).toBe(true);
  });
});

describe('lerpBox', () => {
  const a = { x: 0, y: 0, w: 0.2, h: 0.2 };
  const b = { x: 0.4, y: 0.2, w: 0.4, h: 0.6 };

  it('interpola entre dos lecturas', () => {
    expect(lerpBox(a, b, 0.5)).toEqual({ x: 0.2, y: 0.1, w: 0.30000000000000004, h: 0.4 });
  });

  it('recorta t a 0..1', () => {
    expect(lerpBox(a, b, -1)).toEqual(a);
    expect(lerpBox(a, b, 2)).toEqual(b);
  });
});
