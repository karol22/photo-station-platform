/**
 * Temporizador de inactividad de la sesión: `timers.idleTimeoutSec` con aviso a
 * `warningBeforeCancelSec` del final; al agotarse cancela y vuelve a atracción.
 *
 * Qué cuenta como seguir ahí, y por qué:
 * - **Tocar la pantalla.** Lo evidente.
 * - **Que la sesión avance.** Cuando el agente devuelve una sesión con `updatedAt` nuevo, algo
 *   pasó de verdad: se subió una captura, cambió la etapa, entró un pago. Eso es la persona
 *   usando la máquina aunque el dedo no haya tocado el vidrio.
 * - **Que la máquina esté trabajando para ella.** Durante la cuenta regresiva y la ráfaga de
 *   capturas nadie toca nada: se está posando. Las pantallas retienen el temporizador con
 *   `useIdleHold` y mientras haya una retención el tiempo no corre.
 *
 * Y qué pasa al agotarse depende de si hay dinero o fotografías de por medio: lo decide
 * `idleExpiryAction` (@psp/domain). Sin pago y sin capturas, la sesión se cancela y la máquina
 * queda libre. Con pago o con capturas, no se cancela nunca: la sesión avanza sola.
 *
 * Sin esto, una sesión ya pagada se cancelaba a media secuencia de poses por «inactividad».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { idleExpiryAction } from '@psp/domain';
import { stationApi } from '../api/station';
import { useKioskStore } from '../store';
import { useSession } from './useSession';

export interface SessionTimeoutState {
  remaining: number;
  total: number;
  warning: boolean;
  /** El tiempo está detenido porque la máquina trabaja para la persona. */
  held: boolean;
  /** Qué ocurre al agotarse: cancelar la sesión o seguir sola con la mejor opción. */
  onExpiry: 'cancel' | 'auto_advance';
  extend: () => Promise<void>;
  reset: () => void;
}

const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = ['pointerdown', 'touchstart', 'keydown'];

export interface SessionTimeoutOptions {
  /** Qué hacer cuando la sesión ya no se puede cancelar. Por defecto no hace nada y el aviso queda. */
  onAutoAdvance?: () => void;
}

export function useSessionTimeout(enabled = true, overrideSec?: number, options: SessionTimeoutOptions = {}): SessionTimeoutState {
  const { session, cancel } = useSession();
  const setSession = useKioskStore((s) => s.setSession);
  const idleHolds = useKioskStore((s) => s.idleHolds);
  const total = Math.max(5, overrideSec ?? session?.timers.idleTimeoutSec ?? 60);
  const warningAt = session?.timers.warningBeforeCancelSec ?? 15;
  const [remaining, setRemaining] = useState(total);
  const deadline = useRef(Date.now() + total * 1000);
  const cancelling = useRef(false);
  const held = idleHolds > 0;
  const onExpiry = session ? idleExpiryAction(session) : 'cancel';
  const autoAdvance = options.onAutoAdvance;
  const expiry = useRef({ onExpiry, autoAdvance });
  expiry.current = { onExpiry, autoAdvance };

  const reset = useCallback(() => {
    deadline.current = Date.now() + total * 1000;
    setRemaining(total);
  }, [total]);

  useEffect(() => {
    reset();
  }, [reset, session?.stage]);

  // Avance real de la sesión: cuenta como actividad aunque nadie haya tocado la pantalla.
  useEffect(() => {
    if (session) reset();
  }, [reset, session?.updatedAt]);

  useEffect(() => {
    if (!enabled || !session) return;
    for (const event of ACTIVITY_EVENTS) document.addEventListener(event, reset, { passive: true });
    const interval = setInterval(() => {
      // Con el temporizador retenido, la fecha límite se empuja: el tiempo no corre y al soltar
      // la retención la persona conserva la ventana completa.
      if (useKioskStore.getState().idleHolds > 0) {
        deadline.current = Date.now() + total * 1000;
        setRemaining(total);
        return;
      }
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !cancelling.current) {
        if (expiry.current.onExpiry === 'cancel') {
          // Cancelar es irreversible: se cierra el paso para no dispararlo dos veces.
          cancelling.current = true;
          void cancel('idle_timeout');
          return;
        }
        // Ya hay dinero o fotografías de por medio: la sesión sigue sola en vez de tirarse.
        // La ventana se reinicia, así que si la pantalla no avanza el aviso vuelve a aparecer.
        deadline.current = Date.now() + total * 1000;
        setRemaining(total);
        expiry.current.autoAdvance?.();
      }
    }, 500);
    return () => {
      for (const event of ACTIVITY_EVENTS) document.removeEventListener(event, reset);
      clearInterval(interval);
    };
  }, [enabled, session, reset, cancel, total]);

  const extend = useCallback(async () => {
    if (!session) return;
    try {
      const updated = await stationApi.extend(session.id, total);
      setSession(updated);
    } catch {
      // Si el agente no responde, el reinicio local sigue dando tiempo a la persona.
    }
    reset();
  }, [session, total, setSession, reset]);

  return { remaining, total, warning: !held && remaining <= warningAt, held, onExpiry, extend, reset };
}

/**
 * Retiene el temporizador de inactividad mientras `active` sea verdadero. La retención se suelta
 * al desmontar, así una pantalla que se va a media operación no deja el tiempo congelado.
 */
export function useIdleHold(active: boolean): void {
  const hold = useKioskStore((s) => s.holdIdle);
  const release = useKioskStore((s) => s.releaseIdle);
  useEffect(() => {
    if (!active) return;
    hold();
    return () => release();
  }, [active, hold, release]);
}
