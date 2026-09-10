/**
 * Toma de fotografía: extrae el frame a resolución completa, recorta (documental) al `crop` del
 * análisis escalado, ajusta a la relación del preset y devuelve PNG + resumen de análisis.
 */
import type { CaptureAnalysisSummary, DocumentPresetSpec } from '@psp/contracts';
import { crop as cropRaster, resize } from '@psp/imaging';
import { canvasToRaster, rasterToDataUrl } from '@psp/imaging/browser';
import { documentAspect, type ComplianceResult, type FrameAnalysis, type PixelRect } from '@psp/vision';
import type { CameraSource } from '../camera/source';

export interface CapturedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_DOCUMENT_HEIGHT_PX = 1400;
const MAX_PHOTO_WIDTH_PX = 1600;

/** Escala un rectángulo del frame de análisis al frame de captura completo y lo mantiene dentro. */
export function scaleRect(rect: PixelRect, from: { width: number; height: number }, to: { width: number; height: number }): PixelRect {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const x = Math.max(0, Math.round(rect.x * sx));
  const y = Math.max(0, Math.round(rect.y * sy));
  const w = Math.min(to.width - x, Math.round(rect.w * sx));
  const h = Math.min(to.height - y, Math.round(rect.h * sy));
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

/** Tamaño de salida del documento: relación del preset, alto acotado. */
export function documentOutputSize(spec: DocumentPresetSpec): { width: number; height: number } {
  const aspect = documentAspect(spec);
  const pxHeight = Math.round((spec.physical.heightMm / 25.4) * spec.physical.dpi);
  const height = Math.min(MAX_DOCUMENT_HEIGHT_PX, Math.max(300, pxHeight));
  return { width: Math.max(1, Math.round(height * aspect)), height };
}

export function captureDocument(source: CameraSource, cropInAnalysis: PixelRect | undefined, analysisSize: { width: number; height: number }, spec: DocumentPresetSpec): CapturedImage {
  const full = canvasToRaster(source.element, { width: source.width, height: source.height });
  const rect = cropInAnalysis ? scaleRect(cropInAnalysis, analysisSize, full) : centeredRect(full, documentAspect(spec));
  const cropped = cropRaster(full, rect);
  const out = documentOutputSize(spec);
  const resized = resize(cropped, out.width, out.height);
  return { dataUrl: rasterToDataUrl(resized, 'image/png'), width: resized.width, height: resized.height };
}

export function capturePhoto(source: CameraSource): CapturedImage {
  const full = canvasToRaster(source.element, { width: source.width, height: source.height });
  const scale = full.width > MAX_PHOTO_WIDTH_PX ? MAX_PHOTO_WIDTH_PX / full.width : 1;
  const raster = scale < 1 ? resize(full, Math.round(full.width * scale), Math.round(full.height * scale)) : full;
  return { dataUrl: rasterToDataUrl(raster, 'image/png'), width: raster.width, height: raster.height };
}

function centeredRect(frame: { width: number; height: number }, aspect: number): PixelRect {
  const h = frame.height;
  const w = Math.min(frame.width, Math.round(h * aspect));
  return { x: Math.round((frame.width - w) / 2), y: 0, w, h: Math.round(w / aspect) };
}

export function summarize(analysis: FrameAnalysis | undefined, compliance: ComplianceResult | undefined): CaptureAnalysisSummary {
  const criteria = compliance?.criteria ?? [];
  return {
    faces: analysis?.faces.length ?? 0,
    passed: criteria.filter((c) => c.status === 'ok').map((c) => c.key),
    warnings: criteria.filter((c) => c.status === 'warn').map((c) => c.key),
    blocked: criteria.filter((c) => c.status === 'block').map((c) => c.key),
    ...(analysis ? { sharpness: analysis.metrics.sharpness, brightness: analysis.metrics.brightness } : {}),
  };
}
