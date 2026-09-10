/** Textos de la pantalla: seleccion. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

/**
 * La selección del recorrido social ya no es una pantalla propia: elegir y revisar eran la misma
 * decisión partida en dos, y se fundieron en la revisión (`revision.ts`). Esta tabla queda vacía a
 * propósito, para que la ruta siga existiendo sin arrastrar textos de una pantalla que no está.
 */
export const SELECCION: Record<string, Pair> = {};
