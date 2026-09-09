/**
 * Eventos en vivo del agente (`/station/v1/events`, EventSource). Cada mensaje pasa por
 * `StationEvent.safeParse`; los que no validan se descartan. Reconecta solo y marca la conexión.
 */
import { useEffect } from 'react';
import { StationEvent } from '@psp/contracts';
import { EVENTS_URL } from './station';
import { useKioskStore } from '../store';

export function useStationEvents(): void {
  const applyEvent = useKioskStore((s) => s.applyEvent);
  const setConnection = useKioskStore((s) => s.setConnection);
  const refreshBundle = useKioskStore((s) => s.refreshBundle);
  const refreshStatus = useKioskStore((s) => s.refreshStatus);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      source = new EventSource(EVENTS_URL);
      source.onopen = () => {
        setConnection('online');
        void refreshStatus().catch(() => undefined);
      };
      source.onmessage = (message) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(message.data));
        } catch {
          return;
        }
        const parsed = StationEvent.safeParse(raw);
        if (!parsed.success) return;
        applyEvent(parsed.data);
        if (parsed.data.type === 'bundle_changed') void refreshBundle().catch(() => undefined);
      };
      source.onerror = () => {
        setConnection('lost');
        source?.close();
        retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, [applyEvent, setConnection, refreshBundle, refreshStatus]);
}
