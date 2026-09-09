import type { AiExperienceKey, AiJob, AiJobState, Id } from '@psp/contracts';
import { ConsentRecord as ConsentRecordSchema } from '@psp/contracts';
import { IntegrationError, InvalidTransitionError, NotFoundError } from '../errors';
import type { Clock, IdFactory, IntegrationDeps } from '../support';
import { toTimestamp } from '../support';
import { aiJobMessage } from './messages';
import { ALL_AI_EXPERIENCES, consentAllowsExternalAi, type AiProvider, type AiSubmitInput, type AiTransform } from './port';

export interface MockAiProviderOptions extends IntegrationDeps {
  /** Con valor, el job se procesa tras `delayMs` con `setTimeout`; sin valor, sólo en `tick()`. */
  delayMs?: number;
  transform: AiTransform;
  /** Cada n-ésimo job procesado termina en `error` (simula fallas del proveedor). */
  failEvery?: number;
  /** Persiste el resultado y devuelve su referencia (`resultUrl`). Sin él, `mock://<jobId>`. */
  onResult?: (job: AiJob, output: Uint8Array) => string | Promise<string>;
  /** Experiencias que este mock acepta. Por defecto, todas las de imagen fija. */
  capabilities?: AiExperienceKey[];
}

type Listener = (job: AiJob) => void;
type TimerHandle = ReturnType<typeof setTimeout>;

/** El mock produce imágenes fijas; video e imagen animada quedan fuera para poder probar `rejected`. */
export const DEFAULT_MOCK_AI_CAPABILITIES: readonly AiExperienceKey[] = ALL_AI_EXPERIENCES.filter(
  (key) => key !== 'short_video' && key !== 'animated_image',
);

/**
 * Proveedor de IA simulado. Nunca sale de la máquina: la "IA" es la transformación inyectada.
 * Orden de decisión en `submit`: experiencia no soportada → `rejected`; sin consentimiento
 * `external_future` → `consent_required`; si no → `processing` y luego `ready` o `error`.
 */
export class MockAiProvider implements AiProvider {
  readonly provider = 'mock';

  readonly #clock: Clock;
  readonly #ids: IdFactory;
  readonly #delayMs: number | undefined;
  readonly #transform: AiTransform;
  readonly #failEvery: number | undefined;
  readonly #onResult: MockAiProviderOptions['onResult'];
  readonly #capabilities: AiExperienceKey[];
  readonly #jobs = new Map<Id, AiJob>();
  readonly #inputs = new Map<Id, Uint8Array>();
  readonly #results = new Map<Id, Uint8Array>();
  readonly #failures = new Map<Id, string>();
  readonly #pending = new Map<Id, number>();
  readonly #running = new Set<Id>();
  readonly #timers = new Map<Id, TimerHandle>();
  readonly #listeners = new Set<Listener>();
  #runs = 0;
  #disposed = false;

  constructor(opts: MockAiProviderOptions) {
    this.#clock = opts.clock;
    this.#ids = opts.idFactory;
    this.#delayMs = opts.delayMs;
    this.#transform = opts.transform;
    this.#failEvery = opts.failEvery;
    this.#onResult = opts.onResult;
    this.#capabilities = [...(opts.capabilities ?? DEFAULT_MOCK_AI_CAPABILITIES)];
  }

