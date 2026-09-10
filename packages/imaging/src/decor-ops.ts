/**
 * Ops de decoración: convierte lo que el motor de visión y la persona deciden en operaciones del
 * pipeline, para que la interfaz no arme objetos a mano y la decisión de producto viva probada aquí.
 *
 * Puro y sin reloj. Las anclas llegan como un **tipo estructural** en coordenadas normalizadas 0..1
 * (el mismo que publica `@psp/vision`), así que este paquete sigue sin importar el motor de visión.
 */
import type { EditOp } from '@psp/contracts';
import { TEXT_MAX_SIZE_PX } from './edit-ops';
import type { RasterSize } from './props';

/** Caja normalizada 0..1 con giro, tal como la devuelve `anchorFor` de `@psp/vision`. */
export type NormalizedAnchor = {
  /** Centro de la caja. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Giro horario en grados. */
  angleDeg: number;
};

/** Redondeo a un decimal: el ángulo no necesita más y así la op es estable al compararla. */
const tenth = (v: number): number => Math.round(v * 10) / 10;

/**
 * Pasa un ancla normalizada a la pegatina que la compone sobre la foto.
 *
 * Sale con `anchor: 'center'` porque el ancla describe un centro, que es también lo que entiende la
 * capa de arrastre: así lo que se ve arrastrando y lo que se compone son el mismo punto.
 */
export function anchorToStickerOp(assetId: string, anchor: NormalizedAnchor, frame: RasterSize): EditOp {
  const w = Math.max(1, Math.round(anchor.width * frame.width));
  const h = Math.max(1, Math.round(anchor.height * frame.height));
  return {
    op: 'sticker',
    params: {
      assetId,
      x: Math.round(anchor.x * frame.width),
      y: Math.round(anchor.y * frame.height),
      w,
      h,
      angle: tenth(anchor.angleDeg),
      anchor: 'center',
    },
  };
}

export interface CaptionLayout {
  /** Centro del bloque de texto, en píxeles de la imagen. */
  x: number;
  y: number;
  sizePx: number;
  outlineWidth: number;
}

export interface CaptionLayoutOptions {
  /** Alto de letra como proporción del alto de la foto. */
  heightRatio?: number;
  /** Altura de la línea de texto, 0 arriba y 1 abajo. */
  baselineRatio?: number;
}

/**
 * Dónde y de qué tamaño va un nombre sobre la foto: abajo, centrado y grande.
 *
 * Abajo porque es la única banda que ninguna composición usa para la cara, y grande porque el nombre
 * se tiene que leer en la pantalla de la cabina a metro y medio y después en un teléfono a un palmo.
 * Un 8.5% del alto son ~100 px en una foto de 1200: se lee en las dos distancias.
 */
export function captionLayout(frame: RasterSize, opts: CaptionLayoutOptions = {}): CaptionLayout {
  const heightRatio = opts.heightRatio !== undefined && opts.heightRatio > 0 ? opts.heightRatio : 0.085;
  const baselineRatio = opts.baselineRatio !== undefined ? opts.baselineRatio : 0.87;
  const sizePx = Math.min(TEXT_MAX_SIZE_PX, Math.max(8, Math.round(frame.height * heightRatio)));
  return {
    x: Math.round(frame.width / 2),
    y: Math.round(frame.height * baselineRatio),
    sizePx,
    // El contorno es lo que salva el texto cuando cae sobre una camisa clara o un fondo revuelto.
    outlineWidth: Math.max(2, Math.round(sizePx * 0.07)),
  };
}

export interface CaptionStyle {
  color: string;
  outlineColor?: string;
  /** Familia pedida al rasterizador; el código nunca elige una. */
  font?: string;
}

/** Arma la op de texto centrada en `layout`. Un texto vacío no produce op. */
export function captionOp(text: string, layout: CaptionLayout, style: CaptionStyle): EditOp | undefined {
  const clean = text.trim();
  if (clean.length === 0) return undefined;
  return {
    op: 'text',
    params: {
      text: clean,
      x: layout.x,
      y: layout.y,
      sizePx: layout.sizePx,
      color: style.color,
      outlineColor: style.outlineColor ?? '#000000',
      outlineWidth: layout.outlineWidth,
      align: 'center',
      anchor: 'center',
      weight: 'bold',
      ...(style.font !== undefined && style.font.length > 0 ? { font: style.font } : {}),
    },
  };
}
