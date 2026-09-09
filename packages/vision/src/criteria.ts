/**
 * Catálogo de criterios documentales (requisito 5.3) y orden de prioridad de las instrucciones.
 */
import type { InstructionKey, PixelRect, VisionCriterion, VisionCriterionKey } from './types';

export const VISION_CRITERIA: VisionCriterion[] = [
  { key: 'face.detected', blocking: true, name: { es: 'Rostro detectado', en: 'Face detected' } },
  { key: 'face.count', blocking: true, name: { es: 'Una sola persona', en: 'Only one person' } },
  { key: 'face.size', blocking: true, name: { es: 'Tamaño del rostro', en: 'Face size' } },
  { key: 'face.vertical', blocking: true, name: { es: 'Posición vertical', en: 'Vertical position' } },
  { key: 'face.horizontal', blocking: true, name: { es: 'Posición horizontal', en: 'Horizontal position' } },
  { key: 'head.roll', blocking: true, name: { es: 'Cabeza recta', en: 'Head level' } },
  { key: 'head.yaw', blocking: true, name: { es: 'Rostro al frente', en: 'Face forward' } },
  { key: 'head.pitch', blocking: true, name: { es: 'Barbilla nivelada', en: 'Chin level' } },
  { key: 'eyes.open', blocking: true, name: { es: 'Ojos abiertos', en: 'Eyes open' } },
  { key: 'gaze.front', blocking: false, name: { es: 'Mirada al frente', en: 'Gaze forward' } },
  { key: 'face.obstruction', blocking: false, name: { es: 'Rostro despejado', en: 'Face unobstructed' } },
  { key: 'light.low', blocking: true, name: { es: 'Iluminación suficiente', en: 'Enough light' } },
  { key: 'light.high', blocking: true, name: { es: 'Sin sobreexposición', en: 'No overexposure' } },
  { key: 'contrast', blocking: false, name: { es: 'Contraste', en: 'Contrast' } },
  { key: 'background.uniform', blocking: true, name: { es: 'Fondo uniforme', en: 'Plain background' } },
  { key: 'shadows', blocking: false, name: { es: 'Sin sombras fuertes', en: 'No harsh shadows' } },
  { key: 'sharpness', blocking: true, name: { es: 'Nitidez', en: 'Sharpness' } },
  { key: 'glasses.glare', blocking: false, name: { es: 'Sin reflejos en lentes', en: 'No glasses glare' } },
  { key: 'expression', blocking: true, name: { es: 'Expresión', en: 'Expression' } },
  { key: 'framing', blocking: true, name: { es: 'Encuadre', en: 'Framing' } },
];

export const VISION_CRITERION_KEYS: VisionCriterionKey[] = VISION_CRITERIA.map((c) => c.key);

/** Orden de importancia para elegir la instrucción principal: rostro → tamaño → encuadre → pose → ojos → expresión → luz → nitidez. */
export const INSTRUCTION_PRIORITY: VisionCriterionKey[] = [
  'face.detected',
  'face.count',
  'face.size',
  'framing',
  'face.vertical',
  'face.horizontal',
  'head.roll',
  'head.yaw',
  'head.pitch',
  'eyes.open',
  'gaze.front',
  'expression',
  'face.obstruction',
  'light.low',
  'light.high',
  'contrast',
  'background.uniform',
  'shadows',
  'glasses.glare',
  'sharpness',
];

export const INSTRUCTION_KEYS: InstructionKey[] = [
  'move_left',
  'move_right',
  'move_closer',
  'move_back',
  'chin_up',
  'chin_down',
  'look_front',
  'head_straight',
  'open_eyes',
  'no_smile',
  'remove_glasses',
  'fix_hair',
  'wait_focus',
  'only_one_person',
  'no_face',
  'more_light',
  'less_light',
  'plain_background',
  'hold_still',
  'ok',
];

/** Convierte una instrucción de coordenadas de imagen a una vista previa en espejo (intercambia izquierda/derecha). */
export function mirrorInstruction(key: InstructionKey): InstructionKey {
  if (key === 'move_left') return 'move_right';
  if (key === 'move_right') return 'move_left';
  return key;
}

/** Refleja un rectángulo en px para dibujarlo sobre una vista previa en espejo. */
export function mirrorRect(rect: PixelRect, frameWidth: number): PixelRect {
  return { x: frameWidth - rect.x - rect.w, y: rect.y, w: rect.w, h: rect.h };
}
