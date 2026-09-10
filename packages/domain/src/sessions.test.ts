import { SessionRecord, SessionStage, TERMINAL_STAGES, type RetentionPolicy } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETENTION_POLICY,
  InvalidTransitionError,
  SESSION_TRANSITIONS,
  canReleaseTransition,
  bestCaptures,
  canTransition,
  idleExpiryAction,
  commercialStateFor,
  computeTimers,
  nextReleaseStatus,
  resolveRetentionPolicy,
  retentionDeadline,
  sessionRecordFrom,
  stagesForProduct,
} from './sessions';
import { demoHierarchy, product, stationSession } from './__tests__/fixtures';

describe('SESSION_TRANSITIONS / canTransition', () => {
  it('cubre todas las etapas y las terminales no salen a ninguna parte', () => {
    expect(Object.keys(SESSION_TRANSITIONS).sort()).toEqual([...SessionStage.options].sort());
    for (const stage of TERMINAL_STAGES) expect(SESSION_TRANSITIONS[stage]).toEqual([]);
    for (const stage of SessionStage.options) {
      if (TERMINAL_STAGES.includes(stage)) continue;
      for (const abort of ['cancelled', 'failed', 'expired', 'abandoned'] as const) expect(canTransition(stage, abort), `${stage}→${abort}`).toBe(true);
    }
  });

  it('acepta el recorrido documental completo y rechaza saltos inválidos', () => {
    const journey = stagesForProduct(product('prd_doc'), { paymentRequired: true, consentRequired: true });
    for (let i = 0; i + 1 < journey.length; i++) expect(canTransition(journey[i]!, journey[i + 1]!), `${journey[i]}→${journey[i + 1]}`).toBe(true);
    expect(canTransition('reviewing', 'capturing')).toBe(true); // retake
    expect(canTransition('selecting', 'capturing')).toBe(true);
    expect(canTransition('editing', 'reviewing')).toBe(true);
    expect(canTransition('reviewing', 'editing')).toBe(true);
    expect(canTransition('capturing', 'printing')).toBe(false);
    expect(canTransition('started', 'capturing')).toBe(false);
    expect(canTransition('done', 'started')).toBe(false);
    expect(canTransition('cancelled', 'done')).toBe(false);
    expect(canTransition('printing', 'capturing')).toBe(false);
    expect(canTransition('capturing', 'capturing')).toBe(false);
  });
});

describe('stagesForProduct', () => {
  it('adapta el recorrido al producto y a las opciones', () => {
    expect(stagesForProduct(product('prd_doc'), { paymentRequired: true, consentRequired: false })).toEqual([
      'started', 'product_selected', 'configuring', 'awaiting_payment', 'capturing', 'reviewing', 'editing', 'composing', 'confirming', 'printing', 'delivering', 'finishing', 'done',
    ]);
    // Documento con 4 copias sigue sin selección; el consentimiento sólo si se requiere.
    expect(stagesForProduct(product('prd_doc', { captureCount: 2 }), { paymentRequired: false, consentRequired: true })).not.toContain('selecting');
    expect(stagesForProduct(product('prd_doc'), { paymentRequired: false, consentRequired: true })).toContain('consent');
    expect(stagesForProduct(product('prd_doc'), { paymentRequired: false, consentRequired: false })).not.toContain('awaiting_payment');
    const strip = product('prd_strip', { kind: 'entertainment', category: 'photo_strip', captureCount: 4 });
    expect(stagesForProduct(strip, { paymentRequired: true, consentRequired: false })).toContain('selecting');
    const single = product('prd_single', { kind: 'entertainment', category: 'fun', captureCount: 1 });
    expect(stagesForProduct(single, { paymentRequired: true, consentRequired: false })).not.toContain('selecting');
    const digital = product('prd_digital', { printCount: 0, editing: { enabled: false, allowedTools: [] } });
    const stages = stagesForProduct(digital, { paymentRequired: false, consentRequired: false });
    expect(stages).not.toContain('printing');
    expect(stages).not.toContain('editing');
    expect(stages[0]).toBe('started');
    expect(stages[stages.length - 1]).toBe('done');
  });
});

