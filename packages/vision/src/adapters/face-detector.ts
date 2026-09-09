/**
 * Adaptador MediaPipe `FaceDetector` con `blaze_face_short_range.tflite` (sólo navegador). Se expone
 * por `@psp/vision/face-detector`. Es el modelo más barato del conjunto: da sólo cajas, y con eso
 * alcanza para contar personas y encuadrar al grupo en vivo.
 */
import type { Detection, FaceDetector as MpFaceDetector, FaceDetectorResult } from '@mediapipe/tasks-vision';
import type { Box, FaceDetectionResult, FaceDetector, ImageDataLike } from '../types';
import { clamp01 } from '../util';
import {
  createWithDelegate,
  toImageSource,
  VideoTimestamps,
  type MediaPipeAdapterOptions,
  type MediaPipeDelegate,
} from './frame';

export interface MediaPipeFaceDetectorOptions extends MediaPipeAdapterOptions {
  /** Confianza mínima del detector. Por defecto la de MediaPipe (0.5). */
  minDetectionConfidence?: number;
}

export interface MediaPipeFaceDetectorPort extends FaceDetector {
  readonly kind: 'mediapipe';
  readonly delegate: MediaPipeDelegate | undefined;
}

/**
 * Detecciones de MediaPipe → cajas normalizadas. MediaPipe devuelve la caja en **píxeles** del
 * cuadro analizado; aquí se normaliza a 0..1 para que el resto del paquete hable un solo idioma.
 */
export function toFaceBoxes(
  detections: Detection[],
  frame: { width: number; height: number },
): Box[] {
  const w = frame.width > 0 ? frame.width : 1;
  const h = frame.height > 0 ? frame.height : 1;
  const boxes: Box[] = [];
  for (const d of detections) {
    const bb = d.boundingBox;
    if (!bb) continue;
    const x = clamp01(bb.originX / w);
    const y = clamp01(bb.originY / h);
    boxes.push({
      x,
      y,
      w: Math.max(0, clamp01((bb.originX + bb.width) / w) - x),
      h: Math.max(0, clamp01((bb.originY + bb.height) / h) - y),
    });
  }
  return boxes;
}

class MediaPipeFaceDetection implements MediaPipeFaceDetectorPort {
  readonly kind = 'mediapipe' as const;
  private detector: MpFaceDetector | undefined;
  private initializing: Promise<void> | undefined;
  private readonly timestamps = new VideoTimestamps();
  private activeDelegate: MediaPipeDelegate | undefined;

  constructor(private readonly opts: MediaPipeFaceDetectorOptions) {}

  get delegate(): MediaPipeDelegate | undefined {
    return this.activeDelegate;
  }

  init(): Promise<void> {
    if (this.detector) return Promise.resolve();
    this.initializing ??= this.load().finally(() => {
      this.initializing = undefined;
    });
    return this.initializing;
  }

  private async load(): Promise<void> {
    const mp = await import('@mediapipe/tasks-vision');
    const fileset = await mp.FilesetResolver.forVisionTasks(this.opts.wasmBaseUrl);
    const confidence = this.opts.minDetectionConfidence;
    const { task, delegate } = await createWithDelegate((d) =>
      mp.FaceDetector.createFromOptions(fileset, {
        runningMode: 'VIDEO',
        ...(confidence === undefined ? {} : { minDetectionConfidence: confidence }),
        baseOptions: { modelAssetPath: this.opts.modelUrl, delegate: d },
      }),
    );
    this.detector = task;
    this.activeDelegate = delegate;
  }

  async detect(frame: ImageDataLike, atMs: number): Promise<FaceDetectionResult> {
    if (!this.detector) await this.init();
    const detector = this.detector;
    if (!detector) throw new Error('MediaPipe FaceDetector no inicializado');
    const source = toImageSource(frame, 'createMediaPipeFaceDetector', 'MockFaceDetector');
    const result: FaceDetectorResult = detector.detectForVideo(source, this.timestamps.next(atMs));
    return { faces: toFaceBoxes(result.detections, frame), atMs };
  }

  dispose(): void {
    this.detector?.close();
    this.detector = undefined;
    this.activeDelegate = undefined;
    this.timestamps.reset();
  }
}

export function createMediaPipeFaceDetector(
  opts: MediaPipeFaceDetectorOptions,
): MediaPipeFaceDetectorPort {
  return new MediaPipeFaceDetection(opts);
}
