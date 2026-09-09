/**
 * @psp/vision · API pública. Todo lo exportado aquí es puro y corre en Node.
 * El adaptador MediaPipe (sólo navegador) se importa desde `@psp/vision/mediapipe`.
 * Superficie fijada en docs/arquitectura/01-apis-de-paquetes.md; el resto son exports aditivos.
 */
export type * from './types';

export {
  FACE_MESH_POINTS,
  FACE_MESH_POINTS_WITHOUT_IRIS,
  FACE_MODEL,
  LM,
  estimatePitchDeg,
  estimateYawDeg,
  largestFace,
  measureFace,
} from './face-model';
export type { FaceMeasurements, Vec2 } from './face-model';

export { DEFAULT_SYNTHETIC_FACE, syntheticFace } from './synthetic';

export { IDEAL_FRAME_METRICS, autoSampleStep, computeFrameMetrics } from './metrics';
export type { FrameMetricsOptions } from './metrics';

export {
  INSTRUCTION_KEYS,
  INSTRUCTION_PRIORITY,
  VISION_CRITERIA,
  VISION_CRITERION_KEYS,
  mirrorInstruction,
  mirrorRect,
} from './criteria';

export {
  computeDocumentCrop,
  computeDocumentCropFromMeasurements,
  documentAspect,
  fitDocumentCrop,
  fitDocumentCropFromMeasurements,
} from './crop';
export type { CropFit } from './crop';

export { COMPLIANCE_LIMITS, evaluateDocumentCompliance } from './compliance';

export { evaluatePoseGuidance } from './pose-guidance';

export { AutoCaptureController } from './auto-capture';

export { MockFaceAnalyzer, defaultMockScript } from './mock-analyzer';

export { SAMPLE_DOCUMENT_SPEC, sampleDocumentSpec } from './spec-fixture';
export type { DocumentSpecOverrides } from './spec-fixture';

export { CATALOG } from './catalog';
