/**
 * Selección: ya no es una pantalla propia.
 *
 * Mirar las tomas y quedarse con unas cuantas era una sola decisión partida en dos pantallas, y
 * con alguien esperando detrás se cobraba dos veces: primero «¿te gustan?» y después «¿cuáles?».
 * La decisión completa vive ahora en la revisión (PANTALLA 6), donde se descartan las que sobran
 * y ahí queda hecha la selección, y `stagesForProduct` ya no emite la etapa `selecting`.
 *
 * La ruta se conserva porque hay sesiones guardadas en el aparato que están en esa etapa: al
 * recuperarlas después de una recarga tienen que caer en una pantalla que funcione, no en un
 * hueco. Muestra exactamente la misma revisión, así que la persona no ve dos productos distintos.
 */
export { ReviewScreen as SelectScreen } from './Review';
