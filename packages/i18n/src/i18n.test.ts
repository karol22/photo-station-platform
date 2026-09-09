import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  DEFAULT_LOCALE,
  LOCALES,
  createTranslator,
  formatDate,
  formatDuration,
  formatMoney,
  formatNumber,
  formatTime,
  hasMessage,
  interpolate,
  isLocale,
  resolveLocale,
  t,
  tl,
  translateWith,
} from './index';

const ISO = '2026-09-09T20:05:00Z';
const MX = 'America/Mexico_City';

describe('t', () => {
  it('traduce en el idioma pedido e interpola parámetros', () => {
    expect(t('es', 'kiosk.capture.poseNde', { n: 2, total: 3 })).toBe('Pose 2 de 3');
    expect(t('en', 'kiosk.capture.poseNde', { n: 2, total: 3 })).toBe('Pose 2 of 3');
    expect(t('en', 'common.continuar')).toBe('Continue');
  });

  it('cae a español cuando la clave falta en el idioma pedido', () => {
    const catalogs = { es: { 'x.saludo': 'Hola {{name}}', 'x.solo': 'Solo español' }, en: { 'x.saludo': 'Hi {{name}}' } };
    expect(translateWith(catalogs, 'en', 'x.saludo', { name: 'Ana' })).toBe('Hi Ana');
    expect(translateWith(catalogs, 'en', 'x.solo')).toBe('Solo español');
    expect(translateWith({ es: {} }, 'en', 'x.nada')).toBe('x.nada');
  });

  it('devuelve la clave cuando no existe en ningún catálogo', () => {
    expect(t('es', 'clave.inexistente')).toBe('clave.inexistente');
    expect(t('en', 'clave.inexistente', { a: 1 })).toBe('clave.inexistente');
  });

  it('deja visible el marcador si falta el parámetro y tolera espacios dentro de las llaves', () => {
    expect(interpolate('Hola {{name}}, {{ count }} fotos', { count: 3 })).toBe('Hola {{name}}, 3 fotos');
    expect(interpolate('sin params')).toBe('sin params');
    expect(t('es', 'kiosk.finish.seEliminaraEn')).toBe('Tus fotos se eliminarán en {{duration}}.');
  });

  it('hasMessage e isLocale distinguen claves e idiomas válidos', () => {
    expect(hasMessage('common.continuar')).toBe(true);
    expect(hasMessage('common.nada')).toBe(false);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(resolveLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('en')).toBe('en');
    expect(LOCALES).toEqual(['es', 'en']);
  });
});

describe('tl', () => {
  it('usa el inglés cuando existe y cae a español si falta o está vacío', () => {
    expect(tl('en', { es: 'Hola', en: 'Hello' })).toBe('Hello');
    expect(tl('en', { es: 'Hola' })).toBe('Hola');
    expect(tl('en', { es: 'Hola', en: '' })).toBe('Hola');
    expect(tl('es', { es: 'Hola', en: 'Hello' })).toBe('Hola');
  });

  it('usa el fallback cuando no hay texto', () => {
    expect(tl('es', undefined)).toBe('');
    expect(tl('es', undefined, 'Sin nombre')).toBe('Sin nombre');
    expect(tl('en', { es: '' }, 'Unnamed')).toBe('Unnamed');
  });
});

describe('formatMoney', () => {
  it('formatea MXN en unidades menores según el ejemplo del contrato', () => {
    expect(formatMoney({ amount: 8000, currency: 'MXN' }, 'es')).toBe('$80.00');
    expect(formatMoney({ amount: 1500000, currency: 'MXN' }, 'es')).toBe('$15,000.00');
    expect(formatMoney({ amount: 8000, currency: 'MXN' }, 'en')).toMatch(/^MX\$80\.00$/);
  });

  it('formatea USD y COP distinguiendo la moneda', () => {
    expect(formatMoney({ amount: 8000, currency: 'USD' }, 'en')).toBe('$80.00');
    const usdEs = formatMoney({ amount: 8000, currency: 'USD' }, 'es');
    expect(usdEs).toContain('80.00');
    expect(usdEs).toMatch(/US/);
    const copEs = formatMoney({ amount: 1500000, currency: 'COP' }, 'es');
    expect(copEs).toContain('COP');
    expect(copEs).toContain('15,000');
    expect(formatMoney({ amount: 1500000, currency: 'COP' }, 'en')).toContain('15,000');
  });

  it('acepta minúsculas y no falla con una moneda desconocida', () => {
    expect(formatMoney({ amount: 8000, currency: 'mxn' }, 'es')).toBe('$80.00');
    expect(formatMoney({ amount: 8000, currency: 'ZZ' }, 'es')).toBe('80.00 ZZ');
  });
});

