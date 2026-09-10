/**
 * Modelo geométrico del rostro: índices de la malla de MediaPipe, modelo 3D simplificado (fuente de
 * verdad del rostro sintético y de los estimadores) y mediciones puras sobre landmarks.
 *
 * Izquierda/derecha se refieren siempre al lado de la IMAGEN analizada (x menor = izquierda), no al
 * lado del sujeto. En una imagen sin espejo, el ojo "izquierdo" (33/133/159/145) es el ojo derecho
 * del sujeto.
 */
import type { FaceLandmarks, LandmarkPoint } from './types';
import { clamp, clamp01, degrees } from './util';

/** Índices de la malla de MediaPipe Face Landmarker (478 puntos; 468..477 son los iris). */
export const LM = {
  chin: 152,
  /** Punto más alto de la malla (frente/nacimiento del cabello). La coronilla real está por encima. */
  foreheadTop: 10,
  noseTip: 1,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeUpper: 159,
  leftEyeLower: 145,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeUpper: 386,
  rightEyeLower: 374,
  leftIris: 468,
  rightIris: 473,
  leftSide: 234,
  rightSide: 454,
  upperLip: 13,
  lowerLip: 14,
  leftMouthCorner: 61,
  rightMouthCorner: 291,
} as const;

export const FACE_MESH_POINTS = 478;
export const FACE_MESH_POINTS_WITHOUT_IRIS = 468;

/**
 * Modelo 3D simplificado en unidades de alto de rostro (coronilla-barbilla = 1).
 * Origen en el centro de la línea de ojos; x hacia la derecha de la imagen, y hacia abajo,
 * z hacia la cámara; la punta de la nariz está en z = 0 y el resto del rostro detrás.
 * Proporciones clásicas: ojos a la mitad de la altura de la cabeza, ancho del rostro ≈ 0.68 del alto.
 */
export const FACE_MODEL = {
  /** La coronilla real está esta fracción del alto del rostro por encima del punto 10 (aprox. 0.10–0.12). */
  crownExtension: 0.11,
  foreheadTopY: -0.39,
  foreheadDepth: -0.12,
  chinY: 0.5,
  chinDepth: -0.1,
  /** Distancia del centro de cada ojo al eje vertical (distancia interpupilar ≈ 0.28). */
  eyeOffsetX: 0.14,
  /** Medio ancho del ojo (comisura externa a interna ≈ 0.13). */
  eyeHalfWidth: 0.065,
  eyeDepth: -0.13,
  /** Apertura vertical / ancho del ojo con los ojos normalmente abiertos. */
  eyeOpenRatio: 0.35,
  /** Desplazamiento máximo del iris como fracción del ancho del ojo. */
  irisMaxOffset: 0.3,
  noseTipY: 0.22,
  /** Puntos 234/454: medio ancho del rostro y su profundidad respecto a la punta de la nariz. */
  sideHalfWidth: 0.34,
  sideY: 0.05,
  sideDepth: -0.34,
  mouthY: 0.36,
  mouthDepth: -0.08,
  /** Ancho de boca / ancho de rostro (234–454) sin sonrisa y con sonrisa plena. */
  mouthWidthNeutral: 0.34,
  mouthWidthSmile: 0.44,
  /** Elevación de las comisuras respecto al centro de la boca con sonrisa plena (fracción del alto). */
  smileCornerLift: 0.03,
  lipGapClosed: 0.005,
} as const;

export interface Vec2 {
  x: number;
  y: number;
}

