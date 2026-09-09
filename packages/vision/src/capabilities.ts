/**
 * Registro de capacidades de visión: qué adaptador implementa cada una, en qué estado está y qué
 * clase la ejecuta en Android.
 *
 * Existe porque la portabilidad no puede ser una promesa de pasillo: la cabina probablemente corra
 * en un Android de gama media, y una capacidad sin equivalente no entra al recorrido básico
 * (`docs/producto/03-en-que-trabajar-ahora.md`). `capabilityReport()` es la tabla que la consola de
 * administración y el panel técnico muestran tal cual, sin cruzar dos fuentes.
 */
import { VISION_CAPABILITIES } from '@psp/contracts';
import type { VisionCapability, VisionCapabilityInfo } from '@psp/contracts';

/**
 * `ready`: hay adaptador real con su modelo empaquetado.
 * `mock`: todavía no; sólo existe lo que devuelve el mock (o nada, si aún no hay puerto).
 */
export type CapabilityStatus = 'ready' | 'mock';

export interface CapabilityAdapterInfo {
  /** Clase o función de fábrica del adaptador. */
  name: string;
  /** Especificador de importación, siempre dinámico y sólo en el navegador. */
  importPath: string;
  /** Modelo tal como lo sirve el kiosco. */
  model: string;
}

export interface CapabilityAndroidInfo {
  /** `false` = no entra al recorrido básico. */
  supported: boolean;
  /** Clase equivalente del SDK de MediaPipe para Android. */
  className?: string;
}

export interface CapabilityBinding {
  key: VisionCapability;
  /** Nombre en español, del catálogo de contratos. */
  name: string;
  /** Puerto de `@psp/vision` que la expone; `undefined` cuando todavía no hay puerto. */
  port?: string;
  adapter?: CapabilityAdapterInfo;
  /** Implementación determinista para pruebas y máquinas sin cámara. */
  mock?: string;
  status: CapabilityStatus;
  android: CapabilityAndroidInfo;
  /** Copiados del catálogo de contratos para no obligar al consumidor a cruzar dos fuentes. */
  cost: VisionCapabilityInfo['cost'];
  liveCapable: boolean;
  modelMb: number;
  /** Por qué está así, en una línea. */
  notes: string;
}

type Binding = Omit<CapabilityBinding, 'key' | 'name' | 'cost' | 'liveCapable' | 'modelMb' | 'status'>;

const BINDINGS: Record<VisionCapability, Binding> = {
  'face.landmarks': {
    port: 'FaceAnalyzer',
    adapter: {
      name: 'createMediaPipeAnalyzer',
      importPath: '@psp/vision/mediapipe',
      model: '/models/face_landmarker.task',
    },
    mock: 'MockFaceAnalyzer',
    android: {
      supported: true,
      className: 'com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker',
    },
    notes: 'Malla, blendshapes y pose de cabeza; corre en vivo sobre el rostro principal.',
  },
  'face.detection': {
    port: 'FaceDetector',
    adapter: {
      name: 'createMediaPipeFaceDetector',
      importPath: '@psp/vision/face-detector',
      model: '/models/blaze_face_short_range.tflite',
    },
    mock: 'MockFaceDetector',
    android: {
      supported: true,
      className: 'com.google.mediapipe.tasks.vision.facedetector.FaceDetector',
    },
    notes: 'Sólo cajas: contar personas y encuadrar al grupo con el modelo más barato del conjunto.',
  },
  'segmentation.person': {
    port: 'PersonSegmenter',
    adapter: {
      name: 'createMediaPipeSegmenter',
      importPath: '@psp/vision/segmenter',
      model: '/models/selfie_segmenter.tflite',
    },
    mock: 'MockPersonSegmenter',
    android: {
      supported: true,
      className: 'com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter',
    },
    notes: 'La máscara llega más chica que el cuadro; en vivo conviene correrla cada N cuadros con FramePacer.',
  },
  'gesture.hands': {
    port: 'GestureRecognizer',
    adapter: {
      name: 'createMediaPipeGestureRecognizer',
      importPath: '@psp/vision/gestures',
      model: '/models/gesture_recognizer.task',
    },
    mock: 'MockGestureRecognizer',
    android: {
      supported: true,
      className: 'com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizer',
    },
    notes: 'Disparo sin tocar la pantalla; GestureTriggerController exige sostener el gesto.',
  },
  'pose.landmarks': {
    android: {
      supported: true,
      className: 'com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker',
    },
    notes: 'Sin puerto ni adaptador todavía: es la capacidad cara y no se ejecuta en vivo; el modelo tampoco se empaqueta.',
  },
};

/**
 * Tabla de capacidades en el orden del catálogo de contratos. El estado se deriva: hay adaptador
 * con modelo → `ready`; si no, `mock`.
 */
export function capabilityReport(): CapabilityBinding[] {
  return VISION_CAPABILITIES.map((info): CapabilityBinding => {
    const binding = BINDINGS[info.key];
    return {
      key: info.key,
      name: info.name.es,
      ...binding,
      status: binding.adapter ? 'ready' : 'mock',
      android: { ...binding.android, supported: binding.android.supported && info.runtimes.includes('android') },
      cost: info.cost,
      liveCapable: info.liveCapable,
      modelMb: info.modelMb,
    };
  });
}

/** Una capacidad concreta, o `undefined` si la clave no está en el catálogo. */
export function capabilityBinding(key: VisionCapability): CapabilityBinding | undefined {
  return capabilityReport().find((c) => c.key === key);
}
