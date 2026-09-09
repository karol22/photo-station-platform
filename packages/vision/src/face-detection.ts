/**
 * Detección de rostros: sólo cajas, sin malla. Es la capacidad barata con la que se cuenta gente y
 * se encuadra al grupo en vivo, mientras la malla (`face.landmarks`) queda para el rostro principal.
 *
 * `groupFraming` decide **con lo que la cámara ve**: nunca se le pregunta a nadie cuántos son
 * (`docs/producto/00-que-es.md`), así que una respuesta equivocada no puede romper el encuadre.
 */
import type {
  Box,
  FaceDetectionResult,
  FaceDetector,
  FramingAdvice,
  GroupFramingOptions,
  GroupFramingResult,
  ImageDataLike,
  MockFaceBoxScript,
} from './types';
import { clamp01 } from './util';

/** Valores por defecto de `groupFraming`; se calibran con la cámara real de la cabina. */
export const GROUP_FRAMING_DEFAULTS: Required<GroupFramingOptions> = {
  margin: 0.35,
  minCoverage: 0.15,
  maxCoverage: 0.8,
  centerTolerance: 0.12,
};

const EMPTY_BOX: Box = { x: 0, y: 0, w: 0, h: 0 };

/** Unión de las cajas, en coordenadas normalizadas del cuadro. */
function unionBox(faces: Box[]): Box | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of faces) {
    if (f.w <= 0 || f.h <= 0) continue;
    if (f.x < minX) minX = f.x;
    if (f.y < minY) minY = f.y;
    if (f.x + f.w > maxX) maxX = f.x + f.w;
    if (f.y + f.h > maxY) maxY = f.y + f.h;
  }
  if (!Number.isFinite(minX)) return undefined;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Recorta la caja al cuadro conservando lo que quede dentro. */
function clampBox(box: Box): Box {
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  return { x, y, w: Math.max(0, clamp01(box.x + box.w) - x), h: Math.max(0, clamp01(box.y + box.h) - y) };
}

/**
 * Caja que contiene a todo el grupo con margen, y el consejo de encuadre.
 *
 * El margen se aplica **en píxeles** (proporción del lado mayor de la unión de rostros) y se
 * reparte según la forma del cuadro, para que no quede más aire arriba que a los lados en un cuadro
 * apaisado. La caja devuelta viene recortada al cuadro; que el grupo no quepa se dice en `advice`,
 * no se esconde en la caja.
 *
 * Prioridad del consejo: sin rostros → `nobody`; no cabe o llena el cuadro → `step_back`; ocupa muy
 * poco → `step_closer`; descentrado horizontalmente → `move_center`; si no, `ok`. El descentrado
 * vertical no se corrige pidiendo a la gente que se agache: eso lo arregla el recorte.
 */
export function groupFraming(
  faces: Box[],
  frame: { width: number; height: number },
  opts: GroupFramingOptions = {},
): GroupFramingResult {
  const cfg = { ...GROUP_FRAMING_DEFAULTS, ...opts };
  const union = unionBox(faces);
  if (!union) return { box: EMPTY_BOX, advice: 'nobody' };

  const w = frame.width > 0 ? frame.width : 1;
  const h = frame.height > 0 ? frame.height : 1;
  const padPx = cfg.margin * Math.max(union.w * w, union.h * h);
  const padX = padPx / w;
  const padY = padPx / h;
  const padded: Box = {
    x: union.x - padX,
    y: union.y - padY,
    w: union.w + 2 * padX,
    h: union.h + 2 * padY,
  };
  const coverage = Math.max(0, padded.w) * Math.max(0, padded.h);

  let advice: FramingAdvice;
  if (padded.w > 1 || padded.h > 1 || coverage > cfg.maxCoverage) {
    advice = 'step_back';
  } else if (coverage < cfg.minCoverage) {
    advice = 'step_closer';
  } else if (Math.abs(union.x + union.w / 2 - 0.5) > cfg.centerTolerance) {
    advice = 'move_center';
  } else {
    advice = 'ok';
  }
  return { box: clampBox(padded), advice };
}

/** Guion por defecto: un rostro centrado, del tamaño de quien se planta a un metro de la cámara. */
export const defaultFaceBoxScript: MockFaceBoxScript = () => [{ x: 0.35, y: 0.2, w: 0.3, h: 0.4 }];

export class MockFaceDetector implements FaceDetector {
  readonly kind = 'mock' as const;
  private readonly script: MockFaceBoxScript;

  /** Acepta una lista fija de cajas o un guion que las calcula por instante. */
  constructor(script: MockFaceBoxScript | Box[] = defaultFaceBoxScript) {
    this.script = typeof script === 'function' ? script : () => script;
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  detect(frame: ImageDataLike, atMs: number): Promise<FaceDetectionResult> {
    const faces = this.script(atMs, { width: frame.width, height: frame.height });
    return Promise.resolve({ faces, atMs });
  }

  dispose(): void {
    // Nada que liberar.
  }
}
