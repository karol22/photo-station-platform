/**
 * Registro de efectos: liga cada clave de `PHOTO_EFFECTS` (contrato de qué efectos existen) con la función
 * que lo aplica y con su **coste aproximado**, para que el kiosco sepa qué puede correr en cada cuadro de
 * la vista previa y qué conviene dejar para el momento de capturar o de editar
 * (`docs/producto/03-en-que-trabajar-ahora.md`: la vista previa tiene que sentirse viva).
 *
 * `documentSafe`, `requires` y `stages` no se declaran aquí: se leen del contrato, que es la autoridad.
 */
import { PHOTO_EFFECTS, PHOTO_EFFECT_INDEX } from '@psp/contracts';
import type { PhotoEffectInfo, PhotoEffectKey, VisionCapability } from '@psp/contracts';
import { blurBackground, colorBackground, cutoutPerson, replaceBackground } from './background';
import { COLOR_FILTERS } from './color-filters';
import type { ColorFilterKey } from './color-filters';
import { applyEditOps } from './edit-ops';
import type { EditOpKey } from './edit-ops';
import type { EdgeOptions, Mask } from './mask';
import { blend } from './ops/composite';
import { resize } from './ops/geometry';
import { anchorProp, drawProp } from './props';
import type { FaceLandmarks, PropPlacement, PropSpec } from './props';
import { smoothSkin } from './retouch';
import { cloneRaster } from './raster';
import type { Raster } from './raster';

/** Momento del recorrido en el que tiene sentido el efecto. Se toma del contrato para no duplicar la lista. */
export type EffectStage = PhotoEffectInfo['stages'][number];

/** Coste aproximado por aplicación, con la misma escala que `VisionCapabilityInfo.cost`. */
export type EffectCost = 'low' | 'medium' | 'high';

/**
 * Entrada uniforme para poder ejecutar cualquier efecto sin saber cuál es. Cada `run` toma lo que necesita
 * y **devuelve la foto intacta** cuando le falta algo (máscara, puntos del rostro o activo): un efecto que
 * no puede aplicarse no rompe el recorrido.
 */
export type EffectInput = {
  raster: Raster;
  /** Recorte de persona del motor de visión, a cualquier resolución. */
  mask?: Mask;
  /** Puntos del rostro normalizados 0..1. */
  landmarks?: FaceLandmarks;
  /** Activo del efecto: escena de fondo, elemento pegado a la cara o marco. */
  asset?: Raster;
  /** Color plano del fondo. */
  color?: string;
  /** Intensidad genérica 0..1: suavizado de piel, opacidad del marco. */
  amount?: number;
  /** Radio del desenfoque de fondo, en píxeles de la foto. */
  radius?: number;
  /** Cómo se ancla el elemento a la cara. Se ignora si viene `placement`. */
  propSpec?: PropSpec;
  /** Colocación ya calculada del elemento, para reutilizarla entre cuadros. */
  placement?: PropPlacement;
  /** Filtro de color con nombre. */
  filter?: ColorFilterKey;
  /** Calidad del borde del recorte. */
  edge?: EdgeOptions;
};

export type EffectImplementation = {
  key: PhotoEffectKey;
  /** Nombre de la función pública que lo implementa; `null` cuando el efecto no es procesamiento de píxel. */
  fn: string | null;
  cost: EffectCost;
  /** `true` cuando aguanta ejecutarse en cada cuadro de la vista previa en un Android de gama media. */
  liveCapable: boolean;
  /** Del contrato: nada que no lo tenga se aplica a una fotografía de documento. */
  documentSafe: boolean;
  requires: VisionCapability[];
  stages: EffectStage[];
  /** Ops del pipeline equivalentes, para pasar por `validateEditOps` y quedar registradas en la sesión. */
  ops: EditOpKey[];
  /** Aplica el efecto, o `null` si no produce píxeles (guía de pose, disparos automáticos). */
  run: ((input: EffectInput) => Raster) | null;
  /** Qué hace y qué cuesta, en una línea. */
  notes: string;
};

type Entry = Pick<EffectImplementation, 'fn' | 'cost' | 'liveCapable' | 'ops' | 'run' | 'notes'>;

const passthrough = (input: EffectInput): Raster => cloneRaster(input.raster);