  capabilities(): AiExperienceKey[] {
    return [...this.#capabilities];
  }

  async submit(input: AiSubmitInput): Promise<AiJob> {
    this.#assertLive();
    const now = this.#clock();
    const at = toTimestamp(now);
    const consent = ConsentRecordSchema.safeParse(input.consent);
    const consentOk = consent.success && consentAllowsExternalAi(consent.data);
    const state: AiJobState = !this.#capabilities.includes(input.experience)
      ? 'rejected'
      : consentOk
        ? 'processing'
        : 'consent_required';
    const job: AiJob = {
      id: this.#ids(),
      sessionId: input.sessionId,
      captureId: input.captureId,
      experience: input.experience,
      state,
      provider: this.provider,
      message: aiJobMessage(state),
      consent: consent.success ? consent.data : undefined,
      createdAt: at,
      updatedAt: at,
    };
    this.#jobs.set(job.id, job);
    this.#emit(job);
    if (state === 'processing') {
      this.#inputs.set(job.id, input.image);
      this.#schedule(job.id, now);
    }
    return job;
  }

  get(jobId: Id): AiJob | undefined {
    return this.#jobs.get(jobId);
  }

  list(): AiJob[] {
    return [...this.#jobs.values()];
  }

  /** Bytes producidos por la transformación; el agente los persiste y construye `resultUrl`. */
  getResult(jobId: Id): Uint8Array | undefined {
    return this.#results.get(jobId);
  }

  /** Detalle técnico del último fallo (no se muestra al cliente). */
  failureReason(jobId: Id): string | undefined {
    return this.#failures.get(jobId);
  }

  /** Reintenta un job en `error`: pasa por `retry` y vuelve a `processing`. */
  async retry(jobId: Id): Promise<AiJob> {
    this.#assertLive();
    const job = this.#require(jobId);
    if (job.state !== 'error') throw new InvalidTransitionError(job.state, 'retry', 'ai');
    if (!this.#inputs.has(jobId)) throw new NotFoundError('ai job input', jobId);
    this.#update(jobId, 'retry');
    const now = this.#clock();
    const next = this.#update(jobId, 'processing');
    this.#schedule(jobId, now);
    return next;
  }

  onUpdate(cb: Listener): () => void {
    this.#listeners.add(cb);
    return () => {
      this.#listeners.delete(cb);
    };
  }

  /** Procesa los jobs cuyo momento llegó (`createdAt + delayMs <= now`). Devuelve los que cambian. */
  async tick(now: Date = this.#clock()): Promise<AiJob[]> {
    const t = now.getTime();
    const changed: AiJob[] = [];
    for (const [id, due] of [...this.#pending]) {
      if (due > t) continue;
      const job = await this.#run(id);
      if (job) changed.push(job);
    }
    return changed;
  }

  dispose(): void {
    for (const handle of this.#timers.values()) clearTimeout(handle);
    this.#timers.clear();
    this.#pending.clear();
    this.#listeners.clear();
    this.#disposed = true;
  }

  #schedule(id: Id, now: Date): void {
    this.#pending.set(id, now.getTime() + (this.#delayMs ?? 0));
    if (this.#delayMs === undefined) return;
    const handle = setTimeout(() => {
      void this.#run(id).catch(() => {
        // Un suscriptor lanzó desde un timer: no hay llamador al que propagar.
      });
    }, this.#delayMs);
    (handle as { unref?: () => void }).unref?.();
    this.#timers.set(id, handle);
  }

  #unschedule(id: Id): void {
    this.#pending.delete(id);
    const handle = this.#timers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      this.#timers.delete(id);
    }
  }

  async #run(id: Id): Promise<AiJob | undefined> {
    this.#unschedule(id);
    const job = this.#jobs.get(id);
    const image = this.#inputs.get(id);
    if (!job || !image || job.state !== 'processing' || this.#running.has(id)) return undefined;
    this.#running.add(id);
    try {
      this.#runs += 1;
      if (this.#failEvery !== undefined && this.#failEvery > 0 && this.#runs % this.#failEvery === 0) {
        this.#failures.set(id, `simulated provider failure (every ${this.#failEvery} jobs)`);
        return this.#update(id, 'error');
      }
      try {
        const output = await this.#transform(image, job.experience);
        this.#results.set(id, output);
        const resultUrl = this.#onResult ? await this.#onResult(this.#require(id), output) : `mock://${id}`;
        return this.#update(id, 'ready', { resultUrl });
      } catch (error) {
        this.#failures.set(id, error instanceof Error ? error.message : String(error));
        return this.#update(id, 'error');
      }
    } finally {
      this.#running.delete(id);
    }
  }

  #update(id: Id, state: AiJobState, patch: Partial<AiJob> = {}): AiJob {
    const current = this.#require(id);
    const next: AiJob = {
      ...current,
      ...patch,
      state,
      message: aiJobMessage(state),
      updatedAt: toTimestamp(this.#clock()),
    };
    this.#jobs.set(id, next);
    this.#emit(next);
    return next;
  }

  #require(id: Id): AiJob {
    const job = this.#jobs.get(id);
    if (!job) throw new NotFoundError('ai job', id);
    return job;
  }

  #assertLive(): void {
    if (this.#disposed) throw new IntegrationError('disposed', 'MockAiProvider is disposed');
  }

  #emit(job: AiJob): void {
    for (const cb of [...this.#listeners]) cb(job);
  }
}
