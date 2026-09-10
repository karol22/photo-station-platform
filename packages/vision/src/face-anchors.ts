/**
 * Anclas de accesorios: dónde va un sombrero, unos lentes, un bigote o unos aretes sobre un rostro.
 *
 * Es aritmética pura sobre la malla que ya devuelve `FaceAnalyzer`. **No agrega ninguna capacidad de
 * visión**: consume `face.landmarks`, que ya está declarada con equivalente en Android
 * (`com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker`), así que su paridad Android es
 * exactamente la de esa capacidad y entra al recorrido básico sin condiciones nuevas.
 *
 * Todo se calcula en un **marco girado con el rostro**: el eje `down` va de la frente a la barbilla y
 * `right` es su perpendicular hacia la derecha de la imagen. Así "encima de la cabeza" sigue siendo
 * encima de la cabeza cuando la persona ladea la cara, y no "más arriba en la imagen".
 *
 * El resultado sale en **coordenadas normalizadas 0..1** (centro y tamaño) para que sirva a cualquier
 * resolución: la misma ancla vale para la vista previa de 360 px y para la foto de 3000 px.
 *
 * Determinista: mismos puntos, misma ancla. Sin reloj y sin aleatoriedad.
 */
import { FACE_MESH_POINTS_WITHOUT_IRIS, LM, measureFace } from './face-model';
import type { FaceMeasurements, Vec2 } from './face-model';
import type { FaceLandmarks } from './types';
import { clamp01 } from './util';

/**
 * Accesorios que sabemos colocar. Las dos piezas de arete son claves distintas y no un par, porque
 * cada oreja se esconde con un giro de cabeza distinto y cada una tiene su propia confianza.
 * `earringLeft` es la oreja que aparece a la **izquierda de la imagen**, como todo en este paquete.
 */
export type PropKind = 'hat' | 'glasses' | 'moustache' | 'earringLeft' | 'earringRight';

export const PROP_KINDS: PropKind[] = ['hat', 'glasses', 'moustache', 'earringLeft', 'earringRight'];

/** Punto anatómico sobre el que se apoya el accesorio. */
export type PropReference = 'crown' | 'eyes' | 'philtrum' | 'earLeft' | 'earRight';

export interface PropGeometry {
  reference: PropReference;
  /** Ancho de la caja como múltiplo del ancho del rostro medido (puntos 234↔454 proyectados). */
  widthOverFaceWidth: number;
  /** Alto/ancho **esperado del activo**. Se puede sustituir por el del activo real con `assetAspect`. */
  heightOverWidth: number;
  /** Desplazamiento desde el punto de referencia hacia la barbilla, en altos de rostro. */
  dropOverFaceHeight: number;
  /** Desplazamiento hacia afuera de la línea media, en anchos de rostro. Sólo lo usan los aretes. */
  outOverFaceWidth: number;
  /** Qué borde de la caja se apoya en el punto de referencia (`bottom` = el ala del sombrero). */
  align: 'center' | 'top' | 'bottom';
  /**
   * Qué signo de `yawDeg` esconde la pieza: `+1` la esconde al girar hacia la derecha de la imagen,
   * `-1` al girar hacia la izquierda, `0` es simétrica y se degrada con |yaw|.
   */
  hiddenByYaw: -1 | 0 | 1;
  /** Hasta este giro la pieza es perfectamente creíble (confianza 1). */
  yawFullDeg: number;
  /** A partir de este giro la pieza ya no se sostiene (confianza 0). */
  yawLimitDeg: number;
}

/**
 * Geometría por accesorio, en proporciones del rostro medido. Los números salen de anatomía, no de
 * gusto: el ala del sombrero se apoya justo por encima de la coronilla, los lentes miden de sien a
 * sien, el bigote vive entre la base de la nariz y el labio, y el arete cuelga del contorno lateral
 * a la altura de la punta de la nariz.
 */
