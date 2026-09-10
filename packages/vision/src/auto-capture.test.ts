import { describe, expect, it } from 'vitest';
import { AutoCaptureController } from './auto-capture';
import { SPEC, analysis, face } from './__tests__/fixtures';
import { evaluateDocumentCompliance } from './compliance';
import { FACE_MESH_POINTS } from './face-model';
import { IDEAL_FRAME_METRICS } from './metrics';
import { MockFaceAnalyzer, defaultMockScript } from './mock-analyzer';

const OK = evaluateDocumentCompliance(analysis([face()]), SPEC);
const BAD = evaluateDocumentCompliance(analysis([]), SPEC);

describe('AutoCaptureController', () => {
  it('dispara exactamente una vez tras stabilityMs y pasa a enfriamiento', () => {
    const c = new AutoCaptureController({ stabilityMs: 1200, cooldownMs: 1000 });
    expect(c.update(OK, 0)).toEqual({ state: 'stabilizing', progress: 0, shouldCapture: false });
    expect(c.update(OK, 600)).toEqual({ state: 'stabilizing', progress: 0.5, shouldCapture: false });
    expect(c.update(OK, 1199).state).toBe('stabilizing');
    expect(c.update(OK, 1200)).toEqual({ state: 'ready', progress: 1, shouldCapture: false });
    expect(c.update(OK, 1250)).toEqual({ state: 'fired', progress: 1, shouldCapture: true });
    expect(c.update(OK, 1300)).toEqual({ state: 'cooldown', progress: 0.05, shouldCapture: false });
    expect(c.update(OK, 2000).shouldCapture).toBe(false);
    // Vencido el enfriamiento, el mismo frame válido vuelve a estabilizar desde cero.
    expect(c.update(OK, 2300)).toEqual({ state: 'stabilizing', progress: 0, shouldCapture: false });
  });

  it('un frame inválido reinicia la ventana de estabilidad', () => {
    const c = new AutoCaptureController({ stabilityMs: 1200 });
    c.update(OK, 0);
    expect(c.update(OK, 1000).progress).toBeCloseTo(1000 / 1200, 6);
    expect(c.update(BAD, 1100)).toEqual({ state: 'idle', progress: 0, shouldCapture: false });
    expect(c.update(OK, 1200)).toEqual({ state: 'stabilizing', progress: 0, shouldCapture: false });
    expect(c.update(OK, 2300).state).toBe('stabilizing');
    expect(c.update(OK, 2400).state).toBe('ready');
    let fired = 0;
    for (let t = 2450; t < 6000; t += 50) if (c.update(OK, t).shouldCapture) fired++;
    expect(fired).toBeGreaterThanOrEqual(1);
    const fresh = new AutoCaptureController({ stabilityMs: 1200, cooldownMs: 100000 });
    let count = 0;
    for (let t = 0; t < 10000; t += 100) if (fresh.update(OK, t).shouldCapture) count++;
    expect(count).toBe(1);
  });

  it('reset vuelve a idle', () => {
    const c = new AutoCaptureController({ stabilityMs: 500 });
    c.update(OK, 0);
    c.update(OK, 500);
    c.reset();
    expect(c.update(OK, 600)).toEqual({ state: 'stabilizing', progress: 0, shouldCapture: false });
  });
});

describe('MockFaceAnalyzer', () => {
  it('analyze devuelve un FrameAnalysis válido con un rostro ideal y métricas ideales sin píxeles', async () => {
    const analyzer = new MockFaceAnalyzer();
    expect(analyzer.kind).toBe('mock');
    await analyzer.init();
    const result = await analyzer.analyze({ data: new Uint8ClampedArray(0), width: 640, height: 480 }, 42);
    expect(result).toMatchObject({ width: 640, height: 480, atMs: 42, metrics: IDEAL_FRAME_METRICS });
    expect(result.faces).toHaveLength(1);
    const only = result.faces[0]!;
    expect(only.points).toHaveLength(FACE_MESH_POINTS);
    for (const p of only.points) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
    expect(only.box.x).toBeGreaterThanOrEqual(0);
    expect(only.box.y).toBeGreaterThanOrEqual(0);
    expect(only.box.x + only.box.w).toBeLessThanOrEqual(1);
    expect(only.box.y + only.box.h).toBeLessThanOrEqual(1);
    expect(only.score).toBe(1);
    expect(only.headPose).toEqual({ yawDeg: 0, pitchDeg: 0, rollDeg: 0 });
    expect(evaluateDocumentCompliance(result, SPEC).canAutoCapture).toBe(true);
    analyzer.dispose();
  });

  it('con píxeles calcula métricas reales y el guion controla los rostros', async () => {
    const gray = { data: new Uint8ClampedArray(64 * 48 * 4).fill(128), width: 64, height: 48 };
    const withPixels = await new MockFaceAnalyzer().analyze(gray, 0);
    expect(withPixels.metrics.brightness).toBeCloseTo(128 / 255, 2);
    expect(withPixels.metrics.sharpness).toBe(0);
    const empty = await new MockFaceAnalyzer(() => []).analyze(gray, 0);
    expect(empty.faces).toEqual([]);
    expect(evaluateDocumentCompliance(empty, SPEC).primaryInstruction).toBe('no_face');
    expect(defaultMockScript(0, { width: 640, height: 480 })).toHaveLength(1);
  });
});
