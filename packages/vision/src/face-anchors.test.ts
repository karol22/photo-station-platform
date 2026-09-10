/**
 * Anclas de accesorios sobre mallas faciales sintéticas: deterministas, sin red y sin modelo.
 * Los números salen del modelo geométrico de `FACE_MODEL`, así que se pueden comprobar a mano.
 */
import { describe, expect, it } from 'vitest';
import { capabilityBinding } from './capabilities';
import { LM } from './face-model';
import { syntheticFace } from './synthetic';
import {
  PROP_GEOMETRY,
  PROP_KINDS,
  anchorFor,
  anchorToPixels,
  anchorsFor,
  anchorsForFace,
  propConfidence,
} from './face-anchors';

/** Rostro de referencia en cuadro cuadrado: coronilla en 0.12, ojos en 0.44, barbilla en 0.76. */
const square = (overrides = {}) => syntheticFace({ aspect: 1, ...overrides });
const FACE_WIDTH = 0.68 * 0.64;

describe('anchorFor', () => {
  it('pone los lentes sobre la línea de los ojos, de sien a sien', () => {
    const a = anchorFor('glasses', square())!;
    expect(a.x).toBeCloseTo(0.5, 6);
    expect(a.y).toBeCloseTo(0.44 + 0.015 * 0.64, 6);
    expect(a.width).toBeCloseTo(FACE_WIDTH, 6);
    expect(a.height).toBeCloseTo(FACE_WIDTH * 0.38, 6);
    expect(a.angleDeg).toBeCloseTo(0, 6);
    expect(a.confidence).toBeCloseTo(1, 6);
  });

  it('apoya el ala del sombrero justo por debajo de la coronilla y lo deja por encima de la cabeza', () => {
    const a = anchorFor('hat', square())!;
    const bottom = a.y + a.height / 2;
    // El ala muerde la cabeza: cae entre la coronilla (0.12) y el punto más alto de la malla (0.19).
    expect(bottom).toBeCloseTo(0.12 + 0.06 * 0.64, 6);
    expect(bottom).toBeGreaterThan(0.12);
    expect(bottom).toBeLessThan(0.1904);
    // Y el cuerpo del sombrero queda entero por encima de los ojos.
    expect(a.y + a.height / 2).toBeLessThan(0.44);
    expect(a.width).toBeCloseTo(1.32 * FACE_WIDTH, 6);
  });

  it('pone el bigote entre la nariz y el labio superior, más ancho que la boca y más angosto que la cara', () => {
    const face = square();
    const noseY = face.points[LM.noseTip]!.y;
    const lipY = face.points[LM.upperLip]!.y;
    const mouthWidth = Math.abs(face.points[LM.rightMouthCorner]!.x - face.points[LM.leftMouthCorner]!.x);
    const a = anchorFor('moustache', face)!;
    expect(a.y).toBeGreaterThan(noseY);
    expect(a.y).toBeLessThan(lipY);
    expect(a.width).toBeGreaterThan(mouthWidth);
    expect(a.width).toBeLessThan(FACE_WIDTH);
  });

  it('cuelga cada arete del contorno lateral, por fuera de la cara y por debajo de los ojos', () => {
    const left = anchorFor('earringLeft', square())!;
    const right = anchorFor('earringRight', square())!;
    const sideLeftX = 0.5 - 0.34 * 0.64;
    const sideRightX = 0.5 + 0.34 * 0.64;
    // Fuera del contorno, cada uno del lado que le toca.
    expect(left.x).toBeLessThan(sideLeftX);
    expect(right.x).toBeGreaterThan(sideRightX);
    // El punto de sujeción (borde superior) cae a la altura de la nariz, no del ojo.
    expect(left.y - left.height / 2).toBeCloseTo(0.472 + 0.14 * 0.64, 6);
    expect(left.y - left.height / 2).toBeGreaterThan(0.44);
    // Simétricos respecto al eje del rostro.
    expect(left.y).toBeCloseTo(right.y, 6);
    expect(0.5 - left.x).toBeCloseTo(right.x - 0.5, 6);
  });

  it('gira cada accesorio con la inclinación de la cabeza', () => {
    const face = square({ rollDeg: 20 });
    for (const kind of PROP_KINDS) {
      const a = anchorFor(kind, face, { minConfidence: 0 })!;
      expect(a.angleDeg).toBeCloseTo(20, 4);
    }
    // El sombrero no sólo gira: se desplaza al lado hacia el que cae la cabeza.
    const tilted = anchorFor('hat', face)!;
    const upright = anchorFor('hat', square())!;
    expect(tilted.x).not.toBeCloseTo(upright.x, 2);
    // Y la distancia entre los ojos y el sombrero se conserva: gira, no se estira.
    const level = anchorFor('glasses', square())!;
    const turned = anchorFor('glasses', face)!;
    expect(Math.hypot(tilted.x - turned.x, tilted.y - turned.y)).toBeCloseTo(
      Math.hypot(upright.x - level.x, upright.y - level.y),
      4,
    );
  });

  it('deja el accesorio a nivel con followRoll en false, sin mover el centro', () => {
    const face = square({ rollDeg: 20 });
    const follows = anchorFor('earringLeft', face)!;
    const level = anchorFor('earringLeft', face, { followRoll: false })!;
    expect(level.angleDeg).toBe(0);
    expect(level.x).toBeCloseTo(follows.x, 6);
    expect(level.y).toBeCloseTo(follows.y, 6);
  });

  it('escala con el rostro: una cara al doble de alto da un accesorio al doble de ancho', () => {
    const small = anchorFor('hat', square({ height: 0.3 }))!;
    const big = anchorFor('hat', square({ height: 0.6 }))!;
    expect(big.width / small.width).toBeCloseTo(2, 5);
    expect(big.height / small.height).toBeCloseTo(2, 5);
  });

  it('respeta la relación del cuadro: el mismo rostro en 4:3 cae en los mismos píxeles', () => {
    const aspect = 4 / 3;
    const wide = anchorFor('glasses', syntheticFace({ aspect }), { frameAspect: aspect })!;
    const px = anchorToPixels(wide, { width: 800, height: 600 });
    const flat = anchorFor('glasses', square())!;
    // El ancho normalizado encoge porque el cuadro es más ancho, pero el ancho en píxeles no.
    expect(wide.width).toBeCloseTo(flat.width / aspect, 6);
    expect(px.w).toBeCloseTo(flat.width * 600, 4);
    expect(px.x).toBeCloseTo(400, 4);
    expect(wide.angleDeg).toBeCloseTo(0, 6);
  });

  it('usa la proporción del activo real cuando se le da', () => {
    const a = anchorFor('hat', square(), { assetAspect: 0.5 })!;
    expect(a.height).toBeCloseTo(a.width * 0.5, 6);
    const wider = anchorFor('hat', square(), { scale: 1.5 })!;
    expect(wider.width).toBeCloseTo(anchorFor('hat', square())!.width * 1.5, 6);
  });

  it('esconde el arete de la oreja que el giro tapa y conserva el de la otra', () => {
    // yaw > 0: la nariz se va a la derecha de la imagen y la oreja derecha se pierde.
    const turnedRight = square({ yawDeg: 25 });
    expect(anchorFor('earringRight', turnedRight)).toBeUndefined();
    expect(anchorFor('earringLeft', turnedRight)).toBeDefined();
    const turnedLeft = square({ yawDeg: -25 });
    expect(anchorFor('earringLeft', turnedLeft)).toBeUndefined();
    expect(anchorFor('earringRight', turnedLeft)).toBeDefined();
    // Los lentes aguantan ese giro; son simétricos y viven en la cara.
    expect(anchorFor('glasses', turnedRight)).toBeDefined();
  });

  it('degrada la confianza con el giro y con la del propio rostro', () => {
    expect(propConfidence('glasses', 1, 0)).toBeCloseTo(1, 6);
    expect(propConfidence('glasses', 1, 30)).toBeCloseTo(1, 6);
    expect(propConfidence('glasses', 1, 42.5)).toBeCloseTo(0.5, 6);
    expect(propConfidence('glasses', 1, 60)).toBeCloseTo(0, 6);
    expect(propConfidence('glasses', 0.5, 0)).toBeCloseTo(0.5, 6);
    // La oreja que se acerca a la cámara no pierde nada.
    expect(propConfidence('earringLeft', 1, 30)).toBeCloseTo(1, 6);
    expect(propConfidence('earringRight', 1, 14)).toBeCloseTo(0.5, 6);
    expect(propConfidence('earringRight', 1, 20)).toBeCloseTo(0, 6);
  });

  it('no coloca nada sobre una malla incompleta ni sobre un rostro sin confianza', () => {
    const face = square();
    expect(anchorFor('glasses', { ...face, points: face.points.slice(0, 100) })).toBeUndefined();
    expect(anchorFor('glasses', { ...face, score: 0.1 })).toBeUndefined();
    expect(anchorFor('glasses', { ...face, score: 0.1 }, { minConfidence: 0 })).toBeDefined();
  });

  it('es determinista', () => {
    const face = square({ rollDeg: 7, yawDeg: 11, pitchDeg: -4 });
    expect(anchorsForFace(face)).toEqual(anchorsForFace(face));
  });
});

