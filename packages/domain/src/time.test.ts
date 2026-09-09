import { describe, expect, it } from 'vitest';
import { compareSemver, hhmmToMinutes, inMaintenanceWindow, localTimeParts, scheduleMatches, windowMatches } from './time';

const TZ = 'America/Mexico_City';

describe('localTimeParts', () => {
  it('convierte a hora local con zona IANA', () => {
    // 2026-09-09T00:00Z = martes 8 de septiembre, 18:00 en Ciudad de México (UTC-6).
    expect(localTimeParts(new Date('2026-09-09T00:00:00Z'), TZ)).toEqual({ hhmm: '18:00', day: 2, isoDate: '2026-09-08' });
    expect(localTimeParts(new Date('2026-09-09T06:05:00Z'), TZ)).toEqual({ hhmm: '00:05', day: 3, isoDate: '2026-09-09' });
    expect(localTimeParts(new Date('2026-09-09T00:00:00Z'), 'UTC')).toEqual({ hhmm: '00:00', day: 3, isoDate: '2026-09-09' });
  });

  it('cae a UTC con una zona inválida y rechaza fechas inválidas', () => {
    expect(localTimeParts(new Date('2026-09-09T00:00:00Z'), 'Marte/Olympus')).toEqual({ hhmm: '00:00', day: 3, isoDate: '2026-09-09' });
    expect(() => localTimeParts(new Date('nope'), TZ)).toThrow();
  });
});

describe('scheduleMatches', () => {
  const tuesday18 = new Date('2026-09-09T00:00:00Z');
  it('lista vacía = siempre; respeta días y rango [from, to)', () => {
    expect(scheduleMatches([], tuesday18, TZ)).toBe(true);
    expect(scheduleMatches([{ days: [1, 2, 3, 4, 5], from: '17:00', to: '19:00' }], tuesday18, TZ)).toBe(true);
    expect(scheduleMatches([{ days: [0, 6], from: '17:00', to: '19:00' }], tuesday18, TZ)).toBe(false);
    expect(scheduleMatches([{ days: [2], from: '18:00', to: '18:00' }], tuesday18, TZ)).toBe(true); // 24 h
    expect(scheduleMatches([{ days: [2], from: '19:00', to: '18:00' }], tuesday18, TZ)).toBe(false);
    expect(scheduleMatches([{ days: [2], from: '10:00', to: '18:00' }], tuesday18, TZ)).toBe(false); // to es exclusivo
  });

  it('un horario que cruza medianoche cuenta el día en que empieza', () => {
    const wednesday0005 = new Date('2026-09-09T06:05:00Z');
    expect(scheduleMatches([{ days: [2], from: '22:00', to: '02:00' }], wednesday0005, TZ)).toBe(true);
    expect(scheduleMatches([{ days: [3], from: '22:00', to: '02:00' }], wednesday0005, TZ)).toBe(false);
  });
});

describe('windowMatches', () => {
  it('semiabierta [start, end); sin ventana = siempre', () => {
    const now = new Date('2026-09-09T00:00:00Z');
    expect(windowMatches(undefined, now)).toBe(true);
    expect(windowMatches({ start: '2026-09-01T00:00:00Z' }, now)).toBe(true);
    expect(windowMatches({ start: '2026-09-10T00:00:00Z' }, now)).toBe(false);
    expect(windowMatches({ start: '2026-09-01T00:00:00Z', end: '2026-09-09T00:00:00Z' }, now)).toBe(false);
    expect(windowMatches({ start: '2026-09-01T00:00:00Z', end: '2026-09-09T00:00:01Z' }, now)).toBe(true);
    expect(windowMatches({ start: 'nope' }, now)).toBe(false);
  });
});

describe('inMaintenanceWindow', () => {
  it('soporta ventanas que cruzan medianoche y ventanas abiertas', () => {
    expect(inMaintenanceWindow('23:30', '22:00', '06:00')).toBe(true);
    expect(inMaintenanceWindow('03:00', '22:00', '06:00')).toBe(true);
    expect(inMaintenanceWindow('12:00', '22:00', '06:00')).toBe(false);
    expect(inMaintenanceWindow('12:00', '09:00', '13:00')).toBe(true);
    expect(inMaintenanceWindow('13:00', '09:00', '13:00')).toBe(false);
    expect(inMaintenanceWindow('12:00')).toBe(true);
    expect(inMaintenanceWindow('12:00', '11:00')).toBe(true);
    expect(inMaintenanceWindow('12:00', undefined, '11:00')).toBe(false);
    expect(inMaintenanceWindow('nope', '22:00', '06:00')).toBe(false);
    expect(hhmmToMinutes('9:30')).toBe(570);
  });
});

describe('compareSemver', () => {
  it('ordena versiones, pre-releases y builds', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('1.2.3', '1.10.0')).toBe(-1);
    expect(compareSemver('2.0.0', '1.99.99')).toBe(1);
    expect(compareSemver('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
    expect(compareSemver('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
    expect(compareSemver('1.0.0-rc.1', '1.0.0')).toBe(-1);
    expect(compareSemver('1.0.0+build.5', '1.0.0')).toBe(0);
    expect(compareSemver('v1.2', '1.2.0')).toBe(0);
    expect(['1.0.0', '0.9.0', '1.0.0-rc.1', '0.10.0'].sort(compareSemver)).toEqual(['0.9.0', '0.10.0', '1.0.0-rc.1', '1.0.0']);
  });
});
