/**
 * @psp/vision · API pública (stubs tipados).
 *
 * Este archivo fija la superficie del paquete según docs/arquitectura/01-apis-de-paquetes.md.
 * Cada stub se sustituye por su implementación en módulos separados; la firma no cambia.
 */
import type {
  CatalogEntry,
  DocumentPresetSpec,
  LocalizedText,
  PoseGuidance as PoseGuidanceSchema,
} from '@psp/contracts';

// ---------------------------------------------------------------------------
// Tipos base
// ---------------------------------------------------------------------------

/** Píxeles RGBA (como ImageData del navegador) sin depender del DOM. */
export type ImageDataLike = { data: Uint8ClampedArray; width: number; height: number };

/** Caja normalizada 0..1 respecto al frame. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectángulo en píxeles del frame. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

/** Ángulos de cabeza en grados. Convención documentada en README (§ Convenciones). */
export interface HeadPose {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

export interface FaceLandmarks {
  points: LandmarkPoint[];
  box: Box;
  blendshapes?: Record<string, number>;
  headPose?: HeadPose;
  score: number;
}

/** Métricas de calidad del frame. 0..1 salvo `sharpness` (varianza del laplaciano). */
export interface FrameMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  backgroundUniformity: number;
  glare: number;
  /** Luminancia media dentro de la zona del rostro (0..1). Sólo si se conoce la caja del rostro. */
  faceBrightness?: number;
  /** Asimetría de luminancia entre mitades izquierda/derecha del rostro (0..1). Sólo con caja. */
  shadowAsymmetry?: number;
}

export interface FrameAnalysis {
  width: number;
  height: number;
  faces: FaceLandmarks[];
  metrics: FrameMetrics;
  atMs: number;
}

export interface FaceAnalyzer {
  readonly kind: 'mediapipe' | 'mock';
  init(): Promise<void>;
  analyze(frame: ImageDataLike, atMs: number): Promise<FrameAnalysis>;
  dispose(): void;
}

/** `PoseGuidance` de contracts sólo exporta el esquema; el tipo se deriva aquí. */
export type PoseGuidance = ReturnType<typeof PoseGuidanceSchema.parse>;

// ---------------------------------------------------------------------------
// Criterios e instrucciones
// ---------------------------------------------------------------------------

export type VisionCriterionKey =
  | 'face.detected'
  | 'face.count'
  | 'face.size'
  | 'face.vertical'
  | 'face.horizontal'
  | 'head.roll'
  | 'head.yaw'
  | 'head.pitch'
  | 'eyes.open'
  | 'gaze.front'
  | 'face.obstruction'
  | 'light.low'
  | 'light.high'
  | 'contrast'
  | 'background.uniform'
  | 'shadows'
  | 'sharpness'
  | 'glasses.glare'
  | 'expression'
  | 'framing';

export type InstructionKey =
  | 'move_left'
  | 'move_right'
  | 'move_closer'
  | 'move_back'
  | 'chin_up'
  | 'chin_down'
  | 'look_front'
  | 'head_straight'
  | 'open_eyes'
  | 'no_smile'
  | 'remove_glasses'
  | 'fix_hair'
  | 'wait_focus'
  | 'only_one_person'
  | 'no_face'
  | 'more_light'
  | 'less_light'
  | 'plain_background'
  | 'hold_still'
  | 'ok';

export interface VisionCriterion {
  key: VisionCriterionKey;
  /** true = puede impedir la captura automática; false = sólo recomendación. */
  blocking: boolean;
  name: LocalizedText;
}

export type CriterionStatus = 'ok' | 'warn' | 'block' | 'na';

export interface CriterionResult {
  key: VisionCriterionKey;
  status: CriterionStatus;
  instruction: InstructionKey;
  value?: number;
}

export interface ComplianceResult {
  criteria: CriterionResult[];
  canAutoCapture: boolean;
  primaryInstruction: InstructionKey;
  /** Proporción de criterios `ok` entre los aplicables (status ≠ na). */
  score: number;
  /** Recorte documental en px del frame. */
  crop?: PixelRect;
}

export const VISION_CRITERIA: VisionCriterion[] = [];

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

export interface SyntheticFaceOptions {
  /** Centro horizontal de la línea de ojos (0..1 del ancho). */
  cx: number;
  /** Línea de ojos (0..1 del alto). Coincide con el centro vertical coronilla-barbilla. */
  cy: number;
  /** Alto del rostro coronilla-barbilla como proporción del alto del frame. */
  height: number;
  rollDeg: number;
  yawDeg: number;
  pitchDeg: number;
  /** Apertura de ojos 0..1 (1 = abiertos). */
  eyesOpen: number;
  /** Sonrisa 0..1 (0 = neutra). */
  smile: number;
  /** Mirada horizontal −1..1 (0 = al frente). */
  gaze: number;
  /** Relación ancho/alto del frame, necesaria para que el rostro no se deforme. */
  aspect: number;
  /** Confianza reportada. */
  score: number;
}

export function syntheticFace(_opts: Partial<SyntheticFaceOptions> = {}): FaceLandmarks {
  throw new Error('not implemented');
}

export function computeFrameMetrics(_img: ImageDataLike, _faceBox?: Box): FrameMetrics {
  throw new Error('not implemented');
}

export function evaluateDocumentCompliance(
  _analysis: FrameAnalysis,
  _spec: DocumentPresetSpec,
): ComplianceResult {
  throw new Error('not implemented');
}

export function computeDocumentCrop(
  _face: FaceLandmarks,
  _spec: DocumentPresetSpec,
  _frame: { width: number; height: number },
): PixelRect {
  throw new Error('not implemented');
}

export function evaluatePoseGuidance(
  _analysis: FrameAnalysis,
  _guidance: PoseGuidance | undefined,
): { ok: boolean; hints: InstructionKey[] } {
  throw new Error('not implemented');
}

export type AutoCaptureState = 'idle' | 'stabilizing' | 'ready' | 'fired' | 'cooldown';

export interface AutoCaptureUpdate {
  state: AutoCaptureState;
  progress: number;
  shouldCapture: boolean;
}

export class AutoCaptureController {
  constructor(_opts: { stabilityMs: number; cooldownMs?: number }) {}
  update(_result: ComplianceResult, _atMs: number): AutoCaptureUpdate {
    throw new Error('not implemented');
  }
  reset(): void {
    throw new Error('not implemented');
  }
}

export type MockFaceScript = (atMs: number, frame: { width: number; height: number }) => FaceLandmarks[];

export class MockFaceAnalyzer implements FaceAnalyzer {
  readonly kind = 'mock' as const;
  constructor(_script?: MockFaceScript) {}
  init(): Promise<void> {
    throw new Error('not implemented');
  }
  analyze(_frame: ImageDataLike, _atMs: number): Promise<FrameAnalysis> {
    throw new Error('not implemented');
  }
  dispose(): void {
    throw new Error('not implemented');
  }
}

export const CATALOG: CatalogEntry[] = [];
