import type { AiExperienceKey, AiJob, Id } from '@psp/contracts';
import type { Clock, IdFactory, IntegrationDeps } from '../support';
import { toTimestamp } from '../support';
import { aiJobMessage } from './messages';
import { ALL_AI_EXPERIENCES, type AiProvider, type AiSubmitInput } from './port';

export interface ExternalAiProviderStubOptions extends IntegrationDeps {
  /** Nombre del proveedor futuro; por defecto `external`. */
  provider?: string;
}

/** Proveedor externo aún inexistente: todo job nace en `coming_soon` y nunca cambia. */
export class ExternalAiProviderStub implements AiProvider {
  readonly provider: string;

  readonly #clock: Clock;
  readonly #ids: IdFactory;
  readonly #jobs = new Map<Id, AiJob>();
  readonly #listeners = new Set<(job: AiJob) => void>();

  constructor(opts: ExternalAiProviderStubOptions) {
    this.provider = opts.provider ?? 'external';
    this.#clock = opts.clock;
    this.#ids = opts.idFactory;
  }

  capabilities(): AiExperienceKey[] {
    return [...ALL_AI_EXPERIENCES];
  }

  async submit(input: AiSubmitInput): Promise<AiJob> {
    const at = toTimestamp(this.#clock());
    const job: AiJob = {
      id: this.#ids(),
      sessionId: input.sessionId,
      captureId: input.captureId,
      experience: input.experience,
      state: 'coming_soon',
      provider: this.provider,
      message: aiJobMessage('coming_soon'),
      consent: input.consent,
      createdAt: at,
      updatedAt: at,
    };
    this.#jobs.set(job.id, job);
    for (const cb of [...this.#listeners]) cb(job);
    return job;
  }

  get(jobId: Id): AiJob | undefined {
    return this.#jobs.get(jobId);
  }

  onUpdate(cb: (job: AiJob) => void): () => void {
    this.#listeners.add(cb);
    return () => {
      this.#listeners.delete(cb);
    };
  }
}
