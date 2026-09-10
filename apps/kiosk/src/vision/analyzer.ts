/**
 * Analizador facial del kiosco: MediaPipe Face Landmarker con el modelo vendido en `/models` y el
 * WASM servido en `/wasm`. Si no carga, cae a `MockFaceAnalyzer` (guía limitada, captura manual).
 */
import type { FaceAnalyzer } from '@psp/vision';
import { MockFaceAnalyzer } from '@psp/vision';
import { createMediaPipeAnalyzer } from '@psp/vision/mediapipe';

export const MODEL_URL = '/models/face_landmarker.task';
export const WASM_BASE_URL = '/wasm';

let cached: Promise<{ analyzer: FaceAnalyzer; limited: boolean }> | undefined;

export function createAnalyzer(): Promise<{ analyzer: FaceAnalyzer; limited: boolean }> {
  if (!cached) {
    cached = (async () => {
      try {
        const analyzer = createMediaPipeAnalyzer({ modelUrl: MODEL_URL, wasmBaseUrl: WASM_BASE_URL, numFaces: 2 });
        await analyzer.init();
        return { analyzer, limited: false };
      } catch {
        // Sin landmarks reales no hay guía: el mock devuelve una lista vacía de rostros.
        const analyzer = new MockFaceAnalyzer(() => []);
        await analyzer.init();
        return { analyzer, limited: true };
      }
    })();
  }
  return cached;
}
