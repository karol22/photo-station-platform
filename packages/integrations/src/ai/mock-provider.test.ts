import { AiExperienceKey as AiExperienceKeySchema, AiJob as AiJobSchema } from '@psp/contracts';
import type { AiJobState, ConsentRecord } from '@psp/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvalidTransitionError, ValidationError } from '../errors';
import { manualClock, sequentialIdFactory } from '../support';
import { ExternalAiProviderStub } from './external-stub';
import { createAiProvider } from './factory';
import { AI_JOB_STATE_MESSAGES } from './messages';
import { DEFAULT_MOCK_AI_CAPABILITIES, MockAiProvider, type MockAiProviderOptions } from './mock-provider';
import { consentAllowsExternalAi } from './port';

const START = '2026-09-09T08:00:00.000Z';
const CONSENT_OK: ConsentRecord = { kind: 'external_future', given: true, at: START, textVersion: 'v1' };
const IMAGE = new Uint8Array([1, 2, 3]);
const INPUT = { sessionId: 'ses_1', captureId: 'cap_1', experience: 'stylize' as const, image: IMAGE, consent: CONSENT_OK };

function setup(opts: Partial<MockAiProviderOptions> = {}) {
  const clock = manualClock(START);
  const transform = vi.fn(async (image: Uint8Array, experience: string) => new Uint8Array([...image, experience.length]));
  const provider = new MockAiProvider({ clock, idFactory: sequentialIdFactory('ai_'), transform, ...opts });
  const seen: AiJobState[] = [];
  provider.onUpdate((job) => seen.push(job.state));
  return { clock, transform, provider, seen };
}

describe('consentAllowsExternalAi', () => {
  it('exige external_future otorgado', () => {
    expect(consentAllowsExternalAi(CONSENT_OK)).toBe(true);
    expect(consentAllowsExternalAi({ ...CONSENT_OK, given: false })).toBe(false);
    expect(consentAllowsExternalAi({ ...CONSENT_OK, kind: 'service' })).toBe(false);
    expect(consentAllowsExternalAi(undefined)).toBe(false);
  });
});

