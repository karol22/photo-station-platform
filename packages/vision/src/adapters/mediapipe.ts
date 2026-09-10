/**
 * Adaptador MediaPipe Face Landmarker (sólo navegador). Se expone por `@psp/vision/mediapipe`; el
 * índice del paquete no lo importa, para que el resto funcione en Node. La librería se carga con
 * `import()` dinámico dentro de `init()`; las conversiones (`toFaceLandmarks`, `matrixToHeadPose`)
 * son puras y se prueban en Node.
 *
 * Servido de WASM y modelo: ver `packages/vision/docs/mediapipe.md`.
 */
import type {
  Classifications,
  FaceLandmarker,
  FaceLandmarkerResult,
  Matrix,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { computeFrameMetrics } from '../metrics';
import type { FaceAnalyzer, FaceLandmarks, FrameAnalysis, HeadPose, ImageDataLike, LandmarkPoint } from '../types';
import { clamp01, degrees } from '../util';
import { createWithDelegate, toImageSource, VideoTimestamps, type MediaPipeDelegate } from './frame';

export interface MediaPipeAnalyzerOptions {
  /** URL del modelo `.task` (en el kiosco: `/models/face_landmarker.task`). */
  modelUrl: string;
  /** Directorio base con `vision_wasm_*_internal.{js,wasm}` (en el kiosco: `/wasm`). */
  wasmBaseUrl: string;
  /** Rostros máximos. Por defecto 2, para poder detectar "sólo una persona". */
  numFaces?: number;
}

export type { MediaPipeDelegate };

export interface MediaPipeFaceAnalyzer extends FaceAnalyzer {
  readonly kind: 'mediapipe';
  /** Delegado con el que se inicializó (`GPU`, o `CPU` tras el reintento). `undefined` antes de `init()`. */
  readonly delegate: MediaPipeDelegate | undefined;
}

/**
 * Pose de cabeza a partir de la matriz de transformación facial 4×4 de MediaPipe.
 *
 * MediaPipe empaqueta la matriz en orden de columnas (la traslación ocupa data[12..14]); por robustez se
 * detecta el orden comparando dónde vive la traslación. La rotación R lleva el modelo canónico (rostro
 * frontal que mira hacia +Z, con +X a la derecha de la imagen y +Y hacia arriba) al rostro detectado:
 * - yaw   = atan2(fx, fz) con f = R·(0,0,1): > 0 cuando el rostro gira hacia la derecha de la imagen.
 * - pitch = atan2(fy, hypot(fx, fz)): > 0 cuando el rostro mira hacia arriba (barbilla arriba).
 * - roll  = −atan2(R10, R00): > 0 cuando el lado derecho de la imagen queda más abajo (y de imagen hacia abajo).
 * Estas convenciones coinciden con `syntheticFace`. Verificar signos con la cámara real al integrar.
 */
export function matrixToHeadPose(matrix: Pick<Matrix, 'data'> | undefined): HeadPose | undefined {
  const d = matrix?.data;
  if (!d || d.length < 16) return undefined;
  const at = (i: number) => d[i] ?? 0;
  const rowMajorTranslation = Math.abs(at(3)) + Math.abs(at(7)) + Math.abs(at(11));
  const colMajorTranslation = Math.abs(at(12)) + Math.abs(at(13)) + Math.abs(at(14));
  const colMajor = rowMajorTranslation <= colMajorTranslation;
  const R = (r: number, c: number) => (colMajor ? at(c * 4 + r) : at(r * 4 + c));
  const fx = R(0, 2);
  const fy = R(1, 2);
  const fz = R(2, 2);
  return {
    yawDeg: degrees(Math.atan2(fx, fz)),
    pitchDeg: degrees(Math.atan2(fy, Math.hypot(fx, fz))),
    rollDeg: -degrees(Math.atan2(R(1, 0), R(0, 0))),
  };
}

export function blendshapesToRecord(classifications: Classifications | undefined): Record<string, number> | undefined {
  if (!classifications) return undefined;
  const out: Record<string, number> = {};
  for (const c of classifications.categories) out[c.categoryName] = c.score;
  return out;
}

/**
 * Convierte un rostro de MediaPipe a `FaceLandmarks`. La caja sale del min/max de los puntos, recortada
 * a 0..1. MediaPipe no expone una confianza por rostro: `score` = proporción de puntos dentro del frame,
 * multiplicada por la visibilidad media cuando el modelo la reporta (> 0).
 */
export function toFaceLandmarks(
  landmarks: NormalizedLandmark[],
  blendshapes?: Classifications,
  matrix?: Matrix,
): FaceLandmarks {
  const points: LandmarkPoint[] = new Array(landmarks.length);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let inside = 0;
  let visibilitySum = 0;
  let visibilityCount = 0;
  for (let i = 0; i < landmarks.length; i++) {
    const l = landmarks[i] as NormalizedLandmark;
    points[i] = { x: l.x, y: l.y, z: l.z };
    if (l.x < minX) minX = l.x;
    if (l.y < minY) minY = l.y;
    if (l.x > maxX) maxX = l.x;
    if (l.y > maxY) maxY = l.y;
    if (l.x >= 0 && l.x <= 1 && l.y >= 0 && l.y <= 1) inside++;
    if (typeof l.visibility === 'number' && l.visibility > 0) {
      visibilitySum += l.visibility;
      visibilityCount++;
    }
  }
  const n = landmarks.length;
  const bx = clamp01(minX);
  const by = clamp01(minY);
  const box = n === 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: bx, y: by, w: Math.max(0, clamp01(maxX) - bx), h: Math.max(0, clamp01(maxY) - by) };
  let score = n === 0 ? 0 : inside / n;
  if (visibilityCount > 0) score *= clamp01(visibilitySum / visibilityCount);

  const face: FaceLandmarks = { points, box, score };
  const bs = blendshapesToRecord(blendshapes);
  if (bs) face.blendshapes = bs;
  const pose = matrixToHeadPose(matrix);
  if (pose) face.headPose = pose;
  return face;
}