/** Mediciones del rostro en píxeles del frame, más magnitudes derivadas. */
export interface FaceMeasurements {
  crown: Vec2;
  foreheadTop: Vec2;
  chin: Vec2;
  noseTip: Vec2;
  eyeLeft: Vec2;
  eyeRight: Vec2;
  eyeMid: Vec2;
  sideLeft: Vec2;
  sideRight: Vec2;
  /** |coronilla − barbilla| en px (invariante al roll). */
  faceHeightPx: number;
  /** |454 − 234| en px. */
  faceWidthPx: number;
  /** Centro horizontal del eje coronilla-barbilla, 0..1 del ancho del frame. */
  centerX: number;
  /** Línea de ojos, 0..1 del alto del frame. */
  eyeLineY: number;
  /** Alto del rostro como proporción del alto del frame. */
  heightRatio: number;
  /** Ángulo de la línea de ojos en la imagen (> 0: ojo derecho de la imagen más abajo). */
  rollDeg: number;
  /** `headPose.yawDeg` si existe; si no, estimación por asimetría nariz/lados. */
  yawDeg: number;
  /** `headPose.pitchDeg` si existe; si no, estimación por proporciones ojos-nariz-barbilla. */
  pitchDeg: number;
  /** Apertura de ojos 0..1 (mínimo entre ojos; combina blendshapes y geometría). */
  eyeOpenness: number;
  /** Sonrisa 0..1 (blendshapes si existen; si no, geometría de la boca). */
  smile: number;
  /** Desplazamiento medio del iris respecto al centro del ojo / ancho del ojo (signo: + derecha). */
  gazeOffset?: number;
  hasIris: boolean;
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const len = (a: Vec2): number => Math.hypot(a.x, a.y);
const mean = (pts: Vec2[]): Vec2 => {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
};

function requirePoint(points: LandmarkPoint[], index: number, frame: { width: number; height: number }): Vec2 {
  const p = points[index];
  if (!p) {
    throw new Error(
      `FaceLandmarks: falta el punto ${index}; se requiere la malla de MediaPipe (${FACE_MESH_POINTS_WITHOUT_IRIS} puntos o más)`,
    );
  }
  return { x: p.x * frame.width, y: p.y * frame.height };
}

/**
 * Estimación de yaw por asimetría: con los lados a profundidad `sideDepth` detrás de la nariz,
 * (dl − dr)/(dl + dr) = (|sideDepth| / sideHalfWidth) · tan(yaw).
 */
export function estimateYawDeg(dl: number, dr: number): number {
  const sum = dl + dr;
  if (sum <= 0) return 0;
  const k = FACE_MODEL.sideHalfWidth / -FACE_MODEL.sideDepth;
  return degrees(Math.atan(clamp(((dl - dr) / sum) * k, -10, 10)));
}

/**
 * Estimación de pitch por proporciones: ρ = (barbilla − nariz)/(nariz − ojos) proyectado sobre el
 * eje del rostro. Con la nariz en z = 0, ojos a `eyeDepth` y barbilla a `chinDepth`:
 * tan(pitch) = (ρ·b − a) / (D + ρ·D'), con a = chinY − noseTipY, b = noseTipY, D = −chinDepth, D' = −eyeDepth.
 */
export function estimatePitchDeg(eyesToNose: number, noseToChin: number): number {
  const a = FACE_MODEL.chinY - FACE_MODEL.noseTipY;
  const b = FACE_MODEL.noseTipY;
  const D = -FACE_MODEL.chinDepth;
  const Dp = -FACE_MODEL.eyeDepth;
  const rho = noseToChin / Math.max(eyesToNose, 1e-6);
  return degrees(Math.atan(clamp((rho * b - a) / (D + rho * Dp), -10, 10)));
}

/** Mide un rostro en píxeles del frame. Lanza si faltan puntos obligatorios de la malla. */
export function measureFace(
  face: FaceLandmarks,
  frame: { width: number; height: number },
): FaceMeasurements {
  const P = face.points;
  const pt = (i: number) => requirePoint(P, i, frame);

  const chin = pt(LM.chin);
  const foreheadTop = pt(LM.foreheadTop);
  const noseTip = pt(LM.noseTip);
  const sideLeft = pt(LM.leftSide);
  const sideRight = pt(LM.rightSide);

  // Coronilla: extrapolación del segmento barbilla→punto 10 (invariante al roll).
  const scale = 1 / (1 - FACE_MODEL.crownExtension);
  const crown = { x: chin.x + (foreheadTop.x - chin.x) * scale, y: chin.y + (foreheadTop.y - chin.y) * scale };
  const faceHeightPx = len(sub(crown, chin));

  // Ejes del rostro: `down` de la frente a la barbilla; `right` perpendicular hacia la derecha de la imagen.
  const axis = sub(chin, foreheadTop);
  const axisLen = len(axis);
  const down: Vec2 = axisLen > 0 ? { x: axis.x / axisLen, y: axis.y / axisLen } : { x: 0, y: 1 };
  const right: Vec2 = { x: down.y, y: -down.x };

  const leftEyePts = [LM.leftEyeOuter, LM.leftEyeInner, LM.leftEyeUpper, LM.leftEyeLower].map(pt);
  const rightEyePts = [LM.rightEyeOuter, LM.rightEyeInner, LM.rightEyeUpper, LM.rightEyeLower].map(pt);
  const eyeLeft = mean(leftEyePts);
  const eyeRight = mean(rightEyePts);
  const eyeMid = mean([eyeLeft, eyeRight]);
  const eyeLine = sub(eyeRight, eyeLeft);
  const rollDeg = degrees(Math.atan2(eyeLine.y, eyeLine.x));

  const yawDeg =
    face.headPose?.yawDeg ??
    estimateYawDeg(dot(sub(noseTip, sideLeft), right), dot(sub(sideRight, noseTip), right));
  const pitchDeg =
    face.headPose?.pitchDeg ??
    estimatePitchDeg(dot(sub(noseTip, eyeMid), down), dot(sub(chin, noseTip), down));

  // Apertura de ojos: geometría (apertura / ancho normalizada) y blendshapes si existen; gana el mínimo.
  const openness = (outer: Vec2, inner: Vec2, upper: Vec2, lower: Vec2) => {
    const width = len(sub(outer, inner));
    if (width <= 0) return 0;
    return clamp01(len(sub(upper, lower)) / width / FACE_MODEL.eyeOpenRatio);
  };
  const [lo, li, lu, ll] = leftEyePts as [Vec2, Vec2, Vec2, Vec2];
  const [ro, ri, ru, rl] = rightEyePts as [Vec2, Vec2, Vec2, Vec2];
  let eyeOpenness = Math.min(openness(lo, li, lu, ll), openness(ro, ri, ru, rl));
  const blinkL = face.blendshapes?.['eyeBlinkLeft'];
  const blinkR = face.blendshapes?.['eyeBlinkRight'];
  if (blinkL !== undefined || blinkR !== undefined) {
    eyeOpenness = Math.min(eyeOpenness, 1 - clamp01(Math.max(blinkL ?? 0, blinkR ?? 0)));
  }

  // Sonrisa: blendshapes si existen; si no, ancho relativo de la boca y elevación de comisuras.
  const faceWidthPx = len(sub(sideRight, sideLeft));
  const smileL = face.blendshapes?.['mouthSmileLeft'];
  const smileR = face.blendshapes?.['mouthSmileRight'];
  let smile: number;
  if (smileL !== undefined || smileR !== undefined) {
    smile = clamp01(Math.max(smileL ?? 0, smileR ?? 0));
  } else {
    const cornerL = pt(LM.leftMouthCorner);
    const cornerR = pt(LM.rightMouthCorner);
    const mouthCenter = mean([pt(LM.upperLip), pt(LM.lowerLip)]);
    const widthRatio = faceWidthPx > 0 ? len(sub(cornerR, cornerL)) / faceWidthPx : 0;
    const widthScore = clamp01(
      (widthRatio - FACE_MODEL.mouthWidthNeutral) /
        (FACE_MODEL.mouthWidthSmile - FACE_MODEL.mouthWidthNeutral),
    );
    const lift = faceHeightPx > 0 ? dot(sub(mouthCenter, mean([cornerL, cornerR])), down) / faceHeightPx : 0;
    const liftScore = clamp01(lift / FACE_MODEL.smileCornerLift);
    smile = Math.max(widthScore, liftScore);
  }

  // Mirada: desplazamiento del iris a lo largo del eje del ojo, relativo al ancho del ojo.
  const irisL = P[LM.leftIris];
  const irisR = P[LM.rightIris];
  const hasIris = irisL !== undefined && irisR !== undefined;
  let gazeOffset: number | undefined;
  if (hasIris) {
    const offset = (iris: Vec2, center: Vec2, outer: Vec2, inner: Vec2) => {
      const width = len(sub(outer, inner));
      return width > 0 ? dot(sub(iris, center), right) / width : 0;
    };
    gazeOffset =
      (offset(pt(LM.leftIris), eyeLeft, lo, li) + offset(pt(LM.rightIris), eyeRight, ro, ri)) / 2;
  }

  const measurements: FaceMeasurements = {
    crown,
    foreheadTop,
    chin,
    noseTip,
    eyeLeft,
    eyeRight,
    eyeMid,
    sideLeft,
    sideRight,
    faceHeightPx,
    faceWidthPx,
    centerX: (crown.x + chin.x) / 2 / frame.width,
    eyeLineY: eyeMid.y / frame.height,
    heightRatio: faceHeightPx / frame.height,
    rollDeg,
    yawDeg,
    pitchDeg,
    eyeOpenness,
    smile,
    hasIris,
  };
  if (gazeOffset !== undefined) measurements.gazeOffset = gazeOffset;
  return measurements;
}

/** Rostro de mayor área de caja (empates: el primero). */
export function largestFace(faces: FaceLandmarks[]): FaceLandmarks | undefined {
  let best: FaceLandmarks | undefined;
  let bestArea = -1;
  for (const f of faces) {
    const area = f.box.w * f.box.h;
    if (area > bestArea) {
      best = f;
      bestArea = area;
    }
  }
  return best;
}
