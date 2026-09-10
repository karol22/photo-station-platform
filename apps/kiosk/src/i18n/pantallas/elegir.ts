/** Textos de la pantalla: elegir. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

export const ELEGIR: Record<string, Pair> = {
  /* El titular del recorrido canónico (`docs/producto/01-flujo-de-sesion.md`, paso 2). Cabe en una
     línea a 72 px, que es la condición para que sea un titular y no un párrafo. */
  'kiosk.choose.title': ['¿Qué hacemos hoy?', 'What are we doing today?'],
  /* La única acción primaria: acepta lo que ya está elegido. Quien no decide nada sale igual de
     contento que quien decide todo, así que el botón afirma en vez de preguntar. */
  'kiosk.choose.confirm': ['Así está bien', 'This one is good'],
  /* El riel de fichas. Es el nombre accesible del grupo, no un rótulo visible: las fichas se ven. */
  'kiosk.choose.rail': ['Opciones', 'Options'],
  /* La ficha completa del producto, que aquí es opcional y vive en una hoja a pantalla completa. */
  'kiosk.choose.details': ['Qué me llevo', 'What I get'],
  'kiosk.choose.category': ['Tipo', 'Kind'],
};
