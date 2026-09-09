/**
 * Adaptador MediaPipe `ImageSegmenter` con `selfie_segmenter.tflite` (sólo navegador). Se expone
 * por `@psp/vision/segmenter`; el índice del paquete no lo importa, para que el resto corra en Node.
 * La librería se carga con `import()` dinámico dentro de `init()`.
 *
 * Servido de WASM y modelos: `packages/vision/docs/mediapipe.md`.
 */
import type { ImageSegmenter, ImageSegmenterResult, MPMask } from '@mediapipe/tasks-vision';
import type { ImageDataLike, PersonSegmenter, SegmentationMask } from '../types';
import { createMask } from '../mask';
import {
  createWithDelegate,
  toImageSource,
  VideoTimestamps,
  type MediaPipeAdapterOptions,
  type MediaPipeDelegate,
} from './frame';

export interface MediaPipeSegmenterOptions extends MediaPipeAdapterOptions {
  /**
   * Índice de la categoría "persona" en la máscara de categorías. Por defecto 1 (0 = fondo).
   * Algunos empaquetados devuelven 0/255 en vez de índices, y eso también se acepta.
   */
  personCategoryIndex?: number;
  /** Índice de la máscara de confianza de persona, cuando el modelo no da máscara de categorías. */
  personConfidenceIndex?: number;
  /** Confianza mínima para dar un píxel por persona, 0..1. */
  confidenceThreshold?: number;
}

export interface MediaPipePersonSegmenter extends PersonSegmenter {
  readonly kind: 'mediapipe';
  /** Delegado con el que se inicializó (`GPU`, o `CPU` tras el reintento). */
  readonly delegate: MediaPipeDelegate | undefined;
}

/**
 * Máscara de categorías a máscara de persona. Acepta las dos convenciones que aparecen en la
 * práctica: índices de clase (0 fondo, 1 persona) y bytes 0/255. Puro, se prueba en Node.
 */
export function categoryMaskToPersonMask(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  personCategoryIndex = 1,
): SegmentationMask {
  const mask = createMask(width, height);
  const n = Math.min(mask.data.length, data.length);
  for (let i = 0; i < n; i++) {
    const v = data[i] ?? 0;
    mask.data[i] = v === personCategoryIndex || v >= 128 ? 255 : 0;
  }
  return mask;
}

/** Máscara de confianza (0..1 por píxel) a máscara binaria de persona. */
export function confidenceMaskToPersonMask(
  data: Float32Array,
  width: number,
  height: number,
  threshold = 0.5,
): SegmentationMask {
  const mask = createMask(width, height);
  const n = Math.min(mask.data.length, data.length);
  for (let i = 0; i < n; i++) mask.data[i] = (data[i] ?? 0) >= threshold ? 255 : 0;
  return mask;
}

class MediaPipeSegmenter implements MediaPipePersonSegmenter {
  readonly kind = 'mediapipe' as const;
  private segmenter: ImageSegmenter | undefined;
  private initializing: Promise<void> | undefined;
  private readonly timestamps = new VideoTimestamps();
  private activeDelegate: MediaPipeDelegate | undefined;

  constructor(private readonly opts: MediaPipeSegmenterOptions) {}

  get delegate(): MediaPipeDelegate | undefined {
    return this.activeDelegate;
  }

  init(): Promise<void> {
    if (this.segmenter) return Promise.resolve();
    this.initializing ??= this.load().finally(() => {
      this.initializing = undefined;
    });
    return this.initializing;
  }

  private async load(): Promise<void> {
    const mp = await import('@mediapipe/tasks-vision');
    const fileset = await mp.FilesetResolver.forVisionTasks(this.opts.wasmBaseUrl);
    const { task, delegate } = await createWithDelegate((d) =>
      mp.ImageSegmenter.createFromOptions(fileset, {
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: true,
        baseOptions: { modelAssetPath: this.opts.modelUrl, delegate: d },
      }),
    );
    this.segmenter = task;
    this.activeDelegate = delegate;
  }

  /** La máscara sale con la resolución del modelo, no la del cuadro: escalarla es del consumidor. */
  private convert(result: ImageSegmenterResult): SegmentationMask {
    const category: MPMask | undefined = result.categoryMask;
    if (category) {
      return categoryMaskToPersonMask(
        category.getAsUint8Array(),
        category.width,
        category.height,
        this.opts.personCategoryIndex ?? 1,
      );
    }
    const masks = result.confidenceMasks ?? [];
    const index = this.opts.personConfidenceIndex ?? (masks.length > 1 ? 1 : 0);
    const confidence = masks[index];
    if (!confidence) return createMask(0, 0);
    return confidenceMaskToPersonMask(
      confidence.getAsFloat32Array(),
      confidence.width,
      confidence.height,
      this.opts.confidenceThreshold ?? 0.5,
    );
  }

  async segment(frame: ImageDataLike, atMs: number): Promise<SegmentationMask> {
    if (!this.segmenter) await this.init();
    const segmenter = this.segmenter;
    if (!segmenter) throw new Error('MediaPipe ImageSegmenter no inicializado');
    const source = toImageSource(frame, 'createMediaPipeSegmenter', 'MockPersonSegmenter');
    const result = segmenter.segmentForVideo(source, this.timestamps.next(atMs));
    try {
      return this.convert(result);
    } finally {
      // Las máscaras viven en GPU hasta que se cierran; sin esto la vista previa se queda sin memoria.
      result.close();
    }
  }

  dispose(): void {
    this.segmenter?.close();
    this.segmenter = undefined;
    this.activeDelegate = undefined;
    this.timestamps.reset();
  }
}

export function createMediaPipeSegmenter(opts: MediaPipeSegmenterOptions): MediaPipePersonSegmenter {
  return new MediaPipeSegmenter(opts);
}
