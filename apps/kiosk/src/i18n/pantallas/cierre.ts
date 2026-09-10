/** Textos de la pantalla: cierre. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

export const CIERRE: Record<string, Pair> = {
  /* El rótulo de 96 px del cierre. Dos palabras: se lee desde el pasillo y no se traduce mal. */
  'kiosk.done.rotulo': ['Ya está', 'All done'],
  /* La única acción de la banda de alcance. `kiosk.done.back_now` sigue siendo el texto largo. */
  'kiosk.done.ready_now': ['Listo', 'Done'],
  /* La ventana para escanear se dice sin eufemismo y con reloj: es corta a propósito, porque el
     enlace vive en el aparato y muere con la sesión. */
  'kiosk.done.scan_window': ['Te quedan {{clock}} para escanear', '{{clock}} left to scan'],
  /* La promesa que distingue a esta cabina, en el sitio donde la gente teme perder sus fotos:
     lo que viaja por el enlace es la membresía, nunca la fotografía. */
  'kiosk.done.link_is_membership': [
    'El enlace es tu membresía, no tus fotos: las fotos no salen de esta máquina.',
    'The link is your membership, not your photos: photos never leave this machine.',
  ],
};
