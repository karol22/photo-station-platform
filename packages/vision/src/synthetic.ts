/**
 * Rostro sintético determinista: fuente de verdad de las pruebas y de la cámara sintética del kiosco.
 * Genera los 478 puntos de la malla de MediaPipe a partir del modelo 3D de `FACE_MODEL`, rotado por
 * yaw/pitch/roll y proyectado ortográficamente. Los índices usados por los evaluadores quedan en su
 * posición anatómica; el resto se reparte de forma determinista dentro del óvalo del rostro.
 */
import { FACE_MESH_POINTS, FACE_MODEL as M, LM } from './face-model';
import type { FaceLandmarks, LandmarkPoint, SyntheticFaceOptions } from './types';
import { clamp01, definedOnly, radians } from './util';

/** Rostro centrado ideal para el spec de referencia (35×45 mm, ojos 0.40–0.48, alto 0.62–0.72) en 4:3. */
export const DEFAULT_SYNTHETIC_FACE: SyntheticFaceOptions = {
  cx: 0.5,
  cy: 0.44,
  height: 0.64,
  rollDeg: 0,
  yawDeg: 0,
  pitchDeg: 0,
  eyesOpen: 1,
  smile: 0,
  gaze: 0,
  aspect: 4 / 3,
  score: 1,
};

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Rotación yaw (eje y) → pitch (eje x) → roll (eje z). Convenciones en `HeadPose`. */
function rotate(p: Vec3, yawDeg: number, pitchDeg: number, rollDeg: number): Vec3 {
  const ya = radians(yawDeg);
  const pa = radians(pitchDeg);
  const ra = radians(rollDeg);
  // yaw: x' = x cos + z sin ; z' = −x sin + z cos  (yaw > 0 → la nariz se desplaza a la derecha)
  let x = p.x * Math.cos(ya) + p.z * Math.sin(ya);
  let y = p.y;
  let z = -p.x * Math.sin(ya) + p.z * Math.cos(ya);
  // pitch: y' = y cos − z sin ; z' = y sin + z cos  (pitch > 0 → barbilla arriba: la nariz sube respecto al plano)
  const y2 = y * Math.cos(pa) - z * Math.sin(pa);
  const z2 = y * Math.sin(pa) + z * Math.cos(pa);
  y = y2;
  z = z2;
  // roll: x'' = x cos − y sin ; y'' = x sin + y cos  (roll > 0 → el lado derecho baja)
  const x3 = x * Math.cos(ra) - y * Math.sin(ra);
  const y3 = x * Math.sin(ra) + y * Math.cos(ra);
  x = x3;
  y = y3;
  return { x, y, z };
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const EYE_INDICES = [
  LM.leftEyeOuter,
  LM.leftEyeInner,
  LM.leftEyeUpper,
  LM.leftEyeLower,
  LM.rightEyeOuter,
  LM.rightEyeInner,
  LM.rightEyeUpper,
  LM.rightEyeLower,
];

export function syntheticFace(opts: Partial<SyntheticFaceOptions> = {}): FaceLandmarks {
  const o: SyntheticFaceOptions = { ...DEFAULT_SYNTHETIC_FACE, ...definedOnly(opts) };
  const eyesOpen = clamp01(o.eyesOpen);
  const smile = clamp01(o.smile);
  const aspect = o.aspect > 0 ? o.aspect : 1;

  const eyeWidth = 2 * M.eyeHalfWidth;
  const lid = (eyesOpen * M.eyeOpenRatio * eyeWidth) / 2;
  const irisShift = o.gaze * M.irisMaxOffset * eyeWidth;
  const faceWidth = 2 * M.sideHalfWidth;
  const halfMouth = ((M.mouthWidthNeutral + (M.mouthWidthSmile - M.mouthWidthNeutral) * smile) * faceWidth) / 2;
  const lift = M.smileCornerLift * smile;

  const anchors: Array<[number, number, number, number]> = [
    [LM.foreheadTop, 0, M.foreheadTopY, M.foreheadDepth],
    [LM.chin, 0, M.chinY, M.chinDepth],
    [LM.noseTip, 0, M.noseTipY, 0],
    [LM.leftSide, -M.sideHalfWidth, M.sideY, M.sideDepth],
    [LM.rightSide, M.sideHalfWidth, M.sideY, M.sideDepth],
    [LM.leftEyeOuter, -(M.eyeOffsetX + M.eyeHalfWidth), 0, M.eyeDepth],
    [LM.leftEyeInner, -(M.eyeOffsetX - M.eyeHalfWidth), 0, M.eyeDepth],
    [LM.leftEyeUpper, -M.eyeOffsetX, -lid, M.eyeDepth],
    [LM.leftEyeLower, -M.eyeOffsetX, lid, M.eyeDepth],
    [LM.rightEyeOuter, M.eyeOffsetX + M.eyeHalfWidth, 0, M.eyeDepth],
    [LM.rightEyeInner, M.eyeOffsetX - M.eyeHalfWidth, 0, M.eyeDepth],
    [LM.rightEyeUpper, M.eyeOffsetX, -lid, M.eyeDepth],
    [LM.rightEyeLower, M.eyeOffsetX, lid, M.eyeDepth],
    [LM.leftIris, -M.eyeOffsetX + irisShift, 0, M.eyeDepth + 0.01],
    [LM.rightIris, M.eyeOffsetX + irisShift, 0, M.eyeDepth + 0.01],
    [LM.upperLip, 0, M.mouthY - M.lipGapClosed / 2, M.mouthDepth],
    [LM.lowerLip, 0, M.mouthY + M.lipGapClosed / 2, M.mouthDepth],
    [LM.leftMouthCorner, -halfMouth, M.mouthY - lift, M.mouthDepth - 0.02],
    [LM.rightMouthCorner, halfMouth, M.mouthY - lift, M.mouthDepth - 0.02],
  ];

  // Modelo completo: anclas en su lugar; relleno determinista dentro del óvalo (sin superar sus extremos).
  const model: Vec3[] = new Array<Vec3>(FACE_MESH_POINTS);
  const anchored = new Set<number>();
  for (const [i, x, y, z] of anchors) {
    model[i] = { x, y, z };
    anchored.add(i);
  }
  for (let i = 0; i < FACE_MESH_POINTS; i++) {
    if (anchored.has(i)) continue;
    const r = Math.sqrt(((i * 37) % FACE_MESH_POINTS) / FACE_MESH_POINTS);
    const a = i * GOLDEN_ANGLE;
    model[i] = { x: 0.32 * r * Math.cos(a), y: 0.055 + 0.43 * r * Math.sin(a), z: -0.15 };
  }

  const rotated = model.map((p) => rotate(p, o.yawDeg, o.pitchDeg, o.rollDeg));

  // Ancla: el centro de la línea de ojos (media de los 8 puntos de ojos) cae exactamente en (cx, cy).
  let ex = 0;
  let ey = 0;
  let ez = 0;
  for (const i of EYE_INDICES) {
    const p = rotated[i] as Vec3;
    ex += p.x;
    ey += p.y;
    ez += p.z;
  }
  ex /= EYE_INDICES.length;
  ey /= EYE_INDICES.length;
  ez /= EYE_INDICES.length;

  const h = o.height;
  const points: LandmarkPoint[] = rotated.map((p) => ({
    x: o.cx + ((p.x - ex) * h) / aspect,
    y: o.cy + (p.y - ey) * h,
    z: (p.z - ez) * h,
  }));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const bx = clamp01(minX);
  const by = clamp01(minY);
  const box = { x: bx, y: by, w: Math.max(0, clamp01(maxX) - bx), h: Math.max(0, clamp01(maxY) - by) };

  return {
    points,
    box,
    blendshapes: {
      eyeBlinkLeft: 1 - eyesOpen,
      eyeBlinkRight: 1 - eyesOpen,
      mouthSmileLeft: smile,
      mouthSmileRight: smile,
      jawOpen: 0,
    },
    headPose: { yawDeg: o.yawDeg, pitchDeg: o.pitchDeg, rollDeg: o.rollDeg },
    score: clamp01(o.score),
  };
}