describe('computeTimers', () => {
  it('lee el efectivo, aplica overrides del producto y el multiplicador accesible', () => {
    const values = { 'timing.idleTimeoutSec': 45, 'timing.reviewTimeoutSec': 120, 'payment.timeoutSec': 60, 'kiosk.accessibleTimeoutMultiplier': 2, 'timing.captureCountdownSec': 'no-es-número' };
    const prd = product('prd_doc', { timing: { reviewTimeoutSec: 200, autoCaptureStabilityMs: 800 } });
    expect(computeTimers(values, prd, false)).toEqual({
      idleTimeoutSec: 45,
      warningBeforeCancelSec: 15,
      captureCountdownSec: 3,
      prepareBeforeCaptureSec: 2,
      reviewTimeoutSec: 200,
      autoCaptureStabilityMs: 800,
      paymentTimeoutSec: 60,
    });
    expect(computeTimers(values, prd, true)).toEqual({
      idleTimeoutSec: 90,
      warningBeforeCancelSec: 15,
      captureCountdownSec: 6,
      prepareBeforeCaptureSec: 4,
      reviewTimeoutSec: 400,
      autoCaptureStabilityMs: 800,
      paymentTimeoutSec: 120,
    });
    // Sin valores: defaults del registro (multiplicador 1.5, redondeo hacia arriba).
    expect(computeTimers({}, product('prd_doc'), true).idleTimeoutSec).toBe(90);
    expect(computeTimers({}, product('prd_doc'), true).captureCountdownSec).toBe(5);
  });
});

describe('retención', () => {
  const temp: RetentionPolicy = { id: 'ret_temp', name: { es: 'Temporal' }, mode: 'temporary', durationMinutes: 30, deleteIncomplete: true, appliesToKinds: [], customerText: { es: '30 min' }, leavesDevice: false };
  const docs: RetentionPolicy = { ...temp, id: 'ret_docs', mode: 'none', appliesToKinds: ['document'] };
  const period: RetentionPolicy = { ...temp, id: 'ret_period', mode: 'period', durationMinutes: 60 * 24 * 7 };

  it('resuelve la política: producto → tipo → efectivo → primera → respaldo', () => {
    const policies = [temp, docs, period];
    expect(resolveRetentionPolicy(policies, product('prd_doc', { retentionPolicyId: 'ret_period' }), {}).id).toBe('ret_period');
    expect(resolveRetentionPolicy(policies, product('prd_doc'), {}).id).toBe('ret_docs');
    expect(resolveRetentionPolicy(policies, product('prd_strip', { kind: 'entertainment' }), { 'privacy.defaultRetentionPolicyId': 'ret_period' }).id).toBe('ret_period');
    expect(resolveRetentionPolicy(policies, product('prd_strip', { kind: 'entertainment' }), {}).id).toBe('ret_temp');
    expect(resolveRetentionPolicy([temp], product('prd_doc', { retentionPolicyId: 'ret_inexistente' }), {}).id).toBe('ret_temp');
    expect(resolveRetentionPolicy([], product('prd_doc'), {})).toBe(DEFAULT_RETENTION_POLICY);
  });

  it('calcula el plazo de eliminación por modo', () => {
    const ended = new Date('2026-09-08T23:04:30Z');
    expect(retentionDeadline(temp, ended)?.toISOString()).toBe('2026-09-08T23:34:30.000Z');
    expect(retentionDeadline(docs, ended)?.toISOString()).toBe('2026-09-08T23:04:30.000Z');
    expect(retentionDeadline(period, ended)?.toISOString()).toBe('2026-09-15T23:04:30.000Z');
    expect(retentionDeadline({ ...period, durationMinutes: undefined }, ended)).toBeUndefined();
    expect(retentionDeadline({ ...temp, mode: 'metadata_only' }, ended)?.getTime()).toBe(ended.getTime());
    expect(retentionDeadline({ ...temp, mode: 'derivatives_only', durationMinutes: undefined }, ended)).toBeUndefined();
  });
});

describe('commercialStateFor', () => {
  it('mapea modo de negocio y estado de pago', () => {
    const paid = (paymentState: Parameters<typeof commercialStateFor>[0]['paymentState'], promotionIds: string[] = []) =>
      commercialStateFor({ businessMode: 'paid', paymentState, isDemo: false, promotionIds });
    expect(paid('approved')).toBe('paid_simulated');
    expect(paid('approved', ['pr_1'])).toBe('promotion');
    expect(paid('free', ['pr_1'])).toBe('promotion');
    expect(paid('not_required')).toBe('free');
    expect(paid('declined')).toBe('failed');
    expect(paid('device_out_of_service')).toBe('failed');
    expect(paid('cancelled')).toBe('voided');
    expect(paid('awaiting')).toBe('voided');
    expect(paid('operator_started')).toBe('courtesy');
    expect(commercialStateFor({ businessMode: 'paid', paymentState: 'approved', isDemo: true, promotionIds: [] })).toBe('demo');
    expect(commercialStateFor({ businessMode: 'demo', paymentState: 'not_required', isDemo: false, promotionIds: [] })).toBe('demo');
    expect(commercialStateFor({ businessMode: 'courtesy', paymentState: 'free', isDemo: false, promotionIds: [] })).toBe('courtesy');
    expect(commercialStateFor({ businessMode: 'promotional', paymentState: 'free', isDemo: false, promotionIds: [] })).toBe('promotion');
    expect(commercialStateFor({ businessMode: 'free_sponsored', paymentState: 'free', isDemo: false, promotionIds: [] })).toBe('free');
    expect(commercialStateFor({ businessMode: 'internal', paymentState: 'not_required', isDemo: false, promotionIds: [] })).toBe('free');
  });
});