const ENTRIES: Record<PhotoEffectKey, Entry> = {
  'background.replace': {
    fn: 'replaceBackground',
    cost: 'medium',
    liveCapable: true,
    ops: ['backgroundReplace'],
    notes: 'Escala la escena a `cover` y mezcla con la cobertura afinada. Una pasada por píxel más el escalado.',
    run: (i) => (i.mask && i.asset ? replaceBackground(i.raster, i.mask, i.asset, { edge: i.edge }) : passthrough(i)),
  },
  'background.blur': {
    fn: 'blurBackground',
    cost: 'medium',
    liveCapable: true,
    ops: ['backgroundBlur'],
    notes: 'Desenfoque de caja separable sobre toda la foto y la persona encima. Coste independiente del radio.',
    run: (i) => (i.mask ? blurBackground(i.raster, i.mask, { radius: i.radius ?? 8, edge: i.edge }) : passthrough(i)),
  },
  'background.color': {
    fn: 'colorBackground',
    cost: 'low',
    liveCapable: true,
    ops: ['backgroundColor'],
    notes: 'Mezcla contra un color constante. El único efecto de fondo apto para documentos.',
    run: (i) => (i.mask ? colorBackground(i.raster, i.mask, i.color ?? '#FFFFFF', { edge: i.edge }) : passthrough(i)),
  },
  'background.cutout': {
    fn: 'cutoutPerson',
    cost: 'low',
    liveCapable: false,
    ops: ['cutout'],
    notes: 'Copia el color y pone el alfa a `alfa · cobertura`. Barato; vive en edición porque su salida es un PNG con transparencia.',
    run: (i) => (i.mask ? cutoutPerson(i.raster, i.mask, { edge: i.edge }) : passthrough(i)),
  },
  'face.sticker': {
    fn: 'drawProp',
    cost: 'low',
    liveCapable: true,
    ops: ['sticker'],
    notes: 'Recorre sólo la caja del elemento girado, con mapeo inverso y muestreo bilineal. No depende del tamaño de la foto.',
    run: (i) => {
      const placement = i.placement ?? (i.landmarks && i.propSpec ? anchorProp(i.landmarks, i.propSpec, i.raster) : undefined);
      if (!placement || !i.asset) return passthrough(i);
      return drawProp(i.raster, i.asset, placement, { opacity: i.amount ?? 1 });
    },
  },
  'face.smooth': {
    fn: 'smoothSkin',
    cost: 'medium',
    liveCapable: false,
    ops: ['smoothSkin'],
    notes: 'Promedio separable más mezcla guiada por la diferencia local. Dos pasadas de desenfoque; se aplica al editar, no en vivo.',
    run: (i) => smoothSkin(i.raster, i.mask, i.amount ?? 0.5),
  },
  'filter.color': {
    fn: 'applyEditOps',
    cost: 'low',
    liveCapable: true,
    ops: ['brightness', 'contrast', 'saturation', 'temperature', 'grayscale', 'sharpen', 'vignette', 'duotone'],
    notes: 'Receta de `COLOR_FILTERS`: tablas de 256 entradas y pasadas por píxel, sin leer vecinos salvo `sharpen`.',
    run: (i) => applyEditOps(i.raster, COLOR_FILTERS[i.filter ?? 'vivid']),
  },
  'frame.overlay': {
    fn: 'blend',
    cost: 'low',
    liveCapable: true,
    ops: ['frame'],
    notes: 'Alfa over del marco escalado al tamaño de la foto. Una pasada.',
    run: (i) => {
      if (!i.asset) return passthrough(i);
      const scaled = i.asset.width === i.raster.width && i.asset.height === i.raster.height ? i.asset : resize(i.asset, i.raster.width, i.raster.height);
      return blend(i.raster, scaled, 0, 0, i.amount ?? 1);
    },
  },
  'pose.guide': {
    fn: null,
    cost: 'low',
    liveCapable: true,
    ops: [],
    notes: 'No produce píxeles: es una indicación en pantalla que dibuja el kiosco con los puntos del esqueleto.',
    run: null,
  },
  'capture.smile': {
    fn: null,
    cost: 'low',
    liveCapable: true,
    ops: [],
    notes: 'No produce píxeles: dispara la captura al detectar la expresión.',
    run: null,
  },
  'capture.gesture': {
    fn: null,
    cost: 'low',
    liveCapable: true,
    ops: [],
    notes: 'No produce píxeles: dispara la captura al reconocer el gesto.',
    run: null,
  },
};

/**
 * Implementación de cada efecto del contrato. Es exhaustivo por construcción: si `PHOTO_EFFECTS` gana una
 * clave, TypeScript exige la entrada correspondiente aquí.
 */
export const EFFECT_IMPLEMENTATIONS: Record<PhotoEffectKey, EffectImplementation> = Object.fromEntries(
  PHOTO_EFFECTS.map((info) => {
    const entry = ENTRIES[info.key];
    return [info.key, { key: info.key, ...entry, documentSafe: info.documentSafe, requires: [...info.requires], stages: [...info.stages] }];
  }),
) as Record<PhotoEffectKey, EffectImplementation>;

export const EFFECT_KEYS = PHOTO_EFFECTS.map((e) => e.key);

/** Efectos que aguantan la vista previa en vivo. El resto se aplica al capturar o al editar. */
export function liveEffects(): EffectImplementation[] {
  return EFFECT_KEYS.map((k) => EFFECT_IMPLEMENTATIONS[k]).filter((e) => e.liveCapable && e.run !== null);
}

/** Efectos que se pueden aplicar a una fotografía de documento. Hoy sólo el fondo de color plano. */
export function documentSafeEffects(): EffectImplementation[] {
  return EFFECT_KEYS.map((k) => EFFECT_IMPLEMENTATIONS[k]).filter((e) => e.documentSafe);
}

/**
 * Aplica un efecto por su clave. Devuelve la foto intacta si el efecto no produce píxeles o si le falta lo
 * que necesita. **No decide sobre documentos**: eso lo decide el preset a través de `validateEditOps`.
 */
export function applyEffect(key: PhotoEffectKey, input: EffectInput): Raster {
  const impl = EFFECT_IMPLEMENTATIONS[key];
  if (!impl?.run) return cloneRaster(input.raster);
  return impl.run(input);
}

/** Info del contrato para una clave, por comodidad de quien ya tiene la implementación. */
export function effectInfo(key: PhotoEffectKey) {
  return PHOTO_EFFECT_INDEX[key];
}
