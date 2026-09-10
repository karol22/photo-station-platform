/** Datos compartidos por las pruebas: frame 4:3, spec 35×45 mm con umbrales por defecto y rostro sintético. */
import { DocumentPresetSpec } from '@psp/contracts';
import { IDEAL_FRAME_METRICS } from '../metrics';
import { syntheticFace } from '../synthetic';
import type { FaceLandmarks, FrameAnalysis, FrameMetrics, SyntheticFaceOptions } from '../types';

export const FRAME = { width: 640, height: 480 };

/** Spec realista 35×45 mm con los umbrales por defecto del contrato (`thresholds: {}`). */
export const SPEC = DocumentPresetSpec.parse({
  physical: { widthMm: 35, heightMm: 45, orientation: 'portrait' },
  color: 'color',
  background: 'white',
  face: { heightRatio: { min: 0.62, max: 0.72 }, eyeLineFromTop: { min: 0.4, max: 0.48 }, centerXTolerance: 0.05, topMarginMin: 0.05, sideMarginMin: 0.05, shouldersVisible: true },
  expression: 'neutral',
  smile: 'forbidden',
  glasses: 'allowed',
  hairCoveringFace: 'forbidden',
  accessories: 'forbidden',
  headCover: 'forbidden',
  retouch: 'none',
  paper: { type: 'photo', finish: 'glossy' },
  defaultCopies: 4,
  sheetTemplateId: 'tpl_sheet_document_4up',
  customerInstructions: { es: 'Mira al frente.' },
  editing: { enabled: true, allowedTools: ['crop'] },
  autoCapture: { enabled: true },
  thresholds: {},
});

export const face = (opts: Partial<SyntheticFaceOptions> = {}): FaceLandmarks => syntheticFace({ aspect: FRAME.width / FRAME.height, ...opts });

export function analysis(faces: FaceLandmarks[], metrics: FrameMetrics = IDEAL_FRAME_METRICS, atMs = 0): FrameAnalysis {
  return { ...FRAME, faces, metrics: { ...metrics }, atMs };
}