describe('sessionRecordFrom', () => {
  const index = demoHierarchy();
  const mch = index.machines.get('mch_n1')!;

  it('produce un registro válido con metadatos y sin fotografías', () => {
    const session = stationSession();
    const record = sessionRecordFrom(session, { machine: mch, softwareVersion: '0.1.0', retentionMode: 'temporary' });
    expect(SessionRecord.safeParse(record).success).toBe(true);
    expect(record).toMatchObject({
      id: 'ses_1',
      code: 'AB3D7K',
      machineId: 'mch_n1',
      locationId: 'loc_norte_1',
      organizationId: 'org_lumina',
      franchiseId: 'fr_norte',
      stage: 'done',
      result: 'completed',
      productId: 'prd_doc',
      productKind: 'document',
      presetId: 'pst_uni',
      presetVersion: 3,
      templateId: 'tpl_doc',
      templateVersion: 2,
      captures: 2,
      retakes: 1,
      printsRequested: 4,
      printsCompleted: 2,
      durationSec: 270,
      softwareVersion: '0.1.0',
      bundleVersion: 'bundle_abc',
      retention: { policyId: 'ret_temp', mode: 'temporary', deleteAt: '2026-09-08T23:34:30Z' },
      editingUsed: true,
      editingTools: ['brightness'],
      locale: 'es',
    });
    expect(record.errors).toHaveLength(1);
    expect(record.consents).toHaveLength(1);
    const json = JSON.stringify(record);
    expect(json).not.toContain('file://');
    expect(json).not.toContain('/var/');
    expect(json).not.toMatch(/"(url|editedUrl|outputPath|composition|selection|edits|payment|resultUrl)"/);
    expect(record).not.toHaveProperty('captures.0');
  });

  it('usa el contexto para fin, resultado y etapa de abandono', () => {
    const session = stationSession({ stage: 'editing', endedAt: undefined, printJobs: [], edits: {}, editingToolsUsed: [] });
    const record = sessionRecordFrom(session, { machine: mch, softwareVersion: '0.1.0', endedAt: new Date('2026-09-08T23:10:00Z'), result: 'abandoned', recoveredFrom: 'app_restart' });
    expect(record).toMatchObject({ result: 'abandoned', abandonedAtStage: 'editing', durationSec: 600, endedAt: '2026-09-08T23:10:00.000Z', recoveredFrom: 'app_restart', printsRequested: 0, editingUsed: false, retention: { mode: 'temporary' } });
    const open = sessionRecordFrom(stationSession({ stage: 'capturing', endedAt: undefined }), { machine: mch, softwareVersion: '0.1.0' });
    expect(open.result).toBeUndefined();
    expect(open.durationSec).toBeUndefined();
    expect(open.endedAt).toBeUndefined();
  });
});

describe('nextReleaseStatus', () => {
  it('recorre el ciclo completo y rechaza transiciones inválidas', () => {
    let status = nextReleaseStatus('up_to_date', 'assign');
    expect(status).toBe('pending');
    status = nextReleaseStatus(status, 'download');
    expect(status).toBe('downloading');
    status = nextReleaseStatus(status, 'ready');
    expect(status).toBe('ready');
    expect(nextReleaseStatus(status, 'pause')).toBe('paused');
    expect(nextReleaseStatus('paused', 'resume')).toBe('pending');
    status = nextReleaseStatus(status, 'install');
    expect(status).toBe('installing');
    expect(nextReleaseStatus(status, 'complete')).toBe('completed');
    expect(nextReleaseStatus(status, 'fail')).toBe('failed');
    expect(nextReleaseStatus('failed', 'rollback')).toBe('rolled_back');
    expect(nextReleaseStatus('completed', 'rollback')).toBe('rolled_back');
    expect(nextReleaseStatus('rolled_back', 'assign')).toBe('pending');
    expect(() => nextReleaseStatus('installing', 'pause')).toThrow(InvalidTransitionError);
    expect(() => nextReleaseStatus('pending', 'complete')).toThrow(/invalid transition/);
    expect(canReleaseTransition('pending', 'complete')).toBe(false);
    expect(canReleaseTransition('ready', 'install')).toBe(true);
  });
});

