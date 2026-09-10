/**
 * Analizador mock: determinista, sin modelo. Devuelve los rostros del guion (por defecto un rostro
 * centrado ideal) y métricas calculadas sobre los píxeles si los hay, o ideales si el frame está vacío.
 * Sirve para pruebas, para máquinas sin cámara y para la cámara sintética del kiosco.
 */
import { computeFrameMetrics, IDEAL_FRAME_METRICS } from './metrics';
import { syntheticFace } from './synthetic';
import type { FaceAnalyzer, FrameAnalysis, ImageDataLike, MockFaceScript } from './types';

export const defaultMockScript: MockFaceScript = (_atMs, frame) => [
  syntheticFace({ aspect: frame.height > 0 ? frame.width / frame.height : 1 }),
];

export class MockFaceAnalyzer implements FaceAnalyzer {
  readonly kind = 'mock' as const;
  private readonly script: MockFaceScript;

  constructor(script: MockFaceScript = defaultMockScript) {
    this.script = script;
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  analyze(frame: ImageDataLike, atMs: number): Promise<FrameAnalysis> {
    const faces = this.script(atMs, { width: frame.width, height: frame.height });
    const metrics =
      frame.data.length > 0 ? computeFrameMetrics(frame, faces[0]?.box) : { ...IDEAL_FRAME_METRICS };
    return Promise.resolve({ width: frame.width, height: frame.height, faces, metrics, atMs });
  }

  dispose(): void {
    // Nada que liberar.
  }
}