export function convertResult(result: FaceLandmarkerResult): FaceLandmarks[] {
  return result.faceLandmarks.map((landmarks, i) =>
    toFaceLandmarks(landmarks, result.faceBlendshapes?.[i], result.facialTransformationMatrixes?.[i]),
  );
}

class MediaPipeAnalyzer implements MediaPipeFaceAnalyzer {
  readonly kind = 'mediapipe' as const;
  private landmarker: FaceLandmarker | undefined;
  private initializing: Promise<void> | undefined;
  private readonly timestamps = new VideoTimestamps();
  private activeDelegate: MediaPipeDelegate | undefined;

  constructor(private readonly opts: MediaPipeAnalyzerOptions) {}

  get delegate(): MediaPipeDelegate | undefined {
    return this.activeDelegate;
  }

  init(): Promise<void> {
    if (this.landmarker) return Promise.resolve();
    this.initializing ??= this.load().finally(() => {
      this.initializing = undefined;
    });
    return this.initializing;
  }

  private async load(): Promise<void> {
    const mp = await import('@mediapipe/tasks-vision');
    const fileset = await mp.FilesetResolver.forVisionTasks(this.opts.wasmBaseUrl);
    const common = {
      runningMode: 'VIDEO' as const,
      numFaces: this.opts.numFaces ?? 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    };
    // Sin WebGL utilizable (o contexto ya tomado), `createWithDelegate` reintenta en CPU.
    const { task, delegate } = await createWithDelegate((d) =>
      mp.FaceLandmarker.createFromOptions(fileset, {
        ...common,
        baseOptions: { modelAssetPath: this.opts.modelUrl, delegate: d },
      }),
    );
    this.landmarker = task;
    this.activeDelegate = delegate;
  }

  async analyze(frame: ImageDataLike, atMs: number): Promise<FrameAnalysis> {
    if (!this.landmarker) await this.init();
    const landmarker = this.landmarker;
    if (!landmarker) throw new Error('MediaPipe no inicializado');
    const source = toImageSource(frame, 'createMediaPipeAnalyzer', 'MockFaceAnalyzer');
    const result = landmarker.detectForVideo(source, this.timestamps.next(atMs));
    const faces = convertResult(result);
    const metrics = computeFrameMetrics(frame, faces[0]?.box);
    return { width: frame.width, height: frame.height, faces, metrics, atMs };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = undefined;
    this.activeDelegate = undefined;
    this.timestamps.reset();
  }
}

export function createMediaPipeAnalyzer(opts: MediaPipeAnalyzerOptions): MediaPipeFaceAnalyzer {
  return new MediaPipeAnalyzer(opts);
}
