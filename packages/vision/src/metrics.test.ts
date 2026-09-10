import { describe, expect, it } from 'vitest';
import { SPEC, analysis, face } from './__tests__/fixtures';
import { evaluateDocumentCompliance } from './compliance';
import { computeDocumentCrop, documentAspect, fitDocumentCrop } from './crop';
import { computeFrameMetrics } from './metrics';
import { sampleDocumentSpec } from './spec-fixture';
import type { ImageDataLike } from './types';

function frame(width: number, height: number, at: (x: number, y: number) => number): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = at(x, y);
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('computeFrameMetrics', () => {
  it('imagen oscura: brillo bajo que bloquea light.low', () => {
    const metrics = computeFrameMetrics(frame(64, 48, () => 20));
    expect(metrics.brightness).toBeCloseTo(20 / 255, 2);
    expect(metrics.brightness).toBeLessThan(0.3);
    const result = evaluateDocumentCompliance(analysis([face()], metrics), SPEC);
    expect(result.criteria.find((c) => c.key === 'light.low')?.status).toBe('block');
    expect(result.canAutoCapture).toBe(false);
  });

  it('imagen plana: nitidez ≈ 0 y contraste 0; fondo uniforme 1', () => {
    const metrics = computeFrameMetrics(frame(64, 48, () => 128));
    expect(metrics.sharpness).toBeCloseTo(0, 6);
    expect(metrics.contrast).toBeCloseTo(0, 6);
    expect(metrics.backgroundUniformity).toBe(1);
    expect(metrics.glare).toBe(0);
    expect(evaluateDocumentCompliance(analysis([face()], metrics), SPEC).criteria.find((c) => c.key === 'sharpness')?.status).toBe('block');
  });

  it('un damero tiene nitidez y contraste altos; con caja de rostro añade brillo y sombras del rostro', () => {
    const metrics = computeFrameMetrics(frame(64, 48, (x, y) => ((x + y) % 2 === 0 ? 0 : 255)), undefined, { step: 1 });
    expect(metrics.sharpness).toBeGreaterThan(40);
    expect(metrics.contrast).toBeGreaterThan(0.2);
    const lit = computeFrameMetrics(frame(64, 48, (x) => (x < 32 ? 60 : 200)), { x: 0.25, y: 0.1, w: 0.5, h: 0.8 }, { step: 1 });
    expect(lit.faceBrightness).toBeDefined();
    expect(lit.shadowAsymmetry).toBeGreaterThan(0.25);
  });

  it('frame vacío devuelve métricas neutras y datos cortos lanzan', () => {
    expect(computeFrameMetrics({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toEqual({ brightness: 0, contrast: 0, sharpness: 0, backgroundUniformity: 1, glare: 0 });
    expect(() => computeFrameMetrics({ data: new Uint8ClampedArray(8), width: 4, height: 4 })).toThrow(/bytes/);
  });
});

describe('computeDocumentCrop', () => {
  it('respeta la relación de aspecto del preset y centra el rostro', () => {
    const crop = computeDocumentCrop(face(), SPEC, { width: 640, height: 480 });
    expect(crop.w / crop.h).toBeCloseTo(35 / 45, 6);
    expect(crop.x + crop.w / 2).toBeCloseTo(320, 0);
    // Línea de ojos (cy = 0.44 → 211.2 px) en el punto medio del rango 0.40–0.48 del recorte.
    expect((0.44 * 480 - crop.y) / crop.h).toBeCloseTo(0.44, 2);
    expect(documentAspect(SPEC)).toBeCloseTo(35 / 45, 6);
  });

  it('un preset apaisado invierte la relación de aspecto', () => {
    const landscape = sampleDocumentSpec({ physical: { widthMm: 45, heightMm: 35, orientation: 'landscape' } });
    const crop = computeDocumentCrop(face(), landscape, { width: 640, height: 480 });
    expect(crop.w / crop.h).toBeCloseTo(45 / 35, 6);
  });

  it('fitDocumentCrop cabe en el frame para el rostro ideal y no para uno enorme', () => {
    const fit = fitDocumentCrop(face(), SPEC, { width: 640, height: 480 });
    expect(fit.fits).toBe(true);
    expect(fit.crop.x).toBeGreaterThanOrEqual(0);
    expect(fit.crop.y).toBeGreaterThanOrEqual(0);
    expect(fit.crop.x + fit.crop.w).toBeLessThanOrEqual(640);
    expect(fit.crop.y + fit.crop.h).toBeLessThanOrEqual(480);
    expect(fitDocumentCrop(face({ height: 0.95 }), SPEC, { width: 640, height: 480 }).fits).toBe(false);
  });
});
