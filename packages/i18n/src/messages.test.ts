import { describe, expect, it } from 'vitest';
import {
  AiJobState,
  EditingTool,
  FeatureKey,
  IncidentStatus,
  MachineReleaseStatus,
  MachineStatus,
  PaymentState,
  PaymentTerminalStatus,
  PrinterStatus,
  ProductCategory,
  ScopeLevel,
  SessionStage,
  TechTestKind,
  UnavailabilityReason,
} from '@psp/contracts';
import { en } from './messages/en';
import { es } from './messages/es';
import { MESSAGE_KEYS, messages, placeholdersOf } from './index';

/** Listas de @psp/vision según docs/arquitectura/01-apis-de-paquetes.md (el paquete es un stub aún). */
const INSTRUCTION_KEYS = [
  'move_left',
  'move_right',
  'move_closer',
  'move_back',
  'chin_up',
  'chin_down',
  'look_front',
  'head_straight',
  'open_eyes',
  'no_smile',
  'remove_glasses',
  'fix_hair',
  'wait_focus',
  'only_one_person',
  'no_face',
  'more_light',
  'less_light',
  'plain_background',
  'hold_still',
  'ok',
];
const CRITERION_KEYS = [
  'face.detected',
  'face.count',
  'face.size',
  'face.vertical',
  'face.horizontal',
  'head.roll',
  'head.yaw',
  'head.pitch',
  'eyes.open',
  'gaze.front',
  'face.obstruction',
  'light.low',
  'light.high',
  'contrast',
  'background.uniform',
  'shadows',
  'sharpness',
  'glasses.glare',
  'expression',
  'framing',
];
/** Fallas simulables de `SimulateFaultRequest` (unión discriminada en @psp/contracts). */
const SIMULATED_FAULTS = [
  'printer_no_paper',
  'printer_jam',
  'printer_ok',
  'camera_off',
  'camera_on',
  'cloud_off',
  'cloud_on',
  'storage_low',
  'storage_ok',
  'payment_device_out',
  'payment_device_ok',
];

const esKeys = Object.keys(es);
const enKeys = Object.keys(en);

describe('catálogos es/en: compuerta de paridad', () => {
  it('en tiene exactamente las mismas claves que es', () => {
    const missingInEn = esKeys.filter((k) => !Object.hasOwn(en, k));
    const extraInEn = enKeys.filter((k) => !Object.hasOwn(es, k));
    expect(missingInEn, 'claves que faltan en en').toEqual([]);
    expect(extraInEn, 'claves sobrantes en en').toEqual([]);
    expect([...enKeys].sort()).toEqual([...esKeys].sort());
  });

  it('ningún texto está vacío ni tiene espacios sobrantes', () => {
    for (const [locale, catalog] of Object.entries(messages)) {
      for (const [key, value] of Object.entries(catalog)) {
        expect(value.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
        expect(value, `${locale}:${key}`).toBe(value.trim());
      }
    }
  });

  it('cada clave usa los mismos parámetros en ambos idiomas', () => {
    for (const key of esKeys) {
      const inEs = [...placeholdersOf(es[key as keyof typeof es])].sort();
      const inEn = [...placeholdersOf(en[key as keyof typeof en])].sort();
      expect(inEn, key).toEqual(inEs);
    }
  });

  it('las claves son planas, con puntos y sin espacios ni duplicados', () => {
    const shape = /^[a-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
    for (const key of esKeys) expect(key, key).toMatch(shape);
    expect(new Set(esKeys).size).toBe(esKeys.length);
  });

  it('cubre los espacios de nombres que el kiosco y admin necesitan', () => {
    const namespaces = [
      'common.',
      'kiosk.attract.',
      'kiosk.home.',
      'kiosk.product.',
      'kiosk.consent.',
      'kiosk.payment.',
      'kiosk.capture.',
      'instructions.',
      'criteria.',
      'kiosk.review.',
      'kiosk.edit.',
      'kiosk.select.',
      'kiosk.compose.',
      'kiosk.print.',
      'kiosk.finish.',
      'kiosk.errors.',
      'kiosk.timeout.',
      'kiosk.ai.',
      'kiosk.tech.',
      'stages.',
      'features.',
      'admin.nav.',
      'admin.common.',
      'admin.status.',
      'admin.release.',
      'admin.incident.',
      'admin.dashboard.',
    ];
    for (const ns of namespaces) {
      expect(esKeys.some((k) => k.startsWith(ns)), ns).toBe(true);
    }
    expect(MESSAGE_KEYS.length).toBeGreaterThanOrEqual(400);
    expect(MESSAGE_KEYS).toEqual(esKeys);
  });

  it('messages expone los dos idiomas', () => {
    expect(Object.keys(messages).sort()).toEqual(['en', 'es']);
    expect(messages.es).toBe(es);
    expect(messages.en).toBe(en);
  });
});

describe('cobertura de listas cerradas', () => {
  const cases: Array<[prefix: string, values: readonly string[]]> = [
    ['kiosk.home.categorias', ProductCategory.options],
    ['kiosk.product.motivo', UnavailabilityReason.options],
    ['kiosk.payment.estado', PaymentState.options],
    ['kiosk.payment.terminal', PaymentTerminalStatus.options],
    ['kiosk.edit.herramientas', EditingTool.options],
    ['kiosk.ai.estado', AiJobState.options],
    ['kiosk.tech.prueba', TechTestKind.options],
    ['kiosk.tech.falla', SIMULATED_FAULTS],
    ['kiosk.tech.impresora', PrinterStatus.options],
    ['instructions', INSTRUCTION_KEYS],
    ['criteria', CRITERION_KEYS],
    ['stages', SessionStage.options],
    ['features', FeatureKey.options],
    ['admin.common.nivel', ScopeLevel.options],
    ['admin.status', MachineStatus.options],
    ['admin.release', MachineReleaseStatus.options],
    ['admin.incident', IncidentStatus.options],
  ];

  for (const [prefix, values] of cases) {
    it(`${prefix}.* tiene un texto por cada valor (${values.length})`, () => {
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        expect(Object.hasOwn(es, `${prefix}.${value}`), `${prefix}.${value}`).toBe(true);
      }
    });
  }

  it('las 11 preguntas del tablero (requisito 20) tienen etiqueta', () => {
    const questions = [
      'activeMachines',
      'offlineMachines',
      'machinesWithWarnings',
      'needAttention',
      'sessionsToday',
      'topProducts',
      'topLocations',
      'machinesWithoutSessions',
      'consumablesAttention',
      'pendingRollouts',
      'openIncidents',
    ];
    for (const q of questions) expect(Object.hasOwn(es, `admin.dashboard.${q}`), q).toBe(true);
  });

  it('las instrucciones de corrección son frases humanas, sin claves técnicas', () => {
    for (const key of INSTRUCTION_KEYS) {
      const text = es[`instructions.${key}` as keyof typeof es];
      expect(text, key).not.toMatch(/[_{}]/);
      expect(text, key).toMatch(/[.!]$/);
    }
  });
});
