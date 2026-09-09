/**
 * Filtros de color con nombre. Cada uno es una **combinación determinista de operaciones que ya existen**:
 * no hay código nuevo por filtro, sólo una receta de `EditOp[]` que pasa por `validateEditOps` y
 * `applyEditOps` como cualquier otra edición. Así el mismo filtro se puede guardar en una sesión, repetir
 * al capturar y auditar sin ambigüedad.
 *
 * Ninguno es seguro para documentos: todos usan herramientas creativas (`saturation`, `sharpen`,
 * `vignette`, `filterIntensity`) que quedan fuera de `DOCUMENT_SAFE_TOOLS`.
 */
import type { EditOp } from '@psp/contracts';

export type ColorFilterKey = 'vivid' | 'warm' | 'cool' | 'bw_contrast' | 'faded' | 'duotone';

const op = (name: string, params: Record<string, string | number> = {}): EditOp => ({ op: name, params });

/**
 * Recetas. El orden importa: primero geometría de tono (exposición/contraste), después color, y al final
 * nitidez o viñeta, que se calculan sobre el resultado ya virado.
 */
export const COLOR_FILTERS: Record<ColorFilterKey, EditOp[]> = {
  /** Más vida sin quemar: satura, abre el contraste y define. */
  vivid: [op('saturation', { amount: 0.35 }), op('contrast', { amount: 0.12 }), op('sharpen', { amount: 0.25 })],
  /** Luz de tarde: cálido, un punto más claro y algo más de color. */
  warm: [op('temperature', { amount: 0.3 }), op('brightness', { amount: 0.04 }), op('saturation', { amount: 0.1 })],
  /** Sombra azulada, limpio y con más cuerpo. */
  cool: [op('temperature', { amount: -0.3 }), op('contrast', { amount: 0.08 }), op('saturation', { amount: 0.05 })],
  /** Blanco y negro de estudio: luma 709, contraste duro y viñeta que cierra el encuadre. */
  bw_contrast: [op('grayscale'), op('contrast', { amount: 0.25 }), op('vignette', { strength: 0.25 })],
  /** Descolorido de cámara vieja: menos contraste, menos color y negros levantados. */
  faded: [op('contrast', { amount: -0.18 }), op('saturation', { amount: -0.25 }), op('brightness', { amount: 0.08 })],
  /** Dos tonos: sombras azul noche, luces ámbar. */
  duotone: [op('duotone', { shadow: '#22304A', highlight: '#F2C27B', amount: 0.85 })],
};

export const COLOR_FILTER_KEYS = Object.keys(COLOR_FILTERS) as ColorFilterKey[];

export function isColorFilterKey(key: string): key is ColorFilterKey {
  return Object.prototype.hasOwnProperty.call(COLOR_FILTERS, key);
}

/** Copia profunda de la receta, para que quien la aplique no pueda mutar el catálogo. */
export function colorFilterOps(key: ColorFilterKey): EditOp[] {
  return COLOR_FILTERS[key].map((o) => ({ op: o.op, params: { ...o.params } }));
}
