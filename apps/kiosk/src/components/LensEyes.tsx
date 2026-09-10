/**
 * Los ojos del lente: el elemento por el que la cabina se recuerda.
 *
 * Nadie mira al lente, porque nadie sabe dónde está: mira su propia cara, que es lo que la
 * pantalla le enseña. Dos ojos de la familia, quietos exactamente donde está la cámara física,
 * resuelven eso sin letrero y sin idioma, y al cerrarse dicen que la foto ya se tomó: es el
 * único aviso del disparo que llega a quien no oye. Son lo único que se puede poner encima del
 * espejo, y por eso no llevan ni pupilas ni cejas: la ternura viene del movimiento.
 *
 * El sitio del lente cambia con el modelo de aparato, así que llega por configuración. Cuando la
 * cámara acabó dentro del bisel, los ojos no se recortan contra el canto: bajan al borde y
 * apuntan hacia arriba con una flecha, porque un ojo cortado por la mitad deja de ser una cara.
 */
import { configNumber, type ConfigSource } from '../theme/assets';

/**
 * Qué está haciendo la máquina, en el vocabulario de esta pantalla. No es la fase de la captura:
 * los ojos no saben de subidas ni de compases, sólo de si hay que mirar, prepararse o parpadear.
 */
export type LensMoment = 'rest' | 'work' | 'countdown' | 'shot';

/** Cómo se ven los ojos: en reposo, atentos, agrandados por la luz, o cerrados en el disparo. */
export type LensState = 'rest' | 'ready' | 'wide' | 'shut';

/** Por debajo de este porcentaje la cámara quedó en el bisel y los ojos no caben arriba. */
export const LENS_BEZEL_LIMIT = 3;

/** A cuántos segundos del disparo los ojos crecen y toman la luz. */
export const LENS_WIDE_SEC = 2;

/**
 * El estado de los ojos en cada momento. Es una función pura para poder comprobar el guion del
 * disparo sin un navegador: es un guion de tiempos, y los tiempos se equivocan en silencio.
 */
export function lensStateFor(moment: LensMoment, secondsLeft = Number.POSITIVE_INFINITY): LensState {
  if (moment === 'shot') return 'shut';
  if (moment === 'countdown') return secondsLeft <= LENS_WIDE_SEC ? 'wide' : 'ready';
  if (moment === 'work') return 'ready';
  return 'rest';
}

export interface LensEyesProps {
  bundle: ConfigSource | undefined;
  state?: LensState;
  className?: string;
}

export function LensEyes({ bundle, state = 'rest', className }: LensEyesProps) {
  const x = configNumber(bundle, 'kiosk.lens.offsetX', 50);
  const declared = configNumber(bundle, 'kiosk.lens.offsetY', 6);
  const bezel = declared < LENS_BEZEL_LIMIT;
  const y = bezel ? LENS_BEZEL_LIMIT : declared;
  return (
    <div
      className={`kiosk-lens${className ? ` ${className}` : ''}`}
      data-state={state}
      data-bezel={bezel ? 'true' : undefined}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden="true"
    >
      {bezel ? <span className="kiosk-lens__arrow" /> : null}
      <span className="kiosk-lens__eyes">
        <span className="kiosk-lens__eye" />
        <span className="kiosk-lens__eye" />
      </span>
    </div>
  );
}