describe('formatDuration', () => {
  it('produce minutos y segundos compactos en ambos idiomas', () => {
    expect(formatDuration(150, 'es')).toBe('2 min 30 s');
    expect(formatDuration(150, 'en')).toBe('2 min 30 s');
    expect(formatDuration(0, 'es')).toBe('0 s');
    expect(formatDuration(45, 'en')).toBe('45 s');
    expect(formatDuration(60, 'es')).toBe('1 min');
    expect(formatDuration(3600, 'es')).toBe('1 h');
    expect(formatDuration(3725, 'en')).toBe('1 h 2 min 5 s');
  });

  it('redondea y trata valores negativos o no finitos como cero', () => {
    expect(formatDuration(59.6, 'es')).toBe('1 min');
    expect(formatDuration(-5, 'es')).toBe('0 s');
    expect(formatDuration(Number.NaN, 'en')).toBe('0 s');
  });
});

describe('formatDate, formatTime y formatNumber', () => {
  it('formatea fecha corta y larga en la zona pedida', () => {
    expect(formatDate(ISO, 'es', MX)).toBe('09/09/2026');
    expect(formatDate(ISO, 'en', MX, 'short')).toBe('09/09/2026');
    expect(formatDate(ISO, 'es', MX, 'long')).toContain('septiembre');
    expect(formatDate(ISO, 'en', MX, 'long')).toBe('September 9, 2026');
  });

  it('respeta la zona horaria al cruzar la medianoche', () => {
    // 03:30Z del día 10 son las 21:30 del día 9 en Ciudad de México.
    expect(formatDate('2026-09-10T03:30:00Z', 'es', MX)).toBe('09/09/2026');
    expect(formatDate('2026-09-10T03:30:00Z', 'es', 'UTC')).toBe('10/09/2026');
    expect(formatTime('2026-09-10T03:30:00Z', 'en', MX)).toMatch(/9:30/);
  });

  it('formatea la hora con el ciclo horario del idioma', () => {
    expect(formatTime(ISO, 'es', MX)).toMatch(/2:05/);
    expect(formatTime(ISO, 'en', MX)).toMatch(/2:05\s?PM/);
  });

  it('devuelve cadena vacía con marcas inválidas y cae a UTC con zonas inválidas', () => {
    expect(formatDate('no-es-fecha', 'es', MX)).toBe('');
    expect(formatTime('', 'en', MX)).toBe('');
    expect(formatDate(ISO, 'es', 'Zona/Inexistente')).toBe('09/09/2026');
  });

  it('formatea números con separadores del locale', () => {
    expect(formatNumber(1234567.891, 'es')).toBe('1,234,567.891');
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatNumber(0.5, 'en', { style: 'percent' })).toBe('50%');
  });
});

describe('createTranslator', () => {
  it('liga todas las funciones al idioma', () => {
    const tr = createTranslator('en');
    expect(tr.locale).toBe('en');
    expect(tr.t('common.cancelar')).toBe('Cancel');
    expect(tr.t('kiosk.review.retakesRestantes', { count: 2 })).toBe('Retakes left: 2');
    expect(tr.tl({ es: 'Hola', en: 'Hello' })).toBe('Hello');
    expect(tr.formatMoney({ amount: 8000, currency: 'USD' })).toBe('$80.00');
    expect(tr.formatDuration(90)).toBe('1 min 30 s');
    expect(tr.formatNumber(1000)).toBe('1,000');
    expect(tr.formatDate(ISO, MX, 'long')).toBe('September 9, 2026');
    expect(tr.formatTime(ISO, MX)).toMatch(/2:05/);
  });
});

describe('CATALOG', () => {
  it('registra el paquete', () => {
    expect(CATALOG).toHaveLength(1);
    expect(CATALOG[0]).toMatchObject({ kind: 'package', key: '@psp/i18n', package: '@psp/i18n' });
  });
});
