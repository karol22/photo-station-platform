/** Presets documentales con versiones inmutables. `pst_mx_universidad` tiene v1 y v2 (currentVersion 2). */
import { DOCUMENT_SAFE_TOOLS, DocumentPreset, DocumentPresetVersion, type DocumentCategory, type DocumentPresetSpec } from '@psp/contracts';
import { DEMO_IDS } from '../ids';
import { L, audit } from './common';

const ID = DEMO_IDS;
const PS = ID.preset;

/** Copias por defecto de cada preset; los productos documentales copian este valor en `output.copies`. */
export const PRESET_DEFAULT_COPIES: Record<string, number> = {
  [PS.mxUniversity]: 1,
  [PS.mxGraduation]: 1,
  [PS.mxCredential]: 1,
  [PS.mxChild]: 1,
  [PS.usVisa]: 1,
  [PS.mxPassport]: 1,
};

interface SpecOver {
  widthMm: number; heightMm: number; background: DocumentPresetSpec['background']; sheetTemplateId: string;
  smile?: DocumentPresetSpec['smile']; glasses?: DocumentPresetSpec['glasses']; headCover?: DocumentPresetSpec['headCover'];
  expression?: DocumentPresetSpec['expression']; instructions: [string, string]; defaultCopies: number; stabilityMs?: number; eyeLine?: { min: number; max: number };
}

function spec(over: SpecOver): DocumentPresetSpec {
  return {
    physical: { widthMm: over.widthMm, heightMm: over.heightMm, orientation: over.widthMm > over.heightMm ? 'landscape' : 'portrait', dpi: 300 },
    color: 'color',
    background: over.background,
    face: {
      heightRatio: { min: 0.62, max: 0.72 },
      eyeLineFromTop: over.eyeLine ?? { min: 0.4, max: 0.48 },
      centerXTolerance: 0.05,
      crownToChin: { min: 0.6, max: 0.75 },
      topMarginMin: 0.05,
      sideMarginMin: 0.1,
      shouldersVisible: true,
    },
    expression: over.expression ?? 'neutral',
    smile: over.smile ?? 'forbidden',
    glasses: over.glasses ?? 'allowed',
    hairCoveringFace: 'forbidden',
    accessories: 'forbidden',
    headCover: over.headCover ?? 'forbidden',
    attire: L('Ropa oscura o de color; evita blanco sobre fondo blanco.', 'Dark or colored clothing; avoid white on a white background.'),
    retouch: 'none',
    paper: { type: 'photo', finish: 'matte' },
    defaultCopies: over.defaultCopies,
    sheetTemplateId: over.sheetTemplateId,
    customerInstructions: L(over.instructions[0], over.instructions[1]),
    editing: { enabled: true, allowedTools: DOCUMENT_SAFE_TOOLS, allowedPresetIds: [ID.editingPreset.docNeutral] },
    autoCapture: { enabled: true, stabilityMs: over.stabilityMs ?? 1200 },
    thresholds: { maxRollDeg: 5, maxYawDeg: 8, maxPitchDeg: 8, minBrightness: 0.3, maxBrightness: 0.85, minContrast: 0.2, minSharpness: 40, minBackgroundUniformity: 0.7, minEyeOpen: 0.35, maxGlassesGlare: 0.4 },
  };
}

interface PresetSeed { id: string; name: [string, string]; institution?: string; country: string; category: DocumentCategory; versions: Array<{ spec: DocumentPresetSpec; note: string; at: string }>; searchTerms: string[]; tags: string[] }

const disclaimer = L('Las medidas siguen la guía publicada por la institución; la aceptación final depende de cada oficina.', 'Dimensions follow the institution\'s published guide; final acceptance depends on each office.');

