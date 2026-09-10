/**
 * Elementos pegados a la cara: lentes, sombreros, orejas y adornos que siguen al rostro.
 *
 * Los puntos del rostro llegan como un tipo **estructural** de coordenadas normalizadas 0..1 (el mismo
 * layout que publica cualquier malla facial), así que este paquete no importa el motor de visión.
 * El anclaje se calcula en un marco girado con la línea de los ojos: si la cabeza se inclina, el elemento
 * se inclina igual y el desplazamiento sigue siendo "encima de la frente", no "más arriba en la imagen".
 */
import { clamp, clampByte } from './raster';
import type { Raster } from './raster';

/** Punto normalizado 0..1: `x` respecto al ancho de la imagen, `y` respecto al alto. */
export type Point2 = { x: number; y: number };

/**
 * Puntos del rostro que necesita el anclaje. Sólo los ojos son obligatorios: son los que fijan la escala y
 * la inclinación, y el resto se estima a partir de ellos cuando el motor de visión no los entrega.
 * `leftEye` es el ojo que aparece a la **izquierda de la imagen**.
 */
export type FaceLandmarks = {
  leftEye: Point2;
  rightEye: Point2;
  noseTip?: Point2;
  mouthCenter?: Point2;
  chin?: Point2;
  /** Ancho del rostro normalizado al ancho de la imagen. Si falta se estima como 2.2× la distancia entre ojos. */
  faceWidth?: number;
};

/** Dónde se pega el elemento. */
export type PropAnchor = 'eyes' | 'forehead' | 'nose' | 'mouth' | 'chin' | 'head';

export type PropSpec = {
  anchor: PropAnchor;
  /** Ancho del elemento como múltiplo del ancho del rostro. 1 = tan ancho como la cara. */
  scale: number;
  /** Relación alto/ancho del elemento. 1 por defecto (cuadrado). */
  aspect?: number;
  /**
   * Desplazamiento desde el ancla, en anchos de rostro y en el **marco girado** del rostro:
   * `x` a lo largo de la línea de los ojos, `y` hacia la barbilla.
   */
  offset?: Point2;
  /** Sigue la inclinación de la cabeza. `true` por defecto; en `false` el elemento queda a nivel. */
  followRoll?: boolean;
};

/**
 * Colocación en píxeles. `x`/`y`/`w`/`h` describen la caja **sin girar** (esquina superior izquierda) y
 * `rotationDeg` el giro alrededor de su centro, en grados horarios (el eje `y` crece hacia abajo).
 */
export type PropPlacement = { x: number; y: number; w: number; h: number; rotationDeg: number };

export type RasterSize = { width: number; height: number };

/** Desplazamiento del ancla desde el punto medio de los ojos, en anchos de rostro hacia la barbilla. */
const ANCHOR_DROP: Record<PropAnchor, number> = {
  eyes: 0,
  forehead: -0.45,
  nose: 0.35,
  mouth: 0.62,
  chin: 0.95,
  head: 0.2,
};

/**
 * Calcula dónde y con qué inclinación va un elemento.
 *
 * Sin `size` devuelve coordenadas normalizadas (equivale a un raster de 1×1); con `size` devuelve píxeles.
 * La inclinación es el ángulo de la línea de los ojos **en píxeles**, así que una imagen no cuadrada no
 * la falsea.
 *
 * Coste: **bajo**. Es aritmética sobre unos pocos puntos, corre en cada cuadro sin problema.
 */
export function anchorProp(landmarks: FaceLandmarks, spec: PropSpec, size: RasterSize = { width: 1, height: 1 }): PropPlacement {
  const w = size.width;
  const h = size.height;
  const lx = landmarks.leftEye.x * w;
  const ly = landmarks.leftEye.y * h;
  const rx = landmarks.rightEye.x * w;
  const ry = landmarks.rightEye.y * h;
  const dx = rx - lx;
  const dy = ry - ly;
  const eyeDistPx = Math.hypot(dx, dy);
  const follow = spec.followRoll !== false;
  const angle = follow && eyeDistPx > 0 ? Math.atan2(dy, dx) : 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Ancho del rostro en píxeles: el declarado, o 2.2× la distancia entre ojos (proporción típica de un rostro).
  const faceWidthPx = landmarks.faceWidth !== undefined && landmarks.faceWidth > 0 ? landmarks.faceWidth * w : eyeDistPx * 2.2;

  const eyesX = (lx + rx) / 2;
  const eyesY = (ly + ry) / 2;
  const explicit = explicitAnchor(landmarks, spec.anchor, w, h);
  const drop = ANCHOR_DROP[spec.anchor] * faceWidthPx;
  // Ejes del rostro: `u` a lo largo de la línea de los ojos, `v` perpendicular hacia la barbilla.
  let cx = explicit ? explicit.x : eyesX - sin * drop;
  let cy = explicit ? explicit.y : eyesY + cos * drop;

  const off = spec.offset;
  if (off) {
    cx += (off.x * cos - off.y * sin) * faceWidthPx;
    cy += (off.x * sin + off.y * cos) * faceWidthPx;
  }

  const boxW = Math.max(0, spec.scale) * faceWidthPx;
  const boxH = boxW * (spec.aspect !== undefined && spec.aspect > 0 ? spec.aspect : 1);
  return { x: cx - boxW / 2, y: cy - boxH / 2, w: boxW, h: boxH, rotationDeg: (angle * 180) / Math.PI };
}

