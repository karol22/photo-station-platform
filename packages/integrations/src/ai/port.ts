import type { AiExperienceKey, AiJob, ConsentRecord, Id } from '@psp/contracts';
import { AiExperienceKey as AiExperienceKeySchema } from '@psp/contracts';

export interface AiSubmitInput {
  sessionId: Id;
  captureId: Id;
  experience: AiExperienceKey;
  /** Bytes de la imagen (PNG/JPEG). En esta fase nunca salen de la máquina. */
  image: Uint8Array;
  consent: ConsentRecord;
}

/**
 * Puerto de proveedor de IA (requisito 11). Sólo estados representables: ningún adaptador
 * real existe y el mock transforma la imagen con una función inyectada.
 */
export interface AiProvider {
  readonly provider: string;
  capabilities(): AiExperienceKey[];
  submit(input: AiSubmitInput): Promise<AiJob>;
  get(jobId: Id): AiJob | undefined;
  onUpdate(cb: (job: AiJob) => void): () => void;
}

/** Transformación de imagen inyectada; el agente de estación pasa una de `@psp/imaging`. */
export type AiTransform = (image: Uint8Array, experience: AiExperienceKey) => Promise<Uint8Array>;

/** Todas las experiencias futuras del contrato (requisito 11.1). */
export const ALL_AI_EXPERIENCES: readonly AiExperienceKey[] = AiExperienceKeySchema.options;

/** El procesamiento externo exige el consentimiento `external_future` otorgado (requisito 11.2). */
export function consentAllowsExternalAi(consent: ConsentRecord | undefined): boolean {
  return consent !== undefined && consent.given === true && consent.kind === 'external_future';
}

export type AiAdapterKey = 'mock' | 'external';

export const AI_ADAPTERS: readonly AiAdapterKey[] = ['mock', 'external'];
