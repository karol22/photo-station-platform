/**
 * La marquesina: una banda de focos en el borde superior de la pantalla.
 *
 * Hace tres trabajos que antes estaban repartidos y rotos. Es lo que se ve moverse desde el fondo
 * de un pasillo, cuando todavía no se distingue ni una letra. Es luz de verdad sobre la cara de
 * quien posa, porque el panel es la única fuente de luz que este producto controla. Y es el único
 * reloj del recorrido: en vez de una barra con números en rojo —que convierte la diversión en
 * examen— el tiempo se ve como focos que se van apagando.
 *
 * Vive siempre en el mismo sitio y con el mismo tamaño. No entra ni sale con las transiciones:
 * es lo único de la pantalla que no cambia nunca, y por eso se reconoce.
 *
 * Cuesta lo que cuesta animar la opacidad de veinticuatro elementos, que el compositor resuelve
 * sin volver a maquetar. No hay un solo degradado en movimiento.
 */
import type { CSSProperties } from 'react';
import { cx } from '../internal';
import type { BaseProps } from '../types';

export type MarqueeCadence =
  /** La cabina llama: los focos corren en los colores de la marca. */
  | 'call'
  /** La cabina espera algo: los focos se apagan de uno en uno según el tiempo que queda. */
  | 'wait'
  /** Cuenta regresiva: corren mucho más rápido. */
  | 'count'
  /** Trabajando: onda suave, sin urgencia. */
  | 'work'
  /** Quieta y encendida: el recorrido documental, donde nada debe distraer. */
  | 'still';

export interface MarqueeProps extends BaseProps {
  cadence?: MarqueeCadence;
  /**
   * Con `wait`, la fracción de tiempo que queda (1 = recién empezado, 0 = se acabó). Fuera de esa
   * cadencia no se usa.
   */
  remaining?: number;
  /** Cuántos focos. En apaisado caben menos. */
  bulbs?: number;
}

/** Cuántos milisegundos tarda un foco en pasar al siguiente, por cadencia. */
const STEP_MS: Record<MarqueeCadence, number> = {
  call: 500,
  count: 125,
  work: 900,
  wait: 0,
  still: 0,
};

export const MARQUEE_BULBS = 24;

export function Marquee({ cadence = 'call', remaining = 1, bulbs = MARQUEE_BULBS, className, ...rest }: MarqueeProps) {
  const count = Math.max(4, Math.round(bulbs));
  // Con `wait` el número de focos encendidos ES el tiempo que queda. Se redondea hacia arriba para
  // que quede al menos uno mientras no se haya agotado del todo: apagarlos todos antes de tiempo
  // diría que ya se acabó cuando todavía no.
  const lit = cadence === 'wait' ? Math.ceil(Math.min(1, Math.max(0, remaining)) * count) : count;
  const step = STEP_MS[cadence];

  return (
    <div className={cx('psp-marquee', className)} data-cadence={cadence} aria-hidden="true" {...rest}>
      {Array.from({ length: count }, (_unused, i) => {
        const style: CSSProperties = {
          // Cada foco toma uno de los seis acentos, en ciclo: la marca es el conjunto, no un color.
          ['--psp-bulb-color' as string]: `var(--psp-color-accent-${(i % 6) + 1})`,
          ...(step > 0 ? { animationDelay: `${i * step}ms`, animationDuration: `${count * step}ms` } : {}),
        };
        return <span key={i} className="psp-marquee__bulb" data-lit={cadence === 'wait' && i >= lit ? 'false' : 'true'} style={style} />;
      })}
    </div>
  );
}
