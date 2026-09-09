/**
 * Recorte documental.
 *
 * - `computeDocumentCrop`: recorte IDEAL con la relación de aspecto de `spec.physical`, centrado en el
 *   eje del rostro, con alto tal que (coronilla-barbilla)/alto = punto medio de `heightRatio` y la línea
 *   de ojos en el punto medio de `eyeLineFromTop`. Puede salirse del frame.
 * - `fitDocumentCrop`: busca un recorte que respete los RANGOS del spec (alto del rostro, línea de ojos,
 *   tolerancia horizontal, márgenes mínimos) y quepa en el frame, lo más cercano posible al ideal.
 *   Si no existe, informa qué eje falla; `framing` y `face.vertical`/`face.horizontal` se apoyan en ello.
 */
import type { DocumentPresetSpec } from '@psp/contracts';
import { measureFace, type FaceMeasurements } from './face-model';
import type { FaceLandmarks, PixelRect } from './types';
import { clamp, midpoint } from './util';

export interface CropFit {
  /** Recorte a usar: el ajustado si `fits`, si no el ideal. */
  crop: PixelRect;
  ideal: PixelRect;
  fits: boolean;
  /** Existe un alto de recorte válido (rostro no demasiado grande para el frame). */
  sizeFits: boolean;
  /** El eje vertical/horizontal admite un recorte válido con el alto más permisivo. */
  verticalFits: boolean;
  horizontalFits: boolean;
  /** Desborde del recorte ideal respecto al frame, en px (0 si no desborda). */
  overflow: { left: number; right: number; top: number; bottom: number };
}

const EPS = 0.5;
const FIT_STEPS = 8;

/** Relación ancho/alto del documento; respeta `orientation` aunque las medidas vengan invertidas. */
export function documentAspect(spec: DocumentPresetSpec): number {
  const { widthMm, heightMm, orientation } = spec.physical;
  const long = Math.max(widthMm, heightMm);
  const short = Math.min(widthMm, heightMm);
  return orientation === 'landscape' ? long / short : short / long;
}

export function computeDocumentCropFromMeasurements(
  m: FaceMeasurements,
  spec: DocumentPresetSpec,
  frame: { width: number; height: number },
): PixelRect {
  const aspect = documentAspect(spec);
  const h = m.faceHeightPx / midpoint(spec.face.heightRatio);
  const w = h * aspect;
  return {
    x: m.centerX * frame.width - w / 2,
    y: m.eyeMid.y - midpoint(spec.face.eyeLineFromTop) * h,
    w,
    h,
  };
}

export function computeDocumentCrop(
  face: FaceLandmarks,
  spec: DocumentPresetSpec,
  frame: { width: number; height: number },
): PixelRect {
  return computeDocumentCropFromMeasurements(measureFace(face, frame), spec, frame);
}

export function fitDocumentCropFromMeasurements(
  m: FaceMeasurements,
  spec: DocumentPresetSpec,
  frame: { width: number; height: number },
): CropFit {
  const aspect = documentAspect(spec);
  const W = frame.width;
  const H = frame.height;
  const ideal = computeDocumentCropFromMeasurements(m, spec, frame);
  const overflow = {
    left: Math.max(0, -ideal.x),
    right: Math.max(0, ideal.x + ideal.w - W),
    top: Math.max(0, -ideal.y),
    bottom: Math.max(0, ideal.y + ideal.h - H),
  };
  const { heightRatio: hr, eyeLineFromTop: er, centerXTolerance: tol, topMarginMin, sideMarginMin } = spec.face;
  const faceH = m.faceHeightPx;
  const hLo = faceH / hr.max;
  const hHi = Math.min(faceH / hr.min, H, W / aspect);
  const sizeFits = hLo <= hHi + EPS;
  const base = { ideal, overflow, sizeFits };
  if (!sizeFits || faceH <= 0) {
    return { ...base, crop: ideal, fits: false, verticalFits: false, horizontalFits: false };
  }

  const preferred = clamp(faceH / midpoint(hr), hLo, hHi);
  const cxPx = m.centerX * W;
  const eyeY = m.eyeMid.y;
  let verticalAtLo = false;
  let horizontalAtLo = false;
  for (let s = 0; s <= FIT_STEPS; s++) {
    const ch = preferred + ((hLo - preferred) * s) / FIT_STEPS;
    const cw = ch * aspect;
    const yLo = Math.max(0, eyeY - er.max * ch);
    const yHi = Math.min(H - ch, eyeY - er.min * ch, m.crown.y - topMarginMin * ch);
    const xLo = Math.max(0, cxPx - cw / 2 - tol * cw, m.sideRight.x + sideMarginMin * cw - cw);
    const xHi = Math.min(W - cw, cxPx - cw / 2 + tol * cw, m.sideLeft.x - sideMarginMin * cw);
    const vertical = yLo <= yHi + EPS;
    const horizontal = xLo <= xHi + EPS;
    if (s === FIT_STEPS) {
      verticalAtLo = vertical;
      horizontalAtLo = horizontal;
    }
    if (vertical && horizontal) {
      const y = clamp(eyeY - midpoint(er) * ch, yLo, Math.max(yLo, yHi));
      const x = clamp(cxPx - cw / 2, xLo, Math.max(xLo, xHi));
      return { ...base, crop: { x, y, w: cw, h: ch }, fits: true, verticalFits: true, horizontalFits: true };
    }
  }
  return { ...base, crop: ideal, fits: false, verticalFits: verticalAtLo, horizontalFits: horizontalAtLo };
}

export function fitDocumentCrop(
  face: FaceLandmarks,
  spec: DocumentPresetSpec,
  frame: { width: number; height: number },
): CropFit {
  return fitDocumentCropFromMeasurements(measureFace(face, frame), spec, frame);
}
