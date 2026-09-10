/**
 * Junta los textos de todas las pantallas. Cada pantalla tiene su archivo: así dos personas que
 * trabajan en pantallas distintas nunca tocan las mismas líneas.
 */
import type { Pair } from '../extra';
import { ATRACCION } from './atraccion';
import { ELEGIR } from './elegir';
import { CONSENTIMIENTO } from './consentimiento';
import { PAGO } from './pago';
import { CAPTURA } from './captura';
import { REVISION } from './revision';
import { SELECCION } from './seleccion';
import { EDICION } from './edicion';
import { COMPOSICION } from './composicion';
import { CIERRE } from './cierre';

export const SCREEN_TABLES: Record<string, Pair> = {
  ...ATRACCION,
  ...ELEGIR,
  ...CONSENTIMIENTO,
  ...PAGO,
  ...CAPTURA,
  ...REVISION,
  ...SELECCION,
  ...EDICION,
  ...COMPOSICION,
  ...CIERRE,
};
