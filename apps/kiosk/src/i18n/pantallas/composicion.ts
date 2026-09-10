/** Textos de la pantalla: composicion. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

export const COMPOSICION: Record<string, Pair> = {
  /* El rótulo del recorrido social no habla de impresión: la persona vino por su foto, no por una
     hoja. El recorrido documental conserva `kiosk.compose.title`, donde el formato sí es el trámite. */
  'kiosk.compose.result': ['Así te queda', 'Here it is'],
  /* La única acción de la banda de alcance, en las dos pantallas de composición. */
  'kiosk.compose.ok': ['Así está bien', 'That looks right'],
  /* Sustituye al giro del cargador mientras se dibuja la vista previa: la familia trabajando. */
  'kiosk.compose.working': ['Armando tu foto', 'Putting your photo together'],
};
