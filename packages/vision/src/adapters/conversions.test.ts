/** Conversiones puras de los adaptadores: se prueban en Node, sin cargar MediaPipe ni el navegador. */
import type { Detection, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import { maskBounds, maskCoverage } from '../mask';
import { toFaceBoxes } from './face-detector';
import { landmarksBox, toGestureName, toHands } from './gestures';
import { categoryMaskToPersonMask, confidenceMaskToPersonMask } from './segmenter';

describe('máscaras del segmentador', () => {
  it('acepta índices de clase y bytes 0/255', () => {
    const byIndex = categoryMaskToPersonMask(Uint8Array.from([0, 1, 1, 0]), 2, 2);
    const byByte = categoryMaskToPersonMask(Uint8Array.from([0, 255, 255, 0]), 2, 2);
    expect(Array.from(byIndex.data)).toEqual([0, 255, 255, 0]);
    expect(Array.from(byByte.data)).toEqual(Array.from(byIndex.data));
    expect(maskCoverage(byIndex)).toBe(0.5);
  });

  it('umbraliza la máscara de confianza', () => {
    const mask = confidenceMaskToPersonMask(Float32Array.from([0.1, 0.49, 0.5, 0.99]), 2, 2);
    expect(Array.from(mask.data)).toEqual([0, 0, 255, 255]);
    expect(maskBounds(mask)).toEqual({ x: 0, y: 0.5, w: 1, h: 0.5 });
  });
});

describe('gestos', () => {
  const lm = (x: number, y: number): NormalizedLandmark => ({ x, y, z: 0, visibility: 1 });

  it('traduce los gestos enlatados y descarta el resto', () => {
    expect(toGestureName('Open_Palm')).toBe('open_palm');
    expect(toGestureName('Thumb_Up')).toBe('thumb_up');
    expect(toGestureName('Pointing_Up')).toBe('pointing_up');
    expect(toGestureName('ILoveYou')).toBe('none');
    expect(toGestureName(undefined)).toBe('none');
  });

  it('saca la caja de la mano de sus puntos, recortada al cuadro', () => {
    expect(landmarksBox([lm(0.2, 0.3), lm(0.5, 0.8), lm(-0.1, 0.4)])).toEqual({
      x: 0,
      y: 0.3,
      w: 0.5,
      h: 0.5,
    });
    expect(landmarksBox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('empareja cada gesto con su mano', () => {
    const hands = toHands({
      gestures: [
        [{ categoryName: 'Victory', score: 0.87, index: -1, displayName: '' }],
        [{ categoryName: 'None', score: 0.4, index: -1, displayName: '' }],
      ],
      landmarks: [[lm(0.1, 0.1), lm(0.3, 0.4)], [lm(0.6, 0.2), lm(0.8, 0.5)]],
    });
    expect(hands.map((h) => h.gesture)).toEqual(['victory', 'none']);
    expect(hands[0]?.score).toBeCloseTo(0.87, 6);
    expect(hands[1]?.box.x).toBeCloseTo(0.6, 6);
  });
});

describe('detección de rostros', () => {
  it('normaliza las cajas en píxeles que devuelve MediaPipe', () => {
    const detections = [
      { boundingBox: { originX: 160, originY: 96, width: 160, height: 192 } },
      { boundingBox: undefined },
    ] as unknown as Detection[];
    const boxes = toFaceBoxes(detections, { width: 640, height: 480 });
    expect(boxes).toHaveLength(1); // la detección sin caja se descarta
    expect(boxes[0]?.x).toBeCloseTo(0.25, 6);
    expect(boxes[0]?.y).toBeCloseTo(0.2, 6);
    expect(boxes[0]?.w).toBeCloseTo(0.25, 6);
    expect(boxes[0]?.h).toBeCloseTo(0.4, 6);
  });

  it('recorta al cuadro un rostro que se sale por el borde', () => {
    const detections = [
      { boundingBox: { originX: -40, originY: 0, width: 200, height: 240 } },
    ] as unknown as Detection[];
    const [face] = toFaceBoxes(detections, { width: 640, height: 480 });
    expect(face?.x).toBe(0);
    expect(face?.w).toBeCloseTo(0.25, 6);
  });
});