const seeds: PresetSeed[] = [
  {
    id: PS.mxUniversity, name: ['Tamaño universitario (MX)', 'University size (MX)'], institution: 'Universidades públicas MX', country: 'MX', category: 'university',
    versions: [
      { spec: spec({ widthMm: 35, heightMm: 45, background: 'white', sheetTemplateId: ID.template.sheet4x6, instructions: ['Fondo blanco, rostro serio, orejas visibles.', 'White background, serious face, ears visible.'], defaultCopies: 6, glasses: 'allowed' }), note: 'Versión inicial.', at: '2026-02-01T12:00:00Z' },
      { spec: spec({ widthMm: 35, heightMm: 45, background: 'white', sheetTemplateId: ID.template.sheet4x6, instructions: ['Fondo blanco, rostro serio, orejas visibles, sin lentes oscuros.', 'White background, serious face, ears visible, no tinted glasses.'], defaultCopies: 6, glasses: 'allowed', stabilityMs: 1500 }), note: 'Estabilidad de auto-captura 1500 ms y aclaración sobre lentes.', at: '2026-09-02T12:00:00Z' },
    ],
    searchTerms: ['universidad', 'credencial', 'infantil', '35x45'], tags: ['mx', 'universidad'],
  },
  { id: PS.mxGraduation, name: ['Graduación 50x70 mm', 'Graduation 50x70 mm'], country: 'MX', category: 'graduation', versions: [{ spec: spec({ widthMm: 50, heightMm: 70, background: 'white', sheetTemplateId: ID.template.sheet5x7, instructions: ['Toga o ropa formal; fondo blanco.', 'Gown or formal attire; white background.'], defaultCopies: 2, smile: 'allowed', expression: 'natural', headCover: 'allowed' }), note: 'Versión inicial.', at: '2026-02-01T12:00:00Z' }], searchTerms: ['graduacion', 'diploma', '50x70'], tags: ['mx', 'graduacion'] },
  { id: PS.mxCredential, name: ['Credencial 25x30 mm', 'Credential 25x30 mm'], country: 'MX', category: 'credential', versions: [{ spec: spec({ widthMm: 25, heightMm: 30, background: 'white', sheetTemplateId: ID.template.sheet4x6Credential, instructions: ['Fondo blanco, rostro centrado.', 'White background, centered face.'], defaultCopies: 8 }), note: 'Versión inicial.', at: '2026-02-01T12:00:00Z' }], searchTerms: ['credencial', 'cedula', '25x30'], tags: ['mx', 'co', 'credencial'] },
  { id: PS.mxChild, name: ['Infantil 35x45 mm fondo neutro', 'Child 35x45 mm neutral background'], country: 'MX', category: 'child', versions: [{ spec: spec({ widthMm: 35, heightMm: 45, background: 'neutral', sheetTemplateId: ID.template.sheet4x6, instructions: ['Fondo neutro; el menor mira a la cámara.', 'Neutral background; the child looks at the camera.'], defaultCopies: 6, smile: 'allowed', expression: 'natural', stabilityMs: 900 }), note: 'Versión inicial.', at: '2026-02-01T12:00:00Z' }], searchTerms: ['infantil', 'escuela', '35x45'], tags: ['mx', 'infantil'] },
  { id: PS.usVisa, name: ['Visa EE. UU. 51x51 mm', 'US visa 51x51 mm'], institution: 'Departamento de Estado de EE. UU.', country: 'US', category: 'foreign_visa', versions: [{ spec: spec({ widthMm: 51, heightMm: 51, background: 'white', sheetTemplateId: ID.template.sheet4x6Visa, instructions: ['Fondo blanco, sin lentes, sin sonreír, cabeza descubierta.', 'White background, no glasses, no smile, head uncovered.'], defaultCopies: 2, smile: 'forbidden', glasses: 'forbidden', eyeLine: { min: 0.44, max: 0.52 } }), note: 'Versión inicial.', at: '2026-02-01T12:00:00Z' }], searchTerms: ['visa', 'usa', '2x2', '51x51'], tags: ['us', 'visa'] },
  { id: PS.mxPassport, name: ['Pasaporte MX 35x45 mm', 'MX passport 35x45 mm'], institution: 'SRE', country: 'MX', category: 'passport', versions: [{ spec: spec({ widthMm: 35, heightMm: 45, background: 'white', sheetTemplateId: ID.template.sheet4x6, instructions: ['Fondo blanco, sin lentes, frente y orejas descubiertas.', 'White background, no glasses, forehead and ears uncovered.'], defaultCopies: 6, glasses: 'forbidden' }), note: 'Versión inicial.', at: '2026-02-01T12:00:00Z' }], searchTerms: ['pasaporte', 'sre', '35x45'], tags: ['mx', 'pasaporte'] },
];

export function buildPresets(): DocumentPreset[] {
  return seeds.map((s) =>
    DocumentPreset.parse({
      id: s.id, name: L(s.name[0], s.name[1]), institution: s.institution, country: s.country, category: s.category,
      validity: { start: '2026-01-01T00:00:00Z' }, currentVersion: s.versions.length, status: 'active', tags: s.tags, searchTerms: s.searchTerms,
      lastReviewedAt: '2026-09-02T12:00:00Z', acceptanceDisclaimer: disclaimer, ...audit(ID.user.owner), createdAt: '2026-02-01T12:00:00Z',
    }),
  );
}

export function buildPresetVersions(): DocumentPresetVersion[] {
  return seeds.flatMap((s) =>
    s.versions.map((v, i) => DocumentPresetVersion.parse({ presetId: s.id, version: i + 1, spec: v.spec, changeNote: v.note, createdAt: v.at, createdBy: ID.user.owner })),
  );
}
