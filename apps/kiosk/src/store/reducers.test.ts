import { describe, expect, it } from 'vitest';
import type { PrintJob, StationSession, StationStatus } from '@psp/contracts';
import { INITIAL_DATA, applyStationEvent, availableLocales, effectiveCameraKind, holdIdle, initialLocale, releaseIdle } from './reducers';

const status = {
  apiVersion: 'station.v1',
  machineId: 'mch_1',
  machineCode: 'M1',
  machineName: 'm',
  organizationId: 'org_1',
  status: 'active',
  cloudReachable: true,
  softwareVersion: '0.1.0',
  maintenance: { on: false },
  capabilities: [{ key: 'camera.primary', present: true, operational: false }],
  printers: [{ id: 'p1', name: 'p', type: 'photo', paperSizes: ['4x6in'], color: true, priority: 0, status: 'ready' }],
  paymentTerminal: { adapter: 'mock', status: 'ready' },
  storage: { freeMb: 1000, usedPct: 10 },
  time: { now: '2026-01-01T00:00:00Z', timezone: 'UTC', localTime: '00:00' },
  demoMode: false,
  notices: [],
  pendingEvents: 0,
} as unknown as StationStatus;

const session = { id: 'ses_1', stage: 'printing', printJobs: [], aiJobs: [], commercial: { state: 'free', paymentState: 'free', promotionIds: [] } } as unknown as StationSession;

describe('reductor de eventos SSE', () => {
  it('status reemplaza el estado y maintenance lo modifica', () => {
    const s1 = applyStationEvent(INITIAL_DATA, { type: 'status', status });
    expect(s1.status?.machineCode).toBe('M1');
    const s2 = applyStationEvent(s1, { type: 'maintenance', on: true, message: 'x' });
    expect(s2.status?.maintenance).toEqual({ on: true, message: 'x' });
  });
  it('print_job se agrega o actualiza sólo si es de la sesión activa', () => {
    const base = { ...INITIAL_DATA, status, session };
    const job = { id: 'job_1', sessionId: 'ses_1', machineId: 'mch_1', printerId: 'p1', copies: 1, status: 'preparing', attempt: 1, idempotencyKey: 'k', isTest: false, createdAt: '2026-01-01T00:00:00Z' } as PrintJob;
    const s1 = applyStationEvent(base, { type: 'print_job', job });
    expect(s1.session?.printJobs).toHaveLength(1);
    const s2 = applyStationEvent(s1, { type: 'print_job', job: { ...job, status: 'completed' } });
    expect(s2.session?.printJobs[0]?.status).toBe('completed');
    const other = applyStationEvent(s2, { type: 'print_job', job: { ...job, id: 'job_2', sessionId: 'ses_other' } });
    expect(other).toBe(s2);
  });
  it('printer actualiza la impresora del status', () => {
    const base = { ...INITIAL_DATA, status };
    const printer = { ...status.printers[0]!, status: 'no_paper' as const };
    expect(applyStationEvent(base, { type: 'printer', printer }).status?.printers[0]?.status).toBe('no_paper');
  });
  it('cámara efectiva: forzada > capacidad no operativa > disponibilidad de webcam', () => {
    expect(effectiveCameraKind({ cameraForced: 'webcam', status }, false)).toBe('webcam');
    expect(effectiveCameraKind({ cameraForced: undefined, status }, true)).toBe('synthetic');
    expect(effectiveCameraKind({ cameraForced: undefined, status: undefined }, true)).toBe('webcam');
    expect(effectiveCameraKind({ cameraForced: undefined, status: undefined }, false)).toBe('synthetic');
  });
  it('idioma inicial y disponibles salen del bundle', () => {
    const bundle = { effective: { values: { 'kiosk.defaultLocale': 'en', 'kiosk.locales': ['en'] } } } as never;
    expect(initialLocale(bundle)).toBe('en');
    expect(availableLocales(bundle)).toEqual(['en']);
    expect(availableLocales(undefined)).toEqual(['es', 'en']);
  });
});

describe('retención del temporizador de inactividad', () => {
  it('cuenta retenciones y nunca baja de cero', () => {
    let state = { ...INITIAL_DATA };
    expect(state.idleHolds).toBe(0);
    state = holdIdle(state);
    state = holdIdle(state);
    expect(state.idleHolds).toBe(2);
    state = releaseIdle(state);
    expect(state.idleHolds).toBe(1);
    state = releaseIdle(state);
    state = releaseIdle(state);
    expect(state.idleHolds).toBe(0);
  });

  it('no muta el estado recibido', () => {
    const state = { ...INITIAL_DATA, idleHolds: 1 };
    const next = holdIdle(state);
    expect(state.idleHolds).toBe(1);
    expect(next).not.toBe(state);
  });
});

describe('eventos de otra sesión', () => {
  const otra = { ...session, id: 'ses_otra', stage: 'capturing' } as StationSession;

  it('se ignoran mientras la sesión de esta persona sigue viva', () => {
    const state = { ...INITIAL_DATA, session: { ...session, stage: 'editing' } as StationSession };
    expect(applyStationEvent(state, { type: 'session', session: otra })).toBe(state);
  });

  it('se aceptan cuando la sesión anterior ya terminó', () => {
    const state = { ...INITIAL_DATA, session: { ...session, stage: 'cancelled' } as StationSession };
    expect(applyStationEvent(state, { type: 'session', session: otra }).session?.id).toBe('ses_otra');
  });

  it('se aceptan cuando no hay ninguna sesión local', () => {
    expect(applyStationEvent(INITIAL_DATA, { type: 'session', session: otra }).session?.id).toBe('ses_otra');
  });

  it('la actualización de la propia sesión siempre entra', () => {
    const state = { ...INITIAL_DATA, session: { ...session, stage: 'capturing' } as StationSession };
    const avanzada = { ...session, stage: 'reviewing' } as StationSession;
    expect(applyStationEvent(state, { type: 'session', session: avanzada }).session?.stage).toBe('reviewing');
  });
});
