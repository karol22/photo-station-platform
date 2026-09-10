/**
 * Evaluador de cumplimiento documental (requisitos 5.3–5.6). Puro: recibe un análisis de frame y el
 * spec del preset; produce un resultado por criterio, si procede la captura automática, la instrucción
 * principal y el recorte.
 *
 * Coordenadas: todo se evalúa en coordenadas de la IMAGEN analizada. `move_left`/`move_right` indican
 * hacia dónde debe desplazarse el rostro dentro de esa imagen; la UI decide el espejo
 * (`mirrorInstruction`, `mirrorRect`).
 */
import type { DocumentPresetSpec } from '@psp/contracts';
import { INSTRUCTION_PRIORITY, VISION_CRITERIA } from './criteria';
import { fitDocumentCropFromMeasurements, type CropFit } from './crop';
import { largestFace, measureFace } from './face-model';
import type {
  ComplianceResult,
  CriterionResult,
  CriterionStatus,
  FrameAnalysis,
  InstructionKey,
  PixelRect,
  VisionCriterionKey,
} from './types';

/** Límites internos que el contrato no parametriza (documentados en README). */
export const COMPLIANCE_LIMITS = {
  /** Sonrisa (blendshape o geometría) a partir de la cual se considera detectada. */
  smileDetected: 0.5,
  /** `FaceLandmarks.score` por debajo del cual se avisa de obstrucción. */
  obstructionScore: 0.5,
  /** Desplazamiento del iris (fracción del ancho del ojo) a partir del cual se avisa de mirada desviada. */
  gazeWarnOffset: 0.12,
  /** Asimetría de luminancia izquierda/derecha a partir de la cual se avisan sombras. */
  shadowWarn: 0.25,
  /** Uniformidad de fondo por debajo de la cual el criterio bloquea (no sólo avisa). */
  backgroundBlock: 0.4,
} as const;

const FACE_CRITERIA: VisionCriterionKey[] = [
  'face.size',
  'face.vertical',
  'face.horizontal',
  'head.roll',
  'head.yaw',
  'head.pitch',
  'eyes.open',
  'gaze.front',
  'face.obstruction',
  'expression',
  'framing',
];

function framingInstruction(fit: CropFit): InstructionKey {
  if (!fit.sizeFits) return 'move_back';
  if (!fit.horizontalFits) return fit.overflow.right > fit.overflow.left ? 'move_left' : 'move_right';
  return 'move_back';
}

