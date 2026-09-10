/**
 * Segmentador mock: determinista, sin modelo. Dibuja una silueta ovalada centrada (cabeza y
 * hombros) cuyo tamaño y posición se inyectan, para que las pruebas y la cámara sintética del
 * kiosco puedan probar fondos, desenfoques y recortes sin descargar nada.
 *
 * Igual que el modelo real, devuelve la máscara a **menor resolución que el cuadro**: quien la
 * consuma debe escalarla (`scaleMask`), y así el mock no esconde ese detalle.
 */
import { createMask } from './mask';
import type {
  ImageDataLike,
  MockSilhouetteScript,
  PersonSegmenter,
  SegmentationMask,
  SilhouetteOptions,
} from './types';

/** Silueta por defecto: persona centrada, de medio cuerpo, como quien se planta frente a la cabina. */
export const DEFAULT_SILHOUETTE: Omit<SilhouetteOptions, 'width' | 'height'> = {
  cx: 0.5,
  headCy: 0.3,
  headHeight: 0.34,
  shoulderWidth: 0.8,
};

/** Lado mayor de la máscara que devuelve el mock, igual al del modelo real. */
export const MOCK_MASK_MAX_SIDE = 256;

/** Tamaño de máscara que usa el mock cuando no se inyecta uno: el cuadro reducido a 256 px de lado mayor. */
export function defaultMaskSize(frame: { width: number; height: number }): {
  width: number;
  height: number;
} {
  const w = Math.max(0, Math.floor(frame.width));
  const h = Math.max(0, Math.floor(frame.height));
  if (w === 0 || h === 0) return { width: 0, height: 0 };
  const scale = Math.min(1, MOCK_MASK_MAX_SIDE / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Máscara binaria con la unión de dos óvalos: la cabeza y el torso con hombros, que se sale por
 * abajo del cuadro como se sale una persona de pie frente a la cámara.
 */
export function personSilhouetteMask(opts: Partial<SilhouetteOptions> = {}): SegmentationMask {
  const cfg = { ...DEFAULT_SILHOUETTE, width: 256, height: 256, ...opts };
  const mask = createMask(cfg.width, cfg.height);
  const { width: w, height: h } = mask;
  if (w === 0 || h === 0) return mask;

  const headRy = (cfg.headHeight * h) / 2;
  const headRx = headRy * 0.75;
  const headCx = cfg.cx * w;
  const headCy = cfg.headCy * h;
  // Los hombros arrancan un poco por encima de la barbilla, para que la silueta quede de una pieza.
  const torsoCy = headCy + cfg.headHeight * h * 0.45;
  const torsoRx = (cfg.shoulderWidth * w) / 2;
  const torsoRy = Math.max(1, (h - torsoCy) * 1.6);

  const inside = (px: number, py: number, cx: number, cy: number, rx: number, ry: number): boolean => {
    if (rx <= 0 || ry <= 0) return false;
    const dx = (px - cx) / rx;
    const dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };

  for (let y = 0; y < h; y++) {
    const py = y + 0.5;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      // Del torso sólo cuenta la mitad de abajo: arriba de los hombros no hay nada más que la cabeza.
      if (inside(px, py, headCx, headCy, headRx, headRy) || (py >= torsoCy && inside(px, py, headCx, torsoCy, torsoRx, torsoRy))) {
        mask.data[row + x] = 255;
      }
    }
  }
  return mask;
}

export class MockPersonSegmenter implements PersonSegmenter {
  readonly kind = 'mock' as const;
  private readonly script: MockSilhouetteScript;

  /** Acepta una silueta fija o un guion que la calcula por instante (determinista: sin reloj propio). */
  constructor(opts: Partial<SilhouetteOptions> | MockSilhouetteScript = {}) {
    this.script = typeof opts === 'function' ? opts : () => opts;
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  segment(frame: ImageDataLike, atMs: number): Promise<SegmentationMask> {
    const size = defaultMaskSize(frame);
    const injected = this.script(atMs, { width: frame.width, height: frame.height });
    return Promise.resolve(personSilhouetteMask({ ...size, ...injected }));
  }

  dispose(): void {
    // Nada que liberar.
  }
}
