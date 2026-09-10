/**
 * Adaptador MediaPipe `GestureRecognizer` con `gesture_recognizer.task` (sólo navegador). Se expone
 * por `@psp/vision/gestures`; la librería se carga con `import()` dinámico dentro de `init()`. Las
 * conversiones (`toGestureName`, `landmarksBox`, `toHands`) son puras y se prueban en Node.
 */
import type {
  Category,
  GestureRecognizer as MpGestureRecognizer,
  GestureRecognizerResult,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import type {
  Box,
  GestureName,
  GestureReading,
  GestureRecognizer,
  HandGesture,
  ImageDataLike,
} from '../types';
import { clamp01 } from '../util';
import {
  createWithDelegate,
  toImageSource,
  VideoTimestamps,
  type MediaPipeAdapterOptions,
  type MediaPipeDelegate,
} from './frame';

export interface MediaPipeGestureOptions extends MediaPipeAdapterOptions {
  /** Manos máximas. Por defecto 2: la persona puede levantar cualquiera de las dos. */
  numHands?: number;
}

export interface MediaPipeGestureRecognizer extends GestureRecognizer {
  readonly kind: 'mediapipe';
  readonly delegate: MediaPipeDelegate | undefined;
}

/** Gestos enlatados de MediaPipe → nombres del producto. Lo que no está en la tabla es `none`. */
const GESTURE_NAMES: Record<string, GestureName> = {
  Open_Palm: 'open_palm',
  Victory: 'victory',
  Thumb_Up: 'thumb_up',
  Closed_Fist: 'closed_fist',
  Pointing_Up: 'pointing_up',
};

export function toGestureName(categoryName: string | undefined): GestureName {
  return (categoryName && GESTURE_NAMES[categoryName]) || 'none';
}

/** Caja de la mano a partir de sus 21 puntos, recortada al cuadro. */
export function landmarksBox(landmarks: NormalizedLandmark[]): Box {
  if (landmarks.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const l of landmarks) {
    if (l.x < minX) minX = l.x;
    if (l.y < minY) minY = l.y;
    if (l.x > maxX) maxX = l.x;
    if (l.y > maxY) maxY = l.y;
  }
  const x = clamp01(minX);
  const y = clamp01(minY);
  return { x, y, w: Math.max(0, clamp01(maxX) - x), h: Math.max(0, clamp01(maxY) - y) };
}

export function toHands(result: Pick<GestureRecognizerResult, 'gestures' | 'landmarks'>): HandGesture[] {
  return result.gestures.map((categories: Category[], i): HandGesture => {
    const top = categories[0];
    return {
      gesture: toGestureName(top?.categoryName),
      score: clamp01(top?.score ?? 0),
      box: landmarksBox(result.landmarks[i] ?? []),
    };
  });
}

class MediaPipeGestures implements MediaPipeGestureRecognizer {
  readonly kind = 'mediapipe' as const;
  private recognizer: MpGestureRecognizer | undefined;
  private initializing: Promise<void> | undefined;
  private readonly timestamps = new VideoTimestamps();
  private activeDelegate: MediaPipeDelegate | undefined;

  constructor(private readonly opts: MediaPipeGestureOptions) {}

  get delegate(): MediaPipeDelegate | undefined {
    return this.activeDelegate;
  }

  init(): Promise<void> {
    if (this.recognizer) return Promise.resolve();
    this.initializing ??= this.load().finally(() => {
      this.initializing = undefined;
    });
    return this.initializing;
  }

  private async load(): Promise<void> {
    const mp = await import('@mediapipe/tasks-vision');
    const fileset = await mp.FilesetResolver.forVisionTasks(this.opts.wasmBaseUrl);
    const { task, delegate } = await createWithDelegate((d) =>
      mp.GestureRecognizer.createFromOptions(fileset, {
        runningMode: 'VIDEO',
        numHands: this.opts.numHands ?? 2,
        baseOptions: { modelAssetPath: this.opts.modelUrl, delegate: d },
      }),
    );
    this.recognizer = task;
    this.activeDelegate = delegate;
  }

  async recognize(frame: ImageDataLike, atMs: number): Promise<GestureReading> {
    if (!this.recognizer) await this.init();
    const recognizer = this.recognizer;
    if (!recognizer) throw new Error('MediaPipe GestureRecognizer no inicializado');
    const source = toImageSource(frame, 'createMediaPipeGestureRecognizer', 'MockGestureRecognizer');
    const result = recognizer.recognizeForVideo(source, this.timestamps.next(atMs));
    return { hands: toHands(result), atMs };
  }

  dispose(): void {
    this.recognizer?.close();
    this.recognizer = undefined;
    this.activeDelegate = undefined;
    this.timestamps.reset();
  }
}

export function createMediaPipeGestureRecognizer(
  opts: MediaPipeGestureOptions,
): MediaPipeGestureRecognizer {
  return new MediaPipeGestures(opts);
}