export function evaluateDocumentCompliance(
  analysis: FrameAnalysis,
  spec: DocumentPresetSpec,
): ComplianceResult {
  const { faces, metrics, width, height } = analysis;
  const t = spec.thresholds;
  const results = new Map<VisionCriterionKey, CriterionResult>();
  const set = (key: VisionCriterionKey, status: CriterionStatus, instruction: InstructionKey = 'ok', value?: number) => {
    const r: CriterionResult = { key, status, instruction: status === 'ok' || status === 'na' ? 'ok' : instruction };
    if (value !== undefined && Number.isFinite(value)) r.value = value;
    results.set(key, r);
  };

  const n = faces.length;
  set('face.detected', n >= 1 ? 'ok' : 'block', 'no_face', n);
  set('face.count', n === 0 ? 'na' : n === 1 ? 'ok' : 'block', 'only_one_person', n);

  const face = largestFace(faces);
  let crop: PixelRect | undefined;
  if (face) {
    const m = measureFace(face, { width, height });
    const fit = fitDocumentCropFromMeasurements(m, spec, { width, height });
    crop = fit.crop;

    const hr = spec.face.heightRatio;
    if (m.heightRatio < hr.min) set('face.size', 'block', 'move_closer', m.heightRatio);
    else if (m.heightRatio > hr.max) set('face.size', 'block', 'move_back', m.heightRatio);
    else set('face.size', 'ok', 'ok', m.heightRatio);

    set('face.vertical', fit.verticalFits ? 'ok' : 'block', 'move_back', m.eyeLineY);

    const dx = m.centerX - 0.5;
    const sideways: InstructionKey = dx > 0 ? 'move_left' : 'move_right';
    if (Math.abs(dx) <= spec.face.centerXTolerance) set('face.horizontal', 'ok', 'ok', m.centerX);
    else set('face.horizontal', fit.horizontalFits ? 'warn' : 'block', sideways, m.centerX);

    set('head.roll', Math.abs(m.rollDeg) > t.maxRollDeg ? 'block' : 'ok', 'head_straight', m.rollDeg);
    set('head.yaw', Math.abs(m.yawDeg) > t.maxYawDeg ? 'block' : 'ok', 'look_front', m.yawDeg);
    if (m.pitchDeg > t.maxPitchDeg) set('head.pitch', 'block', 'chin_down', m.pitchDeg);
    else if (m.pitchDeg < -t.maxPitchDeg) set('head.pitch', 'block', 'chin_up', m.pitchDeg);
    else set('head.pitch', 'ok', 'ok', m.pitchDeg);

    set('eyes.open', m.eyeOpenness < t.minEyeOpen ? 'block' : 'ok', 'open_eyes', m.eyeOpenness);

    if (m.gazeOffset === undefined) set('gaze.front', 'na');
    else set('gaze.front', Math.abs(m.gazeOffset) > COMPLIANCE_LIMITS.gazeWarnOffset ? 'warn' : 'ok', 'look_front', m.gazeOffset);

    set('face.obstruction', face.score < COMPLIANCE_LIMITS.obstructionScore ? 'warn' : 'ok', 'fix_hair', face.score);

    const smileForbidden = spec.smile === 'forbidden' || spec.expression === 'no_smile';
    if (!smileForbidden) set('expression', 'na', 'ok', m.smile);
    else set('expression', m.smile > COMPLIANCE_LIMITS.smileDetected ? 'block' : 'ok', 'no_smile', m.smile);

    set('framing', fit.fits ? 'ok' : 'block', framingInstruction(fit));
  } else {
    for (const key of FACE_CRITERIA) set(key, 'na');
  }

  // Criterios de imagen: se evalúan aunque no haya rostro (siguen siendo útiles como guía).
  const exposure = metrics.faceBrightness ?? metrics.brightness;
  set('light.low', exposure < t.minBrightness ? 'block' : 'ok', 'more_light', exposure);
  set('light.high', exposure > t.maxBrightness ? 'block' : 'ok', 'less_light', exposure);
  set('contrast', metrics.contrast < t.minContrast ? 'warn' : 'ok', 'more_light', metrics.contrast);

  const u = metrics.backgroundUniformity;
  if (u < COMPLIANCE_LIMITS.backgroundBlock) set('background.uniform', 'block', 'plain_background', u);
  else if (u < t.minBackgroundUniformity) set('background.uniform', 'warn', 'plain_background', u);
  else set('background.uniform', 'ok', 'ok', u);

  if (metrics.shadowAsymmetry === undefined) set('shadows', 'na');
  else set('shadows', metrics.shadowAsymmetry > COMPLIANCE_LIMITS.shadowWarn ? 'warn' : 'ok', 'more_light', metrics.shadowAsymmetry);

  set('sharpness', metrics.sharpness < t.minSharpness ? 'block' : 'ok', 'hold_still', metrics.sharpness);

  if (spec.glasses === 'forbidden') {
    // No es posible confirmar la presencia de lentes con landmarks: la UI muestra la regla del preset.
    set('glasses.glare', 'na', 'ok', metrics.glare);
  } else {
    const instruction: InstructionKey = spec.glasses === 'required' ? 'chin_down' : 'remove_glasses';
    set('glasses.glare', metrics.glare > t.maxGlassesGlare ? 'warn' : 'ok', instruction, metrics.glare);
  }

  const criteria = VISION_CRITERIA.map((c) => results.get(c.key) as CriterionResult);
  const firstByPriority = (status: CriterionStatus): InstructionKey | undefined => {
    for (const key of INSTRUCTION_PRIORITY) {
      const r = results.get(key);
      if (r && r.status === status) return r.instruction;
    }
    return undefined;
  };
  const canAutoCapture = !criteria.some((c) => c.status === 'block');
  const primaryInstruction = firstByPriority('block') ?? firstByPriority('warn') ?? 'ok';
  const applicable = criteria.filter((c) => c.status !== 'na');
  const score = applicable.length === 0 ? 0 : applicable.filter((c) => c.status === 'ok').length / applicable.length;

  const result: ComplianceResult = { criteria, canAutoCapture, primaryInstruction, score };
  if (crop) result.crop = crop;
  return result;
}
