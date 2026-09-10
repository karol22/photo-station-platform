/** Textos de la pantalla: edicion. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

/**
 * En el recorrido social la edición tiene una salida y dos decisiones, y ninguna usa jerga de
 * fotografía: ni «filtro de belleza», ni porcentajes, ni nombres de partes de la cara. El retoque
 * se dice en primera persona porque es lo que la persona está mirando: su cara.
 */
export const EDICION: Record<string, Pair> = {
  /** La acción primaria, presente desde el segundo cero. */
  'kiosk.edit.looks_good': ['Así está bien', 'This is good'],
  /** Las dos únicas fichas de retoque. Sin jerga y sin porcentajes. */
  'kiosk.edit.retouch_none': ['Como estoy', 'As I am'],
  'kiosk.edit.retouch_soft': ['Un poquito', 'Just a little'],
  'kiosk.edit.retouch_label': ['Tu piel', 'Your skin'],
  /** Nombre accesible de la tira de estilos: en pantalla hablan las miniaturas, no un rótulo. */
  'kiosk.edit.looks_label': ['Estilos', 'Looks'],
  /** Nombre accesible de la fila de accesorios que se anclan al rostro. */
  'kiosk.edit.props_label': ['Accesorios', 'Props'],
};
