/** Textos de la pantalla: pago. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

export const PAGO: Record<string, Pair> = {
  /* El corte de pantalla al aprobar necesita una palabra, no una etiqueta de estado: se lee desde
     el pasillo y cierra el momento. El estado detallado sigue disponible debajo. */
  'kiosk.payment.done': ['¡Listo!', 'All set!'],
};
