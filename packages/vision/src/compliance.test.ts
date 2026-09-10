import { describe, expect, it } from 'vitest';
import { SPEC, analysis, face } from './__tests__/fixtures';
import { evaluateDocumentCompliance } from './compliance';
import { IDEAL_FRAME_METRICS } from './metrics';
import { evaluatePoseGuidance } from './pose-guidance';
import { SAMPLE_DOCUMENT_SPEC } from './spec-fixture';
import type { FaceLandmarks, FrameMetrics } from './types';

const evaluate = (faces: FaceLandmarks[], metrics?: FrameMetrics) => evaluateDocumentCompliance(analysis(faces, metrics), SPEC);
const statusOf = (faces: FaceLandmarks[], key: string) => evaluate(faces).criteria.find((c) => c.key === key)?.status;

describe('spec de referencia', () => {
  it('los umbrales por defecto del contrato coinciden con SAMPLE_DOCUMENT_SPEC', () => {
    expect(SPEC.thresholds).toEqual(SAMPLE_DOCUMENT_SPEC.thresholds);
    expect(SPEC.autoCapture.stabilityMs).toBe(1200);
  });
});

describe('evaluateDocumentCompliance', () => {
  it('rostro sintético ideal: captura automática con instrucción ok', () => {
    const result = evaluate([face()]);
    expect(result.canAutoCapture).toBe(true);
    expect(result.primaryInstruction).toBe('ok');
    expect(result.score).toBe(1);
    expect(result.criteria.filter((c) => c.status === 'block' || c.status === 'warn')).toEqual([]);
    expect(result.crop).toBeDefined();
    expect(result.crop!.w / result.crop!.h).toBeCloseTo(35 / 45, 2);
    expect(result.criteria.map((c) => c.key)).toContain('face.size');
  });

  it('rostro pequeño → move_closer; grande → move_back', () => {
    const small = evaluate([face({ height: 0.4 })]);
    expect(small.canAutoCapture).toBe(false);
    expect(small.primaryInstruction).toBe('move_closer');
    expect(statusOf([face({ height: 0.4 })], 'face.size')).toBe('block');
    const big = evaluate([face({ height: 0.85 })]);
    expect(big.canAutoCapture).toBe(false);
    expect(big.primaryInstruction).toBe('move_back');
  });

  it('roll de 12° → head_straight', () => {
    const result = evaluate([face({ rollDeg: 12 })]);
    expect(result.canAutoCapture).toBe(false);
    expect(result.primaryInstruction).toBe('head_straight');
    const roll = result.criteria.find((c) => c.key === 'head.roll');
    expect(roll?.status).toBe('block');
    expect(Math.abs(roll?.value ?? 0)).toBeGreaterThan(5);
  });

  it('yaw de 20° → look_front', () => {
    const result = evaluate([face({ yawDeg: 20 })]);
    expect(result.canAutoCapture).toBe(false);
    expect(result.primaryInstruction).toBe('look_front');
    expect(result.criteria.find((c) => c.key === 'head.yaw')).toMatchObject({ status: 'block', value: 20 });
  });

  it('pitch fuera de rango → chin_down / chin_up', () => {
    // El pitch acorta la proyección coronilla-barbilla; un rostro algo mayor mantiene face.size en rango.
    expect(evaluate([face({ pitchDeg: 15, height: 0.68 })]).primaryInstruction).toBe('chin_down');
    expect(evaluate([face({ pitchDeg: -15, height: 0.68 })]).primaryInstruction).toBe('chin_up');
  });

  it('ojos cerrados → open_eyes', () => {
    const result = evaluate([face({ eyesOpen: 0 })]);
    expect(result.canAutoCapture).toBe(false);
    expect(result.primaryInstruction).toBe('open_eyes');
  });

  it('sonrisa con smile forbidden → no_smile; con smile allowed no aplica', () => {
    const result = evaluate([face({ smile: 1 })]);
    expect(result.canAutoCapture).toBe(false);
    expect(result.primaryInstruction).toBe('no_smile');
    const relaxed = evaluateDocumentCompliance(analysis([face({ smile: 1 })]), { ...SPEC, smile: 'allowed', expression: 'smile_allowed' });
    expect(relaxed.criteria.find((c) => c.key === 'expression')?.status).toBe('na');
    expect(relaxed.canAutoCapture).toBe(true);
  });

  it('dos rostros → only_one_person', () => {
    const result = evaluate([face(), face({ cx: 0.85, height: 0.3 })]);
    expect(result.canAutoCapture).toBe(false);
    expect(result.primaryInstruction).toBe('only_one_person');
    expect(result.criteria.find((c) => c.key === 'face.count')).toMatchObject({ status: 'block', value: 2 });
  });

  it('sin rostro → no_face y criterios de rostro no aplicables', () => {
    const result = evaluate([]);
    expect(result.canAutoCapture).toBe(false);
    expect(result.primaryInstruction).toBe('no_face');
    expect(result.crop).toBeUndefined();
    expect(result.criteria.find((c) => c.key === 'face.size')?.status).toBe('na');
    expect(result.criteria.find((c) => c.key === 'light.low')?.status).toBe('ok');
  });

  it('rostro desplazado → move_left / move_right en coordenadas de imagen', () => {
    expect(evaluate([face({ cx: 0.62 })]).primaryInstruction).toBe('move_left');
    expect(evaluate([face({ cx: 0.38 })]).primaryInstruction).toBe('move_right');
  });

  it('métricas de imagen: poca luz, mucha luz, fondo y desenfoque', () => {
    const dark = evaluate([face()], { ...IDEAL_FRAME_METRICS, brightness: 0.1, faceBrightness: 0.1 });
    expect(dark.criteria.find((c) => c.key === 'light.low')).toMatchObject({ status: 'block', instruction: 'more_light' });
    expect(dark.primaryInstruction).toBe('more_light');
    const bright = evaluate([face()], { ...IDEAL_FRAME_METRICS, brightness: 0.95, faceBrightness: 0.95 });
    expect(bright.primaryInstruction).toBe('less_light');
    const busy = evaluate([face()], { ...IDEAL_FRAME_METRICS, backgroundUniformity: 0.2 });
    expect(busy.primaryInstruction).toBe('plain_background');
    const blurry = evaluate([face()], { ...IDEAL_FRAME_METRICS, sharpness: 5 });
    expect(blurry.primaryInstruction).toBe('hold_still');
    expect(blurry.canAutoCapture).toBe(false);
  });
});

describe('evaluatePoseGuidance', () => {
  it('nunca bloquea: sin guía es ok y con zona devuelve pistas', () => {
    expect(evaluatePoseGuidance(analysis([face()]), undefined)).toEqual({ ok: true, hints: [] });
    expect(evaluatePoseGuidance(analysis([face()]), { zone: { x: 0.3, y: 0.1, w: 0.4, h: 0.8 }, expectedPeople: 1 })).toEqual({ ok: true, hints: [] });
    expect(evaluatePoseGuidance(analysis([face({ cx: 0.9 })]), { zone: { x: 0.3, y: 0.1, w: 0.4, h: 0.8 } }).hints).toEqual(['move_left']);
    expect(evaluatePoseGuidance(analysis([]), { expectedPeople: 1 })).toEqual({ ok: false, hints: ['no_face'] });
  });
});
