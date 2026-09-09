/**
 * Temporizador de inactividad de la sesión: `timers.idleTimeoutSec` con aviso a
 * `warningBeforeCancelSec` del final; cualquier toque reinicia; extender llama a `POST /extend`;
 * al agotarse cancela y vuelve a atracción.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { stationApi } from '../api/station';
import { useKioskStore } from '../store';
import { useSession } from './useSession';

export interface SessionTimeoutState {
  remaining: number;
  total: number;
  warning: boolean;
  extend: () => Promise<void>;
  reset: () => void;
}

const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = ['pointerdown', 'touchstart', 'keydown'];

export function useSessionTimeout(enabled = true, overrideSec?: number): SessionTimeoutState {
  const { session, cancel } = useSession();
  const setSession = useKioskStore((s) => s.setSession);
  const total = Math.max(5, overrideSec ?? session?.timers.idleTimeoutSec ?? 60);
  const warningAt = session?.timers.warningBeforeCancelSec ?? 15;
  const [remaining, setRemaining] = useState(total);
  const deadline = useRef(Date.now() + total * 1000);
  const cancelling = useRef(false);

  const reset = useCallback(() => {
    deadline.current = Date.now() + total * 1000;
    setRemaining(total);
  }, [total]);

  useEffect(() => {
    reset();
  }, [reset, session?.stage]);

  useEffect(() => {
    if (!enabled || !session) return;
    for (const event of ACTIVITY_EVENTS) document.addEventListener(event, reset, { passive: true });
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !cancelling.current) {
        cancelling.current = true;
        void cancel('idle_timeout');
      }
    }, 500);
    return () => {
      for (const event of ACTIVITY_EVENTS) document.removeEventListener(event, reset);
      clearInterval(interval);
    };
  }, [enabled, session, reset, cancel]);

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

  return { remaining, total, warning: remaining <= warningAt, extend, reset };
}