describe('MockAiProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin consentimiento → consent_required y no transforma', async () => {
    const { provider, transform, seen } = setup();
    const denied = await provider.submit({ ...INPUT, consent: { ...CONSENT_OK, given: false } });
    expect(denied.state).toBe('consent_required');
    expect(denied.message).toEqual(AI_JOB_STATE_MESSAGES.consent_required);
    const wrongKind = await provider.submit({ ...INPUT, consent: { ...CONSENT_OK, kind: 'service' } });
    expect(wrongKind.state).toBe('consent_required');
    const malformed = await provider.submit({ ...INPUT, consent: { given: true } as unknown as ConsentRecord });
    expect(malformed.state).toBe('consent_required');
    expect(malformed.consent).toBeUndefined();
    await provider.tick();
    expect(transform).not.toHaveBeenCalled();
    expect(seen).toEqual(['consent_required', 'consent_required', 'consent_required']);
    expect(AiJobSchema.safeParse(denied).success).toBe(true);
  });

  it('con consentimiento → processing → ready en tick, con transform llamada', async () => {
    const { provider, transform, seen, clock } = setup();
    const job = await provider.submit(INPUT);
    expect(job).toMatchObject({ id: 'ai_000001', state: 'processing', provider: 'mock', consent: CONSENT_OK, createdAt: START });
    expect(AiJobSchema.safeParse(job).success).toBe(true);
    expect(transform).not.toHaveBeenCalled();
    clock.advance(2000);
    const changed = await provider.tick();
    expect(changed.map((j) => j.state)).toEqual(['ready']);
    const ready = provider.get(job.id);
    expect(ready).toMatchObject({ state: 'ready', resultUrl: 'mock://ai_000001', updatedAt: '2026-09-09T08:00:02.000Z' });
    expect(ready?.message).toEqual(AI_JOB_STATE_MESSAGES.ready);
    expect(transform).toHaveBeenCalledTimes(1);
    expect(transform).toHaveBeenCalledWith(IMAGE, 'stylize');
    expect(provider.getResult(job.id)).toEqual(new Uint8Array([1, 2, 3, 7]));
    expect(seen).toEqual(['processing', 'ready']);
    expect(await provider.tick()).toEqual([]);
    expect(AiJobSchema.safeParse(ready).success).toBe(true);
  });

  it('onResult define resultUrl a partir del resultado', async () => {
    const onResult = vi.fn(async (job: { id: string }, output: Uint8Array) => `var/ai/${job.id}-${output.length}.png`);
    const { provider } = setup({ onResult });
    const job = await provider.submit(INPUT);
    await provider.tick();
    expect(provider.get(job.id)?.resultUrl).toBe('var/ai/ai_000001-4.png');
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('failEvery marca el n-ésimo job en error', async () => {
    const { provider, seen } = setup({ failEvery: 2 });
    const jobs = await Promise.all([1, 2, 3].map((i) => provider.submit({ ...INPUT, captureId: `cap_${i}` })));
    await provider.tick();
    expect(jobs.map((j) => provider.get(j.id)?.state)).toEqual(['ready', 'error', 'ready']);
    expect(provider.get(jobs[1]!.id)?.message).toEqual(AI_JOB_STATE_MESSAGES.error);
    expect(provider.failureReason(jobs[1]!.id)).toContain('every 2');
    expect(provider.failureReason(jobs[0]!.id)).toBeUndefined();
    expect(seen).toEqual(['processing', 'processing', 'processing', 'ready', 'error', 'ready']);
  });

  it('una transformación que lanza deja el job en error con la razón', async () => {
    const { provider, transform } = setup();
    transform.mockRejectedValueOnce(new Error('boom'));
    const job = await provider.submit(INPUT);
    await provider.tick();
    expect(provider.get(job.id)?.state).toBe('error');
    expect(provider.failureReason(job.id)).toBe('boom');
    expect(provider.getResult(job.id)).toBeUndefined();
  });

  it('retry tras error vuelve a procesar', async () => {
    const { provider, transform, seen } = setup();
    transform.mockRejectedValueOnce(new Error('boom'));
    const job = await provider.submit(INPUT);
    await provider.tick();
    const retried = await provider.retry(job.id);
    expect(retried.state).toBe('processing');
    await provider.tick();
    expect(provider.get(job.id)?.state).toBe('ready');
    expect(seen).toEqual(['processing', 'error', 'retry', 'processing', 'ready']);
    await expect(provider.retry(job.id)).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('rejected cuando la experiencia no está en capabilities', async () => {
    const { provider, transform } = setup();
    expect(provider.capabilities()).toEqual([...DEFAULT_MOCK_AI_CAPABILITIES]);
    expect(provider.capabilities()).not.toContain('short_video');
    const video = await provider.submit({ ...INPUT, experience: 'short_video' });
    expect(video.state).toBe('rejected');
    const narrow = setup({ capabilities: ['anime'] }).provider;
    expect((await narrow.submit(INPUT)).state).toBe('rejected');
    expect((await narrow.submit({ ...INPUT, experience: 'anime' })).state).toBe('processing');
    await provider.tick();
    expect(transform).not.toHaveBeenCalled();
  });

  it('delayMs procesa con timers (falsos en la prueba)', async () => {
    vi.useFakeTimers();
    const { provider } = setup({ delayMs: 300 });
    const job = await provider.submit(INPUT);
    await vi.advanceTimersByTimeAsync(299);
    expect(provider.get(job.id)?.state).toBe('processing');
    await vi.advanceTimersByTimeAsync(1);
    expect(provider.get(job.id)?.state).toBe('ready');
    provider.dispose();
  });

  it('tick con delayMs respeta el reloj inyectado', async () => {
    const { provider, clock } = setup({ delayMs: 300 });
    const job = await provider.submit(INPUT);
    clock.advance(299);
    expect(await provider.tick()).toEqual([]);
    clock.advance(1);
    expect((await provider.tick()).map((j) => j.state)).toEqual(['ready']);
    expect(provider.get(job.id)?.state).toBe('ready');
    provider.dispose();
  });

  it('dispose limpia timers y bloquea envíos nuevos', async () => {
    vi.useFakeTimers();
    const { provider, transform } = setup({ delayMs: 100 });
    const job = await provider.submit(INPUT);
    provider.dispose();
    await vi.advanceTimersByTimeAsync(200);
    expect(provider.get(job.id)?.state).toBe('processing');
    expect(transform).not.toHaveBeenCalled();
    await expect(provider.submit(INPUT)).rejects.toMatchObject({ code: 'disposed' });
    expect(provider.list()).toHaveLength(1);
  });
});

describe('ExternalAiProviderStub', () => {
  it('todo job nace en coming_soon y anuncia todas las experiencias', async () => {
    const provider = new ExternalAiProviderStub({ clock: manualClock(START), idFactory: sequentialIdFactory('ai_') });
    const seen: AiJobState[] = [];
    provider.onUpdate((job) => seen.push(job.state));
    const job = await provider.submit(INPUT);
    expect(job).toMatchObject({ id: 'ai_000001', state: 'coming_soon', provider: 'external', message: AI_JOB_STATE_MESSAGES.coming_soon });
    expect(AiJobSchema.safeParse(job).success).toBe(true);
    expect(provider.get(job.id)).toEqual(job);
    expect(provider.capabilities()).toEqual([...AiExperienceKeySchema.options]);
    expect(seen).toEqual(['coming_soon']);
    const named = new ExternalAiProviderStub({ clock: manualClock(START), idFactory: sequentialIdFactory('ai_'), provider: 'vendor-x' });
    expect(named.provider).toBe('vendor-x');
  });
});

describe('createAiProvider', () => {
  const deps = { clock: manualClock(START), idFactory: sequentialIdFactory('ai_') };

  it('mock sin transform usa la identidad', async () => {
    const provider = createAiProvider('mock', deps);
    expect(provider).toBeInstanceOf(MockAiProvider);
    const job = await provider.submit(INPUT);
    await (provider as MockAiProvider).tick();
    expect(provider.get(job.id)?.state).toBe('ready');
    expect((provider as MockAiProvider).getResult(job.id)).toEqual(IMAGE);
  });

  it('external y adaptador desconocido', () => {
    expect(createAiProvider('external', deps)).toBeInstanceOf(ExternalAiProviderStub);
    expect(() => createAiProvider('openai' as never, deps)).toThrow(ValidationError);
  });
});