describe('anchorsFor', () => {
  it('da un ancla por cara y cada una cae sobre su cara', () => {
    const left = square({ cx: 0.3, height: 0.3 });
    const right = square({ cx: 0.7, height: 0.3 });
    const anchors = anchorsFor('glasses', [left, right]);
    expect(anchors).toHaveLength(2);
    expect(anchors[0]!.x).toBeCloseTo(0.3, 6);
    expect(anchors[1]!.x).toBeCloseTo(0.7, 6);
  });

  it('omite las caras que no dan confianza en lugar de colocarlas mal', () => {
    const ok = square();
    const turned = square({ cx: 0.8, yawDeg: 25 });
    expect(anchorsFor('earringRight', [ok, turned])).toHaveLength(1);
  });

  it('anchorsForFace devuelve las cinco piezas de un rostro frontal', () => {
    expect(Object.keys(anchorsForFace(square())).sort()).toEqual([...PROP_KINDS].sort());
  });
});

describe('paridad Android', () => {
  it('las anclas no piden más que la malla facial, que ya corre en Android', () => {
    const binding = capabilityBinding('face.landmarks');
    expect(binding?.android.supported).toBe(true);
    expect(binding?.android.className).toContain('FaceLandmarker');
    // Ninguna geometría pide un punto que la malla no publique.
    for (const kind of PROP_KINDS) expect(PROP_GEOMETRY[kind].widthOverFaceWidth).toBeGreaterThan(0);
  });
});