describe('idleExpiryAction', () => {
  it('cancela cuando no hay pago ni capturas', () => {
    expect(idleExpiryAction({ stage: 'awaiting_payment', payment: { state: 'awaiting' }, captures: [] })).toBe('cancel');
  });

  it('cancela cuando la sesión ni siquiera llegó al pago', () => {
    expect(idleExpiryAction({ stage: 'product_selected' })).toBe('cancel');
  });

  it('avanza sola cuando el pago quedó aprobado', () => {
    expect(idleExpiryAction({ stage: 'capturing', payment: { state: 'approved' }, captures: [] })).toBe('auto_advance');
  });

  it('avanza sola cuando el pago quedó en revisión, porque el dinero ya salió', () => {
    expect(idleExpiryAction({ stage: 'editing', payment: { state: 'under_review' }, captures: [] })).toBe('auto_advance');
  });

  it('avanza sola cuando hay capturas aunque la sesión sea gratuita', () => {
    expect(idleExpiryAction({ stage: 'editing', payment: { state: 'free' }, captures: [{}, {}] })).toBe('auto_advance');
  });

  it('cancela una sesión gratuita que todavía no tiene ninguna foto', () => {
    expect(idleExpiryAction({ stage: 'capturing', payment: { state: 'free' }, captures: [] })).toBe('cancel');
  });

  it('cancela en etapa terminal aunque haya pago y capturas', () => {
    expect(idleExpiryAction({ stage: 'done', payment: { state: 'approved' }, captures: [{}] })).toBe('cancel');
  });
});

describe('bestCaptures', () => {
  const capture = (id: string, index: number, over: Partial<{ faces: number; passed: string[]; warnings: string[]; blocked: string[]; sharpness: number; brightness: number }> = {}) => ({
    id,
    index,
    analysis: { faces: 1, passed: [], warnings: [], blocked: [], sharpness: 0.5, brightness: 0.55, ...over },
  });

  it('devuelve las mejores en orden cronológico, no por puntaje', () => {
    const captures = [
      capture('c0', 0, { sharpness: 0.1, brightness: 0.1 }),
      capture('c1', 1, { sharpness: 0.9 }),
      capture('c2', 2, { sharpness: 0.2, faces: 0 }),
      capture('c3', 3, { sharpness: 0.8 }),
    ];
    expect(bestCaptures(captures, 2)).toEqual(['c1', 'c3']);
  });

  it('descarta las bloqueadas antes que las que sólo tienen avisos', () => {
    const captures = [
      capture('bloqueada', 0, { blocked: ['face_too_small'] }),
      capture('avisada', 1, { warnings: ['off_center'] }),
    ];
    expect(bestCaptures(captures, 1)).toEqual(['avisada']);
  });

  it('prefiere una foto con rostro sobre una vacía aunque sea más nítida', () => {
    const captures = [capture('vacia', 0, { faces: 0, sharpness: 1 }), capture('conRostro', 1, { faces: 1, sharpness: 0.3 })];
    expect(bestCaptures(captures, 1)).toEqual(['conRostro']);
  });

  it('castiga tanto la foto quemada como la oscura', () => {
    const captures = [capture('quemada', 0, { brightness: 1 }), capture('justa', 1, { brightness: 0.55 }), capture('oscura', 2, { brightness: 0 })];
    expect(bestCaptures(captures, 1)).toEqual(['justa']);
  });

  it('con menos capturas que huecos devuelve todas', () => {
    expect(bestCaptures([capture('a', 0), capture('b', 1)], 4)).toEqual(['a', 'b']);
  });

  it('con cero huecos no devuelve nada', () => {
    expect(bestCaptures([capture('a', 0)], 0)).toEqual([]);
  });

  it('una captura sin análisis no rompe el orden', () => {
    const sin = { id: 'sin', index: 0, analysis: undefined };
    expect(bestCaptures([sin, capture('con', 1)], 1)).toEqual(['con']);
  });

  it('es determinista: dos llamadas dan el mismo resultado', () => {
    const captures = [capture('a', 0), capture('b', 1), capture('c', 2)];
    expect(bestCaptures(captures, 2)).toEqual(bestCaptures(captures, 2));
  });
});

describe('orden del recorrido creativo', () => {
  it('elegir va antes que editar, para no editar fotos que se van a descartar', () => {
    const strip = product('prd_tira', { captureCount: 6, kind: 'entertainment', category: 'photo_strip', editing: { enabled: true, allowedTools: ['brightness'] } });
    const stages = stagesForProduct(strip, { paymentRequired: true, consentRequired: false });
    expect(stages.indexOf('selecting')).toBeLessThan(stages.indexOf('editing'));
  });
});
