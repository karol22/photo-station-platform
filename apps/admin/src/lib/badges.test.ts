import { describe, expect, it } from 'vitest';
import { onlineTone, statusTone } from './badges';

describe('statusTone', () => {
  it('distingue estados operativos de máquina', () => {
    expect(statusTone('active', 'machine')).toBe('ok');
    expect(statusTone('active_with_warnings', 'machine')).toBe('warn');
    expect(statusTone('out_of_service', 'machine')).toBe('danger');
    expect(statusTone('disconnected', 'machine')).toBe('danger');
    expect(statusTone('retired', 'machine')).toBe('neutral');
  });
  it('usa mapas específicos por tipo y cae al genérico', () => {
    expect(statusTone('open', 'incident')).toBe('danger');
    expect(statusTone('critical', 'severity')).toBe('danger');
    expect(statusTone('in_progress', 'rollout')).toBe('info');
    expect(statusTone('rolled_back', 'machineRelease')).toBe('warn');
    expect(statusTone('active', 'campaign')).toBe('ok');
    expect(statusTone('published')).toBe('ok');
    expect(statusTone('coming_soon')).toBe('info');
  });
  it('devuelve neutral ante estados desconocidos o vacíos', () => {
    expect(statusTone('whatever')).toBe('neutral');
    expect(statusTone(undefined)).toBe('neutral');
    expect(statusTone(null, 'machine')).toBe('neutral');
  });
  it('online/offline', () => {
    expect(onlineTone(true)).toBe('ok');
    expect(onlineTone(false)).toBe('danger');
  });
});
