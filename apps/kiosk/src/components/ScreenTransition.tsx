/**
 * Transición entre pantallas.
 *
 * Sin esto, cada avance del recorrido reemplaza el DOM de golpe y se siente como un corte: la
 * persona no sabe si retrocedió, si avanzó o si la máquina se reinició. Con una dirección
 * consistente —adelante entra por la derecha, atrás por la izquierda— la pantalla cuenta hacia
 * dónde va el recorrido sin escribir una palabra, que es justo lo que necesita alguien que no lee.
 *
 * El orden de las rutas es el del recorrido, así que comparar posiciones basta para saber la
 * dirección. Una ruta desconocida entra sin dirección, con un fundido.
 *
 * Sólo se anima `transform` y `opacity`: son las dos propiedades que el compositor resuelve sin
 * volver a maquetar, y el hilo principal está ocupado analizando cuadros de cámara.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '../session/flow';

/** El recorrido en orden. Un índice mayor es «más adelante». */
const ORDER: string[] = [
  ROUTES.attract,
  ROUTES.home,
  '/product',
  ROUTES.consent,
  ROUTES.payment,
  ROUTES.capture,
  ROUTES.review,
  ROUTES.select,
  ROUTES.edit,
  ROUTES.compose,
  ROUTES.confirm,
  ROUTES.print,
  ROUTES.finish,
];

/** Posición de una ruta en el recorrido; `-1` cuando no forma parte de él (error, técnico). */
export function stepIndex(pathname: string): number {
  return ORDER.findIndex((route) => (route === ROUTES.attract ? pathname === route : pathname.startsWith(route)));
}

/** `forward`, `back` o `none` según el movimiento entre dos rutas del recorrido. */
export function direction(from: string | undefined, to: string): 'forward' | 'back' | 'none' {
  if (from === undefined || from === to) return 'none';
  const a = stepIndex(from);
  const b = stepIndex(to);
  if (a < 0 || b < 0 || a === b) return 'none';
  return b > a ? 'forward' : 'back';
}

export function ScreenTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const previous = useRef<string | undefined>(undefined);
  const dir = direction(previous.current, location.pathname);

  useEffect(() => {
    previous.current = location.pathname;
  }, [location.pathname]);

  return (
    <div className="kiosk-screen" data-direction={dir} key={location.pathname}>
      {children}
    </div>
  );
}
