/** Textos de la pantalla: captura. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

/**
 * En el recorrido social la pantalla casi no habla: la tira dice cuánto falta, el color dice el
 * tiempo y los ojos dicen el disparo. Lo que queda aquí es lo que sólo existe para quien no ve la
 * pantalla, más el nombre accesible de la tira.
 */
export const CAPTURA: Record<string, Pair> = {
  'kiosk.capture.strip': ['Tus fotos', 'Your photos'],
  'kiosk.capture.slot_taken': ['Foto {{n}}: lista', 'Photo {{n}}: done'],
  'kiosk.capture.slot_pending': ['Foto {{n}}: falta', 'Photo {{n}}: pending'],
  'kiosk.capture.countdown_live': ['Faltan {{n}}', '{{n}} to go'],
};
