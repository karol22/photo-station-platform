/**
 * Piezas compartidas por los adaptadores de MediaPipe. Nada de esto importa la librería: sólo
 * prepara el cuadro, el delegado y las marcas de tiempo, y por eso se puede probar en Node.
 */
import type { ImageDataLike } from '../types';

export type MediaPipeDelegate = 'GPU' | 'CPU';

/** Base de opciones que comparten los cuatro adaptadores (modelo y WASM se sirven locales). */
export interface MediaPipeAdapterOptions {
  /** URL del modelo, servido por la propia aplicación (sin conexión). */
  modelUrl: string;
  /** Directorio base con `vision_wasm_*_internal.{js,wasm}` (en el kiosco: `/wasm`). */
  wasmBaseUrl: string;
}

/**
 * Construye la fuente de imagen que MediaPipe acepta. Requiere `ImageData`, es decir un navegador;
 * en Node el camino es el mock, y por eso el error lo dice con nombre y apellido.
 */
export function toImageSource(frame: ImageDataLike, adapter: string, mock: string): ImageData {
  if (typeof ImageData === 'undefined') {
    throw new Error(`${adapter} requiere un navegador con ImageData; en Node usa ${mock}`);
  }
  if (frame instanceof ImageData) return frame;
  return new ImageData(frame.data as Uint8ClampedArray<ArrayBuffer>, frame.width, frame.height);
}

/**
 * Crea la tarea en GPU y reintenta en CPU. Sin WebGL utilizable (o con el contexto ya tomado por la
 * vista previa) el reintento es lo único que mantiene viva la capacidad en una máquina modesta.
 */
export async function createWithDelegate<T>(
  create: (delegate: MediaPipeDelegate) => Promise<T>,
): Promise<{ task: T; delegate: MediaPipeDelegate }> {
  try {
    return { task: await create('GPU'), delegate: 'GPU' };
  } catch {
    return { task: await create('CPU'), delegate: 'CPU' };
  }
}

/** Las APIs `*ForVideo` exigen marcas de tiempo estrictamente crecientes. */
export class VideoTimestamps {
  private last = -1;

  next(atMs: number): number {
    const timestamp = atMs > this.last ? atMs : this.last + 1;
    this.last = timestamp;
    return timestamp;
  }

  reset(): void {
    this.last = -1;
  }
}