function explicitAnchor(l: FaceLandmarks, anchor: PropAnchor, w: number, h: number): Point2 | undefined {
  const p = anchor === 'nose' ? l.noseTip : anchor === 'mouth' ? l.mouthCenter : anchor === 'chin' ? l.chin : undefined;
  return p ? { x: p.x * w, y: p.y * h } : undefined;
}

export type DrawPropOptions = { opacity?: number };

/**
 * Dibuja el elemento girado sobre la foto, con muestreo bilineal y composición alfa sobre el destino.
 * Recorre sólo la caja envolvente del elemento girado y **recorta a los límites del raster**: una
 * colocación que se sale no lanza ni escribe fuera, sólo se ve parcialmente.
 *
 * Coste: **bajo**. Una pasada sobre el área del elemento (no sobre toda la foto), con mapeo inverso: por
 * cada píxel de destino, una rotación inversa y cuatro lecturas.
 */
export function drawProp(r: Raster, prop: Raster, placement: PropPlacement, opts: DrawPropOptions = {}): Raster {
  const out = { width: r.width, height: r.height, data: new Uint8ClampedArray(r.data) };
  drawPropInto(out, prop, placement, opts);
  return out;
}

/** Igual que `drawProp` pero en el lugar, para la vista previa donde no conviene copiar el cuadro. */
export function drawPropInto(r: Raster, prop: Raster, placement: PropPlacement, opts: DrawPropOptions = {}): void {
  const opacity = clamp(opts.opacity ?? 1, 0, 1);
  if (opacity === 0 || placement.w <= 0 || placement.h <= 0) return;
  const angle = (placement.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = placement.x + placement.w / 2;
  const cy = placement.y + placement.h / 2;
  // Caja envolvente del rectángulo girado.
  const hx = Math.abs((placement.w / 2) * cos) + Math.abs((placement.h / 2) * sin);
  const hy = Math.abs((placement.w / 2) * sin) + Math.abs((placement.h / 2) * cos);
  const x0 = Math.max(0, Math.floor(cx - hx));
  const x1 = Math.min(r.width - 1, Math.ceil(cx + hx));
  const y0 = Math.max(0, Math.floor(cy - hy));
  const y1 = Math.min(r.height - 1, Math.ceil(cy + hy));
  if (x1 < x0 || y1 < y0) return;
  const sxScale = prop.width / placement.w;
  const syScale = prop.height / placement.h;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      // Rotación inversa: del marco de la imagen al marco del elemento.
      const ux = px * cos + py * sin + placement.w / 2;
      const uy = -px * sin + py * cos + placement.h / 2;
      if (ux < 0 || uy < 0 || ux >= placement.w || uy >= placement.h) continue;
      const sx = ux * sxScale - 0.5;
      const sy = uy * syScale - 0.5;
      const sample = bilinearSample(prop, sx, sy);
      const a = (sample[3] / 255) * opacity;
      if (a <= 0) continue;
      const di = (y * r.width + x) * 4;
      const ba = r.data[di + 3]! / 255;
      const outA = a + ba * (1 - a);
      if (outA <= 0) continue;
      for (let c = 0; c < 3; c++) {
        r.data[di + c] = clampByte((sample[c]! * a + r.data[di + c]! * ba * (1 - a)) / outA);
      }
      r.data[di + 3] = clampByte(outA * 255);
    }
  }
}

/** Muestreo bilineal con bordes fijados (clamp). Devuelve RGBA sin redondear el alfa. */
function bilinearSample(r: Raster, x: number, y: number): [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ax = clamp(x0, 0, r.width - 1);
  const bx = clamp(x0 + 1, 0, r.width - 1);
  const ay = clamp(y0, 0, r.height - 1);
  const by = clamp(y0 + 1, 0, r.height - 1);
  const i00 = (ay * r.width + ax) * 4;
  const i10 = (ay * r.width + bx) * 4;
  const i01 = (by * r.width + ax) * 4;
  const i11 = (by * r.width + bx) * 4;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = r.data[i00 + c]! + (r.data[i10 + c]! - r.data[i00 + c]!) * fx;
    const bottom = r.data[i01 + c]! + (r.data[i11 + c]! - r.data[i01 + c]!) * fx;
    out[c] = top + (bottom - top) * fy;
  }
  return out;
}
