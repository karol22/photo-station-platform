import { describe, expect, it } from 'vitest';
import { messages } from '@psp/i18n';
import { EXTRA_MESSAGES, EXTRA_TABLE } from './extra';
import { t } from './index';

describe('catálogo extra del kiosco', () => {
  it('cada clave tiene es y en no vacíos', () => {
    for (const [key, pair] of Object.entries(EXTRA_TABLE)) {
      expect(pair[0].length, key).toBeGreaterThan(0);
      expect(pair[1].length, key).toBeGreaterThan(0);
    }
    expect(Object.keys(EXTRA_MESSAGES.es)).toEqual(Object.keys(EXTRA_MESSAGES.en));
  });
  it('el paquete tiene prioridad y las claves extra resuelven en ambos idiomas', () => {
    for (const key of Object.keys(EXTRA_TABLE)) {
      const es = t('es', key);
      expect(es, key).not.toBe(key);
      if (messages.es[key] !== undefined) expect(es).toBe(messages.es[key]);
    }
    expect(t('en', 'kiosk.attract.cta')).toBe('Tap to start');
    expect(t('es', 'kiosk.common.step_n_of_m', { n: 1, m: 3 })).toBe('Paso 1 de 3');
  });
});
