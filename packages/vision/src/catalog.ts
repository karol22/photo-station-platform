/**
 * Entradas de @psp/vision para el catálogo descubrible (`pnpm catalog`). Lo no registrado no existe.
 */
import type { CatalogEntry } from '@psp/contracts';
import { capabilityReport } from './capabilities';
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
      'Visión en el dispositivo: puertos y adaptadores para rostro, recorte de persona, gestos de mano y detección de rostros; métricas de frame, cumplimiento documental, encuadre de grupo, auto-captura y disparo por gesto.',
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
    name: 'Mocks deterministas',
    description:
      'MockFaceAnalyzer, MockPersonSegmenter, MockGestureRecognizer y MockFaceDetector: rostros sintéticos, silueta ovalada, guion de gestos y cajas inyectables, sin aleatoriedad ni reloj propio; para pruebas, máquinas sin cámara y la cámara sintética del kiosco.',
    package: PACKAGE,
    status: 'mock',
    docs: 'packages/vision/README.md',
  },
  {
    kind: 'adapter',
    key: 'vision.segmenter',
    name: 'MediaPipe Image Segmenter',
    description:
      'Recorte de persona con selfie_segmenter.tflite en modo VIDEO (GPU con reintento en CPU). La máscara llega a la resolución del modelo, no a la del cuadro. Import dinámico desde @psp/vision/segmenter.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/docs/mediapipe.md',
  },
  {
    kind: 'adapter',
    key: 'vision.gestures',
    name: 'MediaPipe Gesture Recognizer',
    description:
      'Gestos de mano con gesture_recognizer.task en modo VIDEO (GPU con reintento en CPU). Import dinámico desde @psp/vision/gestures.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/docs/mediapipe.md',
  },
  {
    kind: 'adapter',
    key: 'vision.faceDetector',
    name: 'MediaPipe Face Detector',
    description:
      'Cajas de rostro con blaze_face_short_range.tflite en modo VIDEO (GPU con reintento en CPU). Import dinámico desde @psp/vision/face-detector.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/docs/mediapipe.md',
  },
  {
    kind: 'port',
    key: 'vision.port.FaceAnalyzer',
    name: 'Puerto FaceAnalyzer',
    description: 'analyze(frame, atMs) → rostros con malla, blendshapes y pose de cabeza, más métricas del cuadro.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/README.md',
  },
  {
    kind: 'port',
    key: 'vision.port.PersonSegmenter',
    name: 'Puerto PersonSegmenter',
    description: 'segment(frame, atMs) → máscara de persona de un byte por píxel (255 persona, 0 fondo), posiblemente más chica que el cuadro.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/README.md',
  },
  {
    kind: 'port',
    key: 'vision.port.GestureRecognizer',
    name: 'Puerto GestureRecognizer',
    description: 'recognize(frame, atMs) → manos con gesto, confianza y caja; GestureTriggerController las convierte en disparo.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/README.md',
  },
  {
    kind: 'port',
    key: 'vision.port.FaceDetector',
    name: 'Puerto FaceDetector',
    description: 'detect(frame, atMs) → cajas de rostro normalizadas; groupFraming las convierte en encuadre y consejo.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/vision/README.md',
  },
  ...capabilityReport().map(
    (c): CatalogEntry => ({
      kind: 'capability',
      key: `vision.${c.key}`,
      name: c.name,
      description: `${c.notes} Puerto: ${c.port ?? 'ninguno'}; adaptador: ${c.adapter?.name ?? 'ninguno'}; Android: ${c.android.className ?? 'sin equivalente'}.`,
      package: PACKAGE,
      status: c.status === 'ready' ? 'stable' : 'planned',
      docs: 'packages/vision/docs/mediapipe.md',
    }),
  ),
];
