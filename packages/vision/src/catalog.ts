/**
 * Entradas de @psp/vision para el catálogo descubrible (`pnpm catalog`). Lo no registrado no existe.
 */
import type { CatalogEntry } from '@psp/contracts';
import { VISION_CRITERIA } from './criteria';

const PACKAGE = '@psp/vision';

const CRITERION_DESCRIPTIONS: Record<string, string> = {
  'face.detected': 'Hay al menos un rostro en el frame.',
  'face.count': 'Hay exactamente una persona.',
  'face.size': 'El alto coronilla-barbilla respecto al frame está dentro del rango del preset.',
  'face.vertical': 'La línea de ojos permite un recorte válido sin salirse del frame.',
  'face.horizontal': 'El rostro está centrado horizontalmente dentro de la tolerancia del preset.',
  'head.roll': 'La línea de ojos es horizontal (cabeza recta).',
  'head.yaw': 'El rostro mira al frente (sin giro lateral).',
  'head.pitch': 'La barbilla no está levantada ni bajada en exceso.',
  'eyes.open': 'Los dos ojos están abiertos.',
  'gaze.front': 'La mirada apunta a la cámara (iris centrados).',
  'face.obstruction': 'El rostro se ve despejado (confianza del detector).',
  'light.low': 'La iluminación del rostro es suficiente.',
  'light.high': 'La iluminación del rostro no está sobreexpuesta.',
  contrast: 'El frame tiene contraste suficiente.',
  'background.uniform': 'El fondo a los lados del rostro es uniforme.',
  shadows: 'No hay sombras fuertes entre las mitades del rostro.',
  sharpness: 'La zona del rostro está nítida (sin desenfoque ni movimiento).',
  'glasses.glare': 'No hay reflejos saturados en la zona de ojos.',
  expression: 'La expresión cumple la regla de sonrisa del preset.',
  framing: 'El recorte documental cabe dentro del frame.',
};

export const CATALOG: CatalogEntry[] = [
  {
    kind: 'package',
    key: 'vision',
    name: PACKAGE,
    description:
      'Análisis facial local: puertos y adaptadores, métricas de frame, cumplimiento documental, guía de poses y auto-captura.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/README.md',
  },
  ...VISION_CRITERIA.map(
    (c): CatalogEntry => ({
      kind: 'visionCriterion',
      key: c.key,
      name: c.name.es,
      description: `${CRITERION_DESCRIPTIONS[c.key] ?? c.name.es} ${c.blocking ? 'Puede bloquear la captura automática.' : 'Sólo recomienda.'}`,
      package: PACKAGE,
      status: 'stable',
      docs: 'packages/vision/README.md',
    }),
  ),
  {
    kind: 'adapter',
    key: 'vision.mediapipe',
    name: 'MediaPipe Face Landmarker',
    description:
      'Detección de rostro y 478 landmarks con blendshapes y pose de cabeza, en WASM dentro del navegador (GPU con reintento en CPU). Import dinámico desde @psp/vision/mediapipe.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/docs/mediapipe.md',
  },
  {
    kind: 'adapter',
    key: 'vision.mock',
    name: 'Analizador mock',
    description:
      'Rostros sintéticos deterministas y métricas ideales o calculadas; para pruebas, máquinas sin cámara y la cámara sintética del kiosco.',
    package: PACKAGE,
    status: 'mock',
    docs: 'packages/vision/README.md',
  },
];