export const PROP_GEOMETRY: Record<PropKind, PropGeometry> = {
  // El ala se apoya un poco por debajo de la coronilla para que muerda la cabeza y no flote.
  hat: { reference: 'crown', widthOverFaceWidth: 1.32, heightOverWidth: 0.72, dropOverFaceHeight: 0.06, outOverFaceWidth: 0, align: 'bottom', hiddenByYaw: 0, yawFullDeg: 30, yawLimitDeg: 60 },
  // De sien a sien: el ancho del rostro proyectado ya encoge solo cuando la cabeza gira.
  glasses: { reference: 'eyes', widthOverFaceWidth: 1, heightOverWidth: 0.38, dropOverFaceHeight: 0.015, outOverFaceWidth: 0, align: 'center', hiddenByYaw: 0, yawFullDeg: 30, yawLimitDeg: 55 },
  // Un tercio más ancho que la boca en reposo, centrado en el filtro.
  moustache: { reference: 'philtrum', widthOverFaceWidth: 0.48, heightOverWidth: 0.34, dropOverFaceHeight: 0, outOverFaceWidth: 0, align: 'center', hiddenByYaw: 0, yawFullDeg: 25, yawLimitDeg: 50 },
  /**
   * Cuelga del lóbulo: el borde superior de la caja es el punto de sujeción.
   *
   * La ventana de giro es estrecha a propósito y sale de las fotos reales: **la malla no tiene
   * puntos de oreja** —los 478 se acaban en el contorno del rostro—, así que el lóbulo se infiere
   * del contorno lateral. Con la cabeza de frente cae a menos de 0.08 anchos de rostro del borde de
   * la silueta; en cuanto la cara gira, el contorno del lado que se va deja de coincidir con la
   * oreja y la pieza se va a la mandíbula. Por eso a 20° ya no se pone: un arete en el pómulo es
   * peor que ningún arete.
   */
  earringLeft: { reference: 'earLeft', widthOverFaceWidth: 0.13, heightOverWidth: 1.8, dropOverFaceHeight: 0, outOverFaceWidth: 0.04, align: 'top', hiddenByYaw: -1, yawFullDeg: 8, yawLimitDeg: 20 },
  earringRight: { reference: 'earRight', widthOverFaceWidth: 0.13, heightOverWidth: 1.8, dropOverFaceHeight: 0, outOverFaceWidth: 0.04, align: 'top', hiddenByYaw: 1, yawFullDeg: 8, yawLimitDeg: 20 },
};

/** Mezcla nariz→labio que marca el filtro (surco nasolabial). 0 = punta de la nariz, 1 = labio. */
const PHILTRUM_MIX = 0.62;

/** Caída del lóbulo desde el contorno lateral, en altos de rostro: lo deja a la altura de la nariz. */
const EAR_DROP_OVER_FACE_HEIGHT = 0.14;

export interface PropAnchorOptions {
  /**
   * Relación ancho/alto del cuadro donde se midieron los puntos (`analysis.width / analysis.height`).
   * Por defecto 1. Importa: sin ella, en un cuadro 4:3 el ángulo y el ancho salen deformados.
   */
  frameAspect?: number;
  /** Alto/ancho del activo real. Sustituye a `heightOverWidth` de la geometría. */
  assetAspect?: number;
  /** Multiplica el tamaño de la caja. Sirve para activos con márgenes transparentes. 1 por defecto. */
  scale?: number;
  /** Confianza mínima para devolver el ancla. 0.35 por defecto. */
  minConfidence?: number;
  /** Gira la caja con la inclinación de la cabeza. `true` por defecto; en `false` queda a nivel. */
  followRoll?: boolean;
}

/**
 * Dónde va el accesorio, en coordenadas normalizadas 0..1 respecto al cuadro.
 * `x`/`width` son fracción del ancho; `y`/`height`, del alto. `x`/`y` son el **centro** de la caja.
 */
export interface PropAnchor {
  kind: PropKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Giro horario en grados alrededor del centro (el eje `y` crece hacia abajo). */
  angleDeg: number;
  /** 0..1: confianza del rostro degradada por el giro que esconde la pieza. */
  confidence: number;
}

/**
 * Confianza de una pieza: la del rostro, degradada linealmente entre `yawFullDeg` y `yawLimitDeg`.
 * Una pieza simétrica mira |yaw|; una de dos piezas sólo el giro que la esconde (la oreja que se
 * acerca a la cámara no pierde confianza porque se vea mejor).
 */
export function propConfidence(kind: PropKind, score: number, yawDeg: number): number {
  const g = PROP_GEOMETRY[kind];
  const turn = g.hiddenByYaw === 0 ? Math.abs(yawDeg) : Math.max(0, g.hiddenByYaw * yawDeg);
  const span = g.yawLimitDeg - g.yawFullDeg;
  const factor = span <= 0 ? (turn <= g.yawFullDeg ? 1 : 0) : clamp01((g.yawLimitDeg - turn) / span);
  return clamp01(score) * factor;
}

/**
 * Calcula dónde va un accesorio sobre un rostro.
 *
 * Devuelve `undefined` cuando la malla está incompleta, cuando el rostro es degenerado (ancho cero)
 * o cuando la confianza queda por debajo de `minConfidence`: una pieza que no se sostiene no se pega,
 * no se pega mal.
 *
 * Coste: **bajo**. Unas decenas de operaciones sobre seis puntos; corre en cada cuadro sin pensarlo.
 */
