/**
 * Store de UI (zustand). Sólo estado en memoria: la sesión persistente vive en el agente y se
 * recupera con `bootstrap()` tras una recarga.
 */
import { create } from 'zustand';
import type { KioskBundle, StationEvent, StationSession, StationStatus, TechStatus } from '@psp/contracts';
import type { Locale } from '@psp/i18n';
import { stationApi, setTechToken } from '../api/station';
import { INITIAL_DATA, applyStationEvent, initialLocale, type CameraKind, type ConnectionState, type KioskData } from './reducers';

export interface KioskActions {
  bootstrap: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshBundle: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  /** Cuántas personas dijo que son; guía el catálogo y, más adelante, el encuadre. */
  setGroupSize: (size: number | undefined) => void;
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
  setGroupSize: (groupSize) => set({ groupSize }),
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
  resetSession: () => set({ session: undefined, lastError: undefined, groupSize: undefined, locale: initialLocale(get().bundle, get().locale) }),
}));

export type { CameraKind, ConnectionState, KioskData } from './reducers';
