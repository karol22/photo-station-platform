/**
 * Store de UI (zustand). Sólo estado en memoria: la sesión persistente vive en el agente y se
 * recupera con `bootstrap()` tras una recarga.
 */
import { create } from 'zustand';
import type { KioskBundle, StationEvent, StationSession, StationStatus, TechStatus } from '@psp/contracts';
import type { Locale } from '@psp/i18n';
import { stationApi, setTechToken } from '../api/station';
import { INITIAL_DATA, applyStationEvent, holdIdle, initialLocale, isTerminal, releaseIdle, type CameraKind, type ConnectionState, type KioskData } from './reducers';

export interface KioskActions {
  bootstrap: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshBundle: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  setSession: (session: StationSession | undefined) => void;
  setStatus: (status: StationStatus) => void;
  setConnection: (connection: ConnectionState) => void;
  setCameraKind: (kind: CameraKind) => void;
  forceCamera: (kind: CameraKind | undefined) => void;
  setVisionLimited: (limited: boolean) => void;
  setTech: (token: string | undefined, status?: TechStatus) => void;
  setTechStatus: (status: TechStatus | undefined) => void;
  setError: (error: KioskData['lastError']) => void;
  applyEvent: (event: StationEvent) => void;
  /** Detiene el temporizador de inactividad mientras la máquina trabaja para la persona. */
  holdIdle: () => void;
  releaseIdle: () => void;
  /**
   * Cierra la sesión en el aparato y limpia el estado local. Devuelve `true` sólo si el agente
   * confirmó; si no, deja la sesión anotada en `pendingRelease` para volver a intentarlo.
   */
  releaseSession: (reason: string) => Promise<boolean>;
  /** Vuelve a leer la sesión activa del agente. Se usa al reconectar y al reintentar el cierre. */
  reconcile: () => Promise<void>;
  /** Limpieza total tras terminar/cancelar: la siguiente persona empieza de cero. */
  resetSession: () => void;
}

export type KioskState = KioskData & KioskActions;

export const useKioskStore = create<KioskState>()((set, get) => ({
  ...INITIAL_DATA,
  async bootstrap() {
    const [status, bundle] = await Promise.all([stationApi.status(), stationApi.bundle()]);
    set({ status, bundle, locale: initialLocale(bundle, get().locale), connection: 'online' });
    const session = await stationApi.activeSession().catch(() => undefined);
    set({ session });
  },
  async refreshStatus() {
    const status = await stationApi.status();
    set({ status, connection: 'online' });
  },
  async refreshBundle() {
    const bundle = await stationApi.bundle();
    set({ bundle });
  },
  setLocale: (locale) => set({ locale }),
  setSession: (session) => set({ session }),
  setStatus: (status) => set({ status }),
  setConnection: (connection) => set({ connection }),
  setCameraKind: (cameraKind) => set({ cameraKind }),
  forceCamera: (cameraForced) => set({ cameraForced, ...(cameraForced ? { cameraKind: cameraForced } : {}) }),
  setVisionLimited: (visionLimited) => set({ visionLimited }),
  setTech: (techToken, techStatus) => {
    setTechToken(techToken);
    set({ techToken, techStatus });
  },
  setTechStatus: (techStatus) => set({ techStatus }),
  setError: (lastError) => set({ lastError }),
  applyEvent: (event) => set((state) => applyStationEvent(state, event)),
  holdIdle: () => set((state) => holdIdle(state)),
  releaseIdle: () => set((state) => releaseIdle(state)),
  async releaseSession(reason) {
    const state = get();
    const id = state.session && !isTerminal(state.session.stage) ? state.session.id : state.pendingRelease;
    if (!id) {
      set({ session: undefined, pendingRelease: undefined, idleHolds: 0, lastError: undefined });
      return true;
    }
    try {
      await stationApi.cancel(id, reason);
      set({ session: undefined, pendingRelease: undefined, idleHolds: 0, lastError: undefined });
      return true;
    } catch {
      // La máquina se queda con una sesión viva: se anota para reintentarlo y la atracción
      // no ofrece empezar hasta que quede cerrada.
      set({ session: undefined, pendingRelease: id, idleHolds: 0 });
      return false;
    }
  },
  async reconcile() {
    const session = await stationApi.activeSession().catch(() => undefined);
    set((state) => ({
      session,
      // Si el agente ya no reporta sesión activa, lo pendiente quedó cerrado por su cuenta.
      pendingRelease: session === undefined ? undefined : state.pendingRelease,
    }));
  },
  resetSession: () => set({ session: undefined, lastError: undefined, idleHolds: 0, locale: initialLocale(get().bundle, get().locale) }),
}));

export type { CameraKind, ConnectionState, KioskData } from './reducers';
