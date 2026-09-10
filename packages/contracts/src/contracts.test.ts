import { describe, expect, it } from 'vitest';
import {
  CONFIG_KEYS,
  CONFIG_KEY_INDEX,
  DOCUMENT_SAFE_TOOLS,
  EditingTool,
  FEATURE_DEFINITIONS,
  FeatureKey,
  FleetCommand,
  HeartbeatRequest,
  LocalizedText,
  Money,
  Product,
  SessionRecord,
} from './index';

describe('contratos: listas cerradas', () => {
  it('cada FeatureKey tiene definición y viceversa', () => {
    const defined = new Set(FEATURE_DEFINITIONS.map((f) => f.key));
    for (const key of FeatureKey.options) expect(defined.has(key), key).toBe(true);
    expect(defined.size).toBe(FeatureKey.options.length);
  });

  it('las claves de configuración son únicas y tienen default', () => {
    const keys = CONFIG_KEYS.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of CONFIG_KEYS) expect(k.default !== undefined, k.key).toBe(true);
    expect(CONFIG_KEY_INDEX['timing.idleTimeoutSec']?.type).toBe('number');
  });

  it('las herramientas seguras para documentos son herramientas válidas', () => {
    for (const t of DOCUMENT_SAFE_TOOLS) expect(EditingTool.options).toContain(t);
    expect(DOCUMENT_SAFE_TOOLS).not.toContain('stickers');
  });
});

describe('contratos: validación', () => {
  it('Money exige enteros', () => {
    expect(Money.safeParse({ amount: 1050, currency: 'MXN' }).success).toBe(true);
    expect(Money.safeParse({ amount: 10.5, currency: 'MXN' }).success).toBe(false);
  });

  it('LocalizedText exige español', () => {
    expect(LocalizedText.safeParse({ en: 'x' }).success).toBe(false);
    expect(LocalizedText.safeParse({ es: 'x' }).success).toBe(true);
  });

  it('FleetCommand discrimina por tipo', () => {
    const cmd = FleetCommand.parse({ id: 'cmd_1', issuedAt: '2026-09-09T08:00:00Z', type: 'set_maintenance', on: true });
    expect(cmd.type).toBe('set_maintenance');
    expect(FleetCommand.safeParse({ id: 'cmd_2', issuedAt: '2026-09-09T08:00:00Z', type: 'nope' }).success).toBe(false);
  });

  it('HeartbeatRequest rechaza estados desconocidos', () => {
    const base = {
      machineId: 'mch_1',
      at: '2026-09-09T08:00:00Z',
      localTime: '03:00',
      timezone: 'America/Mexico_City',
      softwareVersion: '0.1.0',
      status: 'active',
      capabilities: [],
      printers: [],
      health: { diskFreeMb: 1000, storagePct: 10, uptimeSec: 5 },
      release: { currentVersion: '0.1.0', status: 'up_to_date' },
    };
    expect(HeartbeatRequest.safeParse(base).success).toBe(true);
    expect(HeartbeatRequest.safeParse({ ...base, status: 'exploded' }).success).toBe(false);
  });

  it('Product aplica defaults', () => {
    const p = Product.parse({
      id: 'prd_1',
      organizationId: 'org_1',
      internalName: 'doc-basic',
      displayName: { es: 'Foto documento' },
      category: 'documents',
      kind: 'document',
      description: { es: 'd' },
      whatYouGet: { es: 'w' },
      estimatedDurationSec: 120,
      captureCount: 1,
      printCount: 1,
      output: { templateId: 'tpl_1', paperSize: '4x6in', copies: 1 },
      editing: { enabled: true, allowedTools: ['crop'] },
      retakes: { max: 3 },
      basePrice: { amount: 8000, currency: 'MXN' },
      createdAt: '2026-09-09T08:00:00Z',
    });
    expect(p.status).toBe('draft');
    expect(p.retakes.perPhoto).toBe(true);
    expect(p.hardwareRequirements).toEqual([]);
  });

  it('SessionRecord no acepta fotografías', () => {
    const rec = SessionRecord.safeParse({
      id: 'ses_1',
      code: 'A1B2',
      machineId: 'mch_1',
      organizationId: 'org_1',
      startedAt: '2026-09-09T08:00:00Z',
      stage: 'done',
      productId: 'prd_1',
      productName: 'x',
      productKind: 'document',
      commercial: { state: 'demo', paymentState: 'demo' },
      softwareVersion: '0.1.0',
      bundleVersion: 'abc',
      retention: { policyId: 'ret_1', mode: 'none' },
      locale: 'es',
      photoBase64: 'data:...',
    });
    expect(rec.success).toBe(true);
    // Zod elimina claves desconocidas: el registro nunca transporta la foto.
    expect(rec.success && 'photoBase64' in rec.data).toBe(false);
  });
});
