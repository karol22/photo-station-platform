/**
 * Tipos públicos de @psp/vision. Coinciden con docs/arquitectura/01-apis-de-paquetes.md.
 * Los campos adicionales respecto al contrato son opcionales (cambios aditivos).
 */
import type { LocalizedText, PoseGuidance as PoseGuidanceSchema } from '@psp/contracts';

/** Píxeles RGBA (misma forma que ImageData del navegador) sin depender del DOM. */
export type ImageDataLike = { data: Uint8ClampedArray; width: number; height: number };

/** Caja normalizada 0..1 respecto al frame. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectángulo en píxeles del frame analizado (sin redondear; el consumidor redondea al recortar). */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Punto normalizado 0..1 respecto al frame; `z` es profundidad relativa (misma escala que x). */
export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

/**
 * Ángulos de cabeza en grados. Convención (ver README § Convenciones):
 * - yawDeg > 0: el rostro gira hacia la derecha de la IMAGEN (x creciente).
 * - pitchDeg > 0: barbilla arriba (mira hacia arriba); < 0: barbilla abajo.
 * - rollDeg > 0: el lado derecho de la imagen del rostro queda más abajo (giro horario en pantalla).
 */
export interface HeadPose {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

export interface FaceLandmarks {
  /** Malla de MediaPipe: 468 puntos, o 478 con iris. Índices en `LM`. */
  points: LandmarkPoint[];
  box: Box;
  /** Blendshapes de MediaPipe: `categoryName → score` (0..1). */
  blendshapes?: Record<string, number>;
  headPose?: HeadPose;
  /** Confianza/visibilidad del rostro 0..1. */
  score: number;
}

/** Métricas de calidad del frame. 0..1 salvo `sharpness` (varianza del laplaciano en escala 0..255). */
export interface FrameMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  backgroundUniformity: number;
  glare: number;
  /** Luminancia media en la zona interior del rostro (0..1). Sólo cuando se conoce la caja del rostro. */
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

/** `PoseGuidance` de contracts sólo exporta el esquema zod; el tipo se deriva aquí sin depender de zod. */
export type PoseGuidance = ReturnType<typeof PoseGuidanceSchema.parse>;

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

/**
 * Instrucciones humanas (requisito 5.4). `move_left`/`move_right` se expresan en coordenadas de la
 * IMAGEN analizada: `move_left` = el rostro debe desplazarse hacia x menor. Si la UI muestra la
 * cámara en espejo, aplica `mirrorInstruction` antes de mostrarla.
 */
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
  /** true = puede impedir la captura automática; false = sólo produce recomendaciones (`warn`). */
  blocking: boolean;
  name: LocalizedText;
}

export type CriterionStatus = 'ok' | 'warn' | 'block' | 'na';

export interface CriterionResult {
  key: VisionCriterionKey;
  status: CriterionStatus;
  /** `ok` cuando el criterio no exige acción. */
  instruction: InstructionKey;
  /** Medición que sustenta el estado (unidad según criterio; ver README). */
  value?: number;
}

export interface ComplianceResult {
  /** Un resultado por criterio, en el orden de `VISION_CRITERIA`. */
  criteria: CriterionResult[];
  /** true cuando ningún criterio está en `block`. */
  canAutoCapture: boolean;
  /** Instrucción del primer `block` por prioridad; si no hay, del primer `warn`; si no, `ok`. */
  primaryInstruction: InstructionKey;
  /** Proporción de criterios `ok` entre los aplicables (status ≠ `na`). */
  score: number;
  /** Recorte documental en px del frame: el ajustado si cabe; si no, el ideal (puede salirse). */
  crop?: PixelRect;
}

export interface SyntheticFaceOptions {
  /** Centro de la línea de ojos, 0..1 del ancho del frame. */
  cx: number;
  /** Línea de ojos, 0..1 del alto del frame. En el modelo coincide con el centro coronilla-barbilla. */
  cy: number;
  /** Alto del rostro (coronilla-barbilla) como proporción del alto del frame. */
  height: number;
  rollDeg: number;
  yawDeg: number;
  pitchDeg: number;
  /** Apertura de ojos 0..1 (1 = abiertos del todo, 0 = cerrados). */
  eyesOpen: number;
  /** Sonrisa 0..1 (0 = neutra, 1 = plena). */
  smile: number;
  /** Mirada horizontal −1..1 (0 = al frente; > 0 iris hacia la derecha de la imagen). */
  gaze: number;
  /** Relación ancho/alto del frame en que se dibuja; evita deformar el rostro. */
  aspect: number;
  /** Confianza reportada (`FaceLandmarks.score`). */
  score: number;
}

export type AutoCaptureState = 'idle' | 'stabilizing' | 'ready' | 'fired' | 'cooldown';

export interface AutoCaptureUpdate {
  state: AutoCaptureState;
  /** 0..1: avance de la ventana de estabilidad; en `cooldown`, avance del enfriamiento. */
  progress: number;
  /** true exactamente una vez por ciclo, en el estado `fired`. */
  shouldCapture: boolean;
}

/** Guion del analizador mock: rostros a devolver para un instante y un tamaño de frame. */
export type MockFaceScript = (
  atMs: number,
  frame: { width: number; height: number },
) => FaceLandmarks[];
