/**
 * Spec documental de referencia (35×45 mm, estilo pasaporte) para pruebas, evaluaciones y la cámara
 * sintética. El dataset canónico vive en @psp/fixtures; este spec sólo fija una geometría realista.
 */
import type { DocumentPresetSpec } from '@psp/contracts';
import { definedOnly } from './util';

export const SAMPLE_DOCUMENT_SPEC: DocumentPresetSpec = {
  physical: { widthMm: 35, heightMm: 45, orientation: 'portrait', dpi: 300 },
  color: 'color',
  background: 'white',
  face: {
    heightRatio: { min: 0.62, max: 0.72 },
    eyeLineFromTop: { min: 0.4, max: 0.48 },
    centerXTolerance: 0.05,
    topMarginMin: 0.05,
    sideMarginMin: 0.05,
    shouldersVisible: true,
  },
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
  customerInstructions: {
    es: 'Mira al frente con expresión neutra y la boca cerrada.',
    en: 'Look straight ahead with a neutral expression and your mouth closed.',
  },
  editing: {
    enabled: true,
    allowedTools: ['crop', 'levelRotation', 'exposure', 'brightness', 'contrast'],
    allowedPresetIds: [],
  },
  autoCapture: { enabled: true, stabilityMs: 1200 },
  thresholds: {
    maxRollDeg: 5,
    maxYawDeg: 8,
    maxPitchDeg: 8,
    minBrightness: 0.3,
    maxBrightness: 0.85,
    minContrast: 0.2,
    minSharpness: 40,
    minBackgroundUniformity: 0.7,
    minEyeOpen: 0.35,
    maxGlassesGlare: 0.4,
  },
};

type Spec = DocumentPresetSpec;

/** Sobrescrituras parciales: los grupos anidados se fusionan campo a campo. */
export type DocumentSpecOverrides = Partial<
  Omit<Spec, 'physical' | 'face' | 'thresholds' | 'autoCapture' | 'paper' | 'editing'>
> & {
  physical?: Partial<Spec['physical']>;
  face?: Partial<Spec['face']>;
  thresholds?: Partial<Spec['thresholds']>;
  autoCapture?: Partial<Spec['autoCapture']>;
  paper?: Partial<Spec['paper']>;
  editing?: Partial<Spec['editing']>;
};

export function sampleDocumentSpec(overrides: DocumentSpecOverrides = {}): DocumentPresetSpec {
  const base = SAMPLE_DOCUMENT_SPEC;
  const { physical, face, thresholds, autoCapture, paper, editing, ...rest } = overrides;
  return {
    ...base,
    ...definedOnly(rest),
    physical: { ...base.physical, ...definedOnly(physical ?? {}) },
    face: { ...base.face, ...definedOnly(face ?? {}) },
    thresholds: { ...base.thresholds, ...definedOnly(thresholds ?? {}) },
    autoCapture: { ...base.autoCapture, ...definedOnly(autoCapture ?? {}) },
    paper: { ...base.paper, ...definedOnly(paper ?? {}) },
    editing: { ...base.editing, ...definedOnly(editing ?? {}) },
  };
}
