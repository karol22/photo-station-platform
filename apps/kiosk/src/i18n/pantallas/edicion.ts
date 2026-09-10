/** Textos de la pantalla: edicion. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

export const EDICION: Record<string, Pair> = {
  /* ---------- accesorios que se colocan solos sobre el rostro ---------- */
  'kiosk.edit.props.title': ['Accesorios', 'Props'],
  'kiosk.edit.props.hint': ['Se colocan solos. Tócalos otra vez para quitarlos.', 'They place themselves. Tap again to remove.'],
  'kiosk.edit.props.hint_many': ['Se colocan solos, uno para cada quien ({n}).', 'They place themselves, one for each of you ({n}).'],
  'kiosk.edit.props.hat': ['Sombrero', 'Hat'],
  'kiosk.edit.props.glasses': ['Lentes', 'Glasses'],
  'kiosk.edit.props.moustache': ['Bigote', 'Moustache'],
  'kiosk.edit.props.earrings': ['Aretes', 'Earrings'],

  /* ---------- texto sobre la foto ---------- */
  'kiosk.edit.caption.title': ['Texto', 'Text'],
  'kiosk.edit.caption.write': ['Escribir', 'Type'],
  'kiosk.edit.caption.color': ['Color del texto', 'Text color'],
  'kiosk.edit.caption.color_n': ['Color {n}', 'Color {n}'],
  'kiosk.edit.caption.placeholder': ['Escribe un nombre', 'Type a name'],
  'kiosk.edit.caption.space': ['Espacio', 'Space'],
  'kiosk.edit.caption.delete': ['Borrar', 'Delete'],
  'kiosk.edit.caption.done': ['Listo', 'Done'],
};
