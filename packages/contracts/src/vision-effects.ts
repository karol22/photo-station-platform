import { z } from 'zod';
import { LocalizedText } from './common';

/**
 * Capacidades de visión que corren **dentro del aparato**, sin conexión.
 *
 * Cada una declara si tiene equivalente en Android, porque la cabina probablemente termine
 * corriendo ahí y una técnica sin equivalente no puede entrar al recorrido básico
 * (`docs/producto/03-en-que-trabajar-ahora.md`).
 */
export const VisionCapability = z.enum([
  /** Malla facial y expresiones: guía documental, elementos pegados a la cara, disparo por sonrisa. */
  'face.landmarks',
  /** Recorte de la persona respecto al fondo: reemplazo, desenfoque y color de fondo. */
  'segmentation.person',
  /** Esqueleto: encuadre de cuerpo completo, juegos de pose, guía de grupo. */
  'pose.landmarks',
  /** Manos y gestos: disparar sin tocar la pantalla. */
  'gesture.hands',
  /** Sólo cajas de rostro: contar personas y encuadrar al grupo, más barato que la malla. */
  'face.detection',
]);
export type VisionCapability = z.infer<typeof VisionCapability>;

/** Dónde puede ejecutarse una capacidad. `android` es la que decide si entra al recorrido básico. */
export const RuntimeTarget = z.enum(['web', 'android']);

export const VisionCapabilityInfo = z.object({
  key: VisionCapability,
  name: LocalizedText,
  /** Para qué sirve, en términos de producto. */
  purpose: LocalizedText,
  runtimes: z.array(RuntimeTarget),
  /** Costo aproximado por cuadro; guía para decidir qué corre en vivo y qué al capturar. */
  cost: z.enum(['low', 'medium', 'high']),
  /** `true` cuando puede correr en cada cuadro de la vista previa sin arruinar la fluidez. */
  liveCapable: z.boolean(),
  /** Tamaño aproximado del modelo empaquetado, en megabytes. */
  modelMb: z.number(),
});
export type VisionCapabilityInfo = z.infer<typeof VisionCapabilityInfo>;

/** Efectos que la persona puede aplicar a su foto. Todos se calculan en el aparato. */
export const PhotoEffectKey = z.enum([
  'background.replace',
  'background.blur',
  'background.color',
  'background.cutout',
  'face.sticker',
  'face.smooth',
  'filter.color',
  'frame.overlay',
  'pose.guide',
  'capture.smile',
  'capture.gesture',
]);
export type PhotoEffectKey = z.infer<typeof PhotoEffectKey>;

export const EffectStage = z.enum(['live', 'capture', 'edit']);

export const PhotoEffectInfo = z.object({
  key: PhotoEffectKey,
  name: LocalizedText,
  description: LocalizedText,
  /** Capacidades de visión que necesita; vacío significa que es puro procesamiento de píxel. */
  requires: z.array(VisionCapability),
  /** En qué momentos del recorrido tiene sentido. */
  stages: z.array(EffectStage),
  /** Sólo para experiencias creativas: nunca se aplica a una fotografía de documento. */
  documentSafe: z.boolean(),
});
export type PhotoEffectInfo = z.infer<typeof PhotoEffectInfo>;

const L = (es: string, en: string) => ({ es, en });

/**
 * Catálogo de capacidades. Todas tienen equivalente en Android: es el criterio para estar aquí.
 * Los tamaños son aproximados y sirven para razonar sobre el presupuesto, no como dato exacto.
 */
