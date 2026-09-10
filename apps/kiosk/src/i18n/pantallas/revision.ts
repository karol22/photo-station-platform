/** Textos de la pantalla: revision. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

/**
 * La revisión del recorrido social es una sola decisión: descartar. Por eso ninguna cadena habla
 * de «seleccionar», de «orden» ni de «comparar»: se dice qué te llevas y qué pasa si tocas.
 *
 * El recorrido documental conserva sus textos de criterios, que viven en el catálogo común.
 */
export const REVISION: Record<string, Pair> = {
  /** Lo que la persona se lleva, dicho como resultado y no como cantidad seleccionada. */
  'kiosk.review.take_n': ['Te llevas {{n}}', 'You take {{n}}'],
  /** La única instrucción de la pantalla, en una línea. */
  'kiosk.review.tap_to_drop': ['toca las que no quieras', 'tap the ones you don’t want'],
  /** Cuando quedan menos de las que caben: el hueco vacío ya se ve, esto sólo dice cómo llenarlo. */
  'kiosk.review.tap_to_keep': ['toca una apagada para recuperarla', 'tap a dimmed one to bring it back'],
  /** La acción primaria. Sin jerga y sin prometer un paso más. */
  'kiosk.review.looks_good': ['Así está bien', 'This is good'],
  /** Estado de cada toma, sólo para lectores de pantalla: en la pantalla se ve encendida o apagada. */
  'kiosk.review.kept': ['Te la llevas', 'You are taking this one'],
  'kiosk.review.dropped': ['Descartada', 'Dropped'],
  /** El hueco que todavía no tiene foto. */
  'kiosk.review.empty_slot': ['Hueco libre', 'Empty slot'],
  /** Nombre accesible de la tira de resultado y de la fila de tomas. */
  'kiosk.review.result_label': ['Lo que te llevas', 'What you take'],
  'kiosk.review.shots_label': ['Tus tomas', 'Your shots'],
};
