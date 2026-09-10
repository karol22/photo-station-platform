/**
 * Reductores puros del estado del kiosco: sin React ni red, probados en Node.
 * El store de zustand delega aquí para que la lógica sea verificable.
 */
import type { KioskBundle, StationEvent, StationSession, StationStatus, TechStatus } from '@psp/contracts';
import type { Locale } from '@psp/i18n';

export type CameraKind = 'webcam' | 'synthetic';
export type ConnectionState = 'connecting' | 'online' | 'lost';

export interface KioskData {
  status: StationStatus | undefined;
  bundle: KioskBundle | undefined;
  session: StationSession | undefined;
  locale: Locale;
  techToken: string | undefined;
  techStatus: TechStatus | undefined;
  cameraKind: CameraKind;
  cameraForced: CameraKind | undefined;
  connection: ConnectionState;
  visionLimited: boolean;
  lastError: { code: string; message: string; incidentCode?: string } | undefined;
  /**
   * Retenciones activas del temporizador de inactividad. Mientras haya al menos una, la persona
   * está ocupada con la máquina —posando, esperando una subida— aunque no toque la pantalla,
   * y el tiempo no corre. Es un contador y no un booleano porque dos pantallas pueden retener a la vez.
   */
  idleHolds: number;
  /**
   * Sesión que quedó abierta en el aparato y que todavía no se pudo cerrar.
   *
   * Cerrar la sesión es del agente, no del navegador: si la llamada falla y el kiosco limpia su
   * estado igual, la máquina se queda con una sesión viva y rechaza a la siguiente persona con
   * `session_active`, que es un error sin salida delante de alguien que acaba de llegar. Mientras
   * esto tenga un identificador, la cabina no ofrece empezar y sigue intentando cerrarla.
   */
  pendingRelease: string | undefined;
}

export const INITIAL_DATA: KioskData = {
  status: undefined,
  bundle: undefined,
  session: undefined,
  locale: 'es',
  techToken: undefined,
  techStatus: undefined,
  cameraKind: 'webcam',
  cameraForced: undefined,
  connection: 'connecting',
  visionLimited: false,
  lastError: undefined,
  idleHolds: 0,
  pendingRelease: undefined,
};

/** Aplica un evento SSE del agente al estado. Devuelve el mismo objeto si nada cambia. */
export function applyStationEvent(state: KioskData, event: StationEvent): KioskData {
  switch (event.type) {
    case 'status':
      return { ...state, status: event.status };
    case 'session': {
      // Un evento de OTRA sesión mientras la de esta persona sigue viva se ignora: aceptarlo
      // cambiaría la pantalla debajo de sus pies con las fotos de alguien más. La única excepción
      // es un relevo del técnico, y ése empieza cancelando la sesión anterior, así que para cuando
      // llega su evento la de aquí ya está en etapa terminal.
      if (state.session && state.session.id !== event.session.id && !isTerminal(state.session.stage)) return state;
      return { ...state, session: event.session };
    }
    case 'printer': {
      if (!state.status) return state;
      const printers = state.status.printers.map((p) => (p.id === event.printer.id ? event.printer : p));
      if (!printers.some((p) => p.id === event.printer.id)) printers.push(event.printer);
      return { ...state, status: { ...state.status, printers } };
    }
    case 'print_job': {
      if (!state.session || event.job.sessionId !== state.session.id) return state;
      const jobs = state.session.printJobs.some((j) => j.id === event.job.id)
        ? state.session.printJobs.map((j) => (j.id === event.job.id ? event.job : j))
        : [...state.session.printJobs, event.job];
      return { ...state, session: { ...state.session, printJobs: jobs } };
    }
    case 'payment': {
      if (!state.session || event.intent.sessionId !== state.session.id) return state;
      return {
        ...state,
        session: { ...state.session, payment: event.intent, commercial: { ...state.session.commercial, paymentState: event.intent.state } },
      };
    }
    case 'ai_job': {
      if (!state.session || event.job.sessionId !== state.session.id) return state;
      const jobs = state.session.aiJobs.some((j) => j.id === event.job.id)
        ? state.session.aiJobs.map((j) => (j.id === event.job.id ? event.job : j))
        : [...state.session.aiJobs, event.job];
      return { ...state, session: { ...state.session, aiJobs: jobs } };
    }
    case 'maintenance': {
      if (!state.status) return state;
      return { ...state, status: { ...state.status, maintenance: { on: event.on, ...(event.message ? { message: event.message } : {}) } } };
    }
    case 'bundle_changed':
    case 'command':
    case 'machine_event':
      return state;
    default:
      return state;
  }
}

export function isTerminal(stage: StationSession['stage']): boolean {
  return stage === 'done' || stage === 'cancelled' || stage === 'failed' || stage === 'expired' || stage === 'abandoned';
}

/** Cámara efectiva: la forzada por el técnico gana; si no, sintética cuando la cámara no opera. */
export function effectiveCameraKind(
  state: { cameraForced: CameraKind | undefined; status: { capabilities: Array<{ key: string; present: boolean; operational: boolean }> } | undefined },
  webcamAvailable: boolean,
): CameraKind {
  if (state.cameraForced) return state.cameraForced;
  const cam = state.status?.capabilities.find((c) => c.key === 'camera.primary');
  if (cam && (!cam.present || !cam.operational)) return 'synthetic';
  return webcamAvailable ? 'webcam' : 'synthetic';
}

/** Idioma inicial: el configurado en el bundle si está entre los disponibles. */
export function initialLocale(bundle: KioskBundle | undefined, fallback: Locale = 'es'): Locale {
  const value = bundle?.effective.values['kiosk.defaultLocale'];
  return value === 'en' || value === 'es' ? value : fallback;
}

export function availableLocales(bundle: KioskBundle | undefined): Locale[] {
  const value = bundle?.effective.values['kiosk.locales'];
  const list = Array.isArray(value) ? value.filter((v): v is Locale => v === 'es' || v === 'en') : [];
  return list.length > 0 ? list : ['es', 'en'];
}

/** Toma una retención del temporizador de inactividad. */
export function holdIdle<T extends { idleHolds: number }>(state: T): T {
  return { ...state, idleHolds: state.idleHolds + 1 };
}

/** Suelta una retención; nunca baja de cero aunque se suelte de más. */
export function releaseIdle<T extends { idleHolds: number }>(state: T): T {
  return { ...state, idleHolds: Math.max(0, state.idleHolds - 1) };
}