export const VISION_CAPABILITIES: VisionCapabilityInfo[] = [
  { key: 'face.landmarks', name: L('Malla facial', 'Face mesh'), purpose: L('Guía documental, elementos pegados a la cara y disparo por expresión.', 'Document guidance, face-anchored elements and expression-triggered capture.'), runtimes: ['web', 'android'], cost: 'medium', liveCapable: true, modelMb: 3.8 },
  { key: 'face.detection', name: L('Detección de rostros', 'Face detection'), purpose: L('Contar personas y encuadrar al grupo con poco cómputo.', 'Count people and frame the group cheaply.'), runtimes: ['web', 'android'], cost: 'low', liveCapable: true, modelMb: 0.25 },
  { key: 'segmentation.person', name: L('Recorte de persona', 'Person segmentation'), purpose: L('Separar a la persona del fondo para reemplazarlo, desenfocarlo o teñirlo.', 'Separate the person from the background to replace, blur or tint it.'), runtimes: ['web', 'android'], cost: 'medium', liveCapable: true, modelMb: 1.5 },
  { key: 'pose.landmarks', name: L('Esqueleto', 'Pose landmarks'), purpose: L('Encuadre de cuerpo completo, guía de pose y juegos de imitación.', 'Full-body framing, pose guidance and matching games.'), runtimes: ['web', 'android'], cost: 'high', liveCapable: false, modelMb: 6 },
  { key: 'gesture.hands', name: L('Gestos de mano', 'Hand gestures'), purpose: L('Disparar sin tocar la pantalla, a un metro de distancia.', 'Trigger the shot without touching the screen, from a metre away.'), runtimes: ['web', 'android'], cost: 'medium', liveCapable: true, modelMb: 8 },
];

export const VISION_CAPABILITY_INDEX: Record<string, VisionCapabilityInfo> = Object.fromEntries(
  VISION_CAPABILITIES.map((c) => [c.key, c]),
);

export const PHOTO_EFFECTS: PhotoEffectInfo[] = [
  { key: 'background.replace', name: L('Cambiar el fondo', 'Replace background'), description: L('Pone otra escena detrás de la persona.', 'Puts another scene behind the person.'), requires: ['segmentation.person'], stages: ['live', 'capture', 'edit'], documentSafe: false },
  { key: 'background.blur', name: L('Desenfocar el fondo', 'Blur background'), description: L('Deja a la persona nítida y difumina lo de atrás.', 'Keeps the person sharp and softens what is behind.'), requires: ['segmentation.person'], stages: ['live', 'capture', 'edit'], documentSafe: false },
  { key: 'background.color', name: L('Fondo de color', 'Solid background'), description: L('Sustituye el fondo por un color plano.', 'Replaces the background with a flat colour.'), requires: ['segmentation.person'], stages: ['capture', 'edit'], documentSafe: true },
  { key: 'background.cutout', name: L('Recorte', 'Cutout'), description: L('Deja sólo a la persona, sin fondo.', 'Keeps only the person, with no background.'), requires: ['segmentation.person'], stages: ['edit'], documentSafe: false },
  { key: 'face.sticker', name: L('Elementos que siguen la cara', 'Face-anchored props'), description: L('Lentes, sombreros y adornos que se mueven con el rostro.', 'Glasses, hats and props that move with the face.'), requires: ['face.landmarks'], stages: ['live', 'capture', 'edit'], documentSafe: false },
  { key: 'face.smooth', name: L('Suavizado', 'Skin smoothing'), description: L('Suaviza la piel sin alterar los rasgos.', 'Softens skin without altering features.'), requires: ['face.landmarks'], stages: ['edit'], documentSafe: false },
  { key: 'filter.color', name: L('Filtros de color', 'Colour filters'), description: L('Ajustes y virados de color sobre toda la imagen.', 'Colour adjustments and tints over the whole image.'), requires: [], stages: ['live', 'edit'], documentSafe: false },
  { key: 'frame.overlay', name: L('Marcos', 'Frames'), description: L('Marcos y adornos sobre la imagen.', 'Frames and decorations over the image.'), requires: [], stages: ['edit'], documentSafe: false },
  { key: 'pose.guide', name: L('Guía de pose', 'Pose guidance'), description: L('Indica cómo colocarse para que todos quepan.', 'Shows how to stand so everyone fits.'), requires: ['pose.landmarks'], stages: ['live'], documentSafe: false },
  { key: 'capture.smile', name: L('Disparo por sonrisa', 'Smile to shoot'), description: L('Toma la foto cuando la persona sonríe.', 'Takes the photo when the person smiles.'), requires: ['face.landmarks'], stages: ['live'], documentSafe: false },
  { key: 'capture.gesture', name: L('Disparo por gesto', 'Gesture to shoot'), description: L('Toma la foto al reconocer un gesto de la mano.', 'Takes the photo when it recognises a hand gesture.'), requires: ['gesture.hands'], stages: ['live'], documentSafe: false },
];

export const PHOTO_EFFECT_INDEX: Record<string, PhotoEffectInfo> = Object.fromEntries(
  PHOTO_EFFECTS.map((e) => [e.key, e]),
);