export function anchorFor(kind: PropKind, face: FaceLandmarks, opts: PropAnchorOptions = {}): PropAnchor | undefined {
  if (face.points.length < FACE_MESH_POINTS_WITHOUT_IRIS) return undefined;
  const aspect = opts.frameAspect !== undefined && opts.frameAspect > 0 ? opts.frameAspect : 1;

  // Se mide en un cuadro de alto 1 y ancho `aspect`: ahí los píxeles son cuadrados, así que las
  // distancias y el ángulo son los de la imagen y no los de un espacio estirado.
  const m = measureFace(face, { width: aspect, height: 1 });
  if (!(m.faceWidthPx > 0) || !(m.faceHeightPx > 0)) return undefined;

  const confidence = propConfidence(kind, face.score, m.yawDeg);
  if (confidence < (opts.minConfidence ?? 0.35)) return undefined;

  const g = PROP_GEOMETRY[kind];
  const axes = faceAxes(m);
  const anchorPoint = referencePoint(g.reference, face, m, axes, aspect);

  const scale = opts.scale !== undefined && opts.scale > 0 ? opts.scale : 1;
  const w = g.widthOverFaceWidth * m.faceWidthPx * scale;
  const ratio = opts.assetAspect !== undefined && opts.assetAspect > 0 ? opts.assetAspect : g.heightOverWidth;
  const h = w * ratio;

  // Desplazamientos en el marco del rostro: `down` hacia la barbilla, `out` hacia afuera de la cara.
  let drop = g.dropOverFaceHeight * m.faceHeightPx;
  if (g.align === 'bottom') drop -= h / 2;
  if (g.align === 'top') drop += h / 2;
  const outSign = g.reference === 'earLeft' ? -1 : g.reference === 'earRight' ? 1 : 0;
  const out = outSign * g.outOverFaceWidth * m.faceWidthPx;

  const cx = anchorPoint.x + axes.down.x * drop + axes.right.x * out;
  const cy = anchorPoint.y + axes.down.y * drop + axes.right.y * out;

  return {
    kind,
    x: cx / aspect,
    y: cy,
    width: w / aspect,
    height: h,
    angleDeg: opts.followRoll === false ? 0 : m.rollDeg,
    confidence,
  };
}

/**
 * Una ancla por rostro, en el orden en que llegan. Los rostros que no dan confianza suficiente
 * simplemente no aparecen, así que la lista puede ser más corta que la de rostros.
 */
export function anchorsFor(kind: PropKind, faces: FaceLandmarks[], opts: PropAnchorOptions = {}): PropAnchor[] {
  const out: PropAnchor[] = [];
  for (const face of faces) {
    const anchor = anchorFor(kind, face, opts);
    if (anchor) out.push(anchor);
  }
  return out;
}

/** Todas las anclas de un rostro, por accesorio. Las que no se sostienen no entran. */
export function anchorsForFace(face: FaceLandmarks, opts: PropAnchorOptions = {}): Partial<Record<PropKind, PropAnchor>> {
  const out: Partial<Record<PropKind, PropAnchor>> = {};
  for (const kind of PROP_KINDS) {
    const anchor = anchorFor(kind, face, opts);
    if (anchor) out[kind] = anchor;
  }
  return out;
}

/** Pasa el ancla a píxeles de una imagen concreta. `x`/`y` siguen siendo el centro de la caja. */
export function anchorToPixels(
  anchor: PropAnchor,
  frame: { width: number; height: number },
): { x: number; y: number; w: number; h: number; angleDeg: number } {
  return {
    x: anchor.x * frame.width,
    y: anchor.y * frame.height,
    w: anchor.width * frame.width,
    h: anchor.height * frame.height,
    angleDeg: anchor.angleDeg,
  };
}

/** Ejes del rostro: `down` de la frente a la barbilla, `right` su perpendicular hacia x creciente. */
function faceAxes(m: FaceMeasurements): { down: Vec2; right: Vec2 } {
  const dx = m.chin.x - m.foreheadTop.x;
  const dy = m.chin.y - m.foreheadTop.y;
  const len = Math.hypot(dx, dy);
  const down: Vec2 = len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 1 };
  return { down, right: { x: down.y, y: -down.x } };
}

function referencePoint(
  reference: PropReference,
  face: FaceLandmarks,
  m: FaceMeasurements,
  axes: { down: Vec2; right: Vec2 },
  aspect: number,
): Vec2 {
  switch (reference) {
    case 'crown':
      return m.crown;
    case 'eyes':
      return m.eyeMid;
    case 'philtrum': {
      const lip = face.points[LM.upperLip];
      // Sin labio superior el filtro se estima cayendo desde la nariz; la malla siempre lo trae,
      // pero un consumidor puede recortar puntos y eso no debe reventar el recorrido.
      if (!lip) return { x: m.noseTip.x + axes.down.x * 0.09 * m.faceHeightPx, y: m.noseTip.y + axes.down.y * 0.09 * m.faceHeightPx };
      const lx = lip.x * aspect;
      const ly = lip.y;
      return { x: m.noseTip.x + (lx - m.noseTip.x) * PHILTRUM_MIX, y: m.noseTip.y + (ly - m.noseTip.y) * PHILTRUM_MIX };
    }
    case 'earLeft':
    case 'earRight': {
      const side = reference === 'earLeft' ? m.sideLeft : m.sideRight;
      const drop = EAR_DROP_OVER_FACE_HEIGHT * m.faceHeightPx;
      return { x: side.x + axes.down.x * drop, y: side.y + axes.down.y * drop };
    }
  }
}
