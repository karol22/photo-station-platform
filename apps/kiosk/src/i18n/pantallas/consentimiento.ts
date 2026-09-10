/** Textos de la pantalla: consentimiento. Ninguna cadena lleva marca, precio ni ciudad: eso viene del bundle. */
import type { Pair } from '../extra';

export const CONSENTIMIENTO: Record<string, Pair> = {
  /* Dos botones y ya. «De acuerdo» cabe a 96 px; «Aceptar y continuar» no, y a esa escala el
     verbo de más se lee como ruido. */
  'kiosk.consent.agree': ['De acuerdo', 'I agree'],
  /* La salida está siempre a la vista: un consentimiento con la negativa escondida no es un
     consentimiento. */
  'kiosk.consent.decline': ['No acepto', 'I do not accept'],
  /* Lo opcional deja de competir con la decisión y se agrupa dentro del aviso completo. */
  'kiosk.consent.options_title': ['Opciones que puedes activar', 'Options you can turn on'],
  'kiosk.consent.options_hint': ['Nada de esto hace falta para continuar.', 'None of this is needed to continue.'],
};
