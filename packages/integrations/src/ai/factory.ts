import { ValidationError } from '../errors';
import type { IntegrationDeps } from '../support';
import { ExternalAiProviderStub, type ExternalAiProviderStubOptions } from './external-stub';
import { MockAiProvider, type MockAiProviderOptions } from './mock-provider';
import type { AiAdapterKey, AiProvider, AiTransform } from './port';

/** Transformación por defecto: devuelve una copia de la imagen (sirve para probar el flujo). */
export const identityTransform: AiTransform = async (image) => new Uint8Array(image);

export interface AiProviderDeps extends IntegrationDeps {
  mock?: Partial<Omit<MockAiProviderOptions, 'clock' | 'idFactory'>>;
  external?: Omit<ExternalAiProviderStubOptions, 'clock' | 'idFactory'>;
}

export function createAiProvider(adapter: AiAdapterKey, deps: AiProviderDeps): AiProvider {
  switch (adapter) {
    case 'mock':
      return new MockAiProvider({
        clock: deps.clock,
        idFactory: deps.idFactory,
        ...deps.mock,
        transform: deps.mock?.transform ?? identityTransform,
      });
    case 'external':
      return new ExternalAiProviderStub({ clock: deps.clock, idFactory: deps.idFactory, ...deps.external });
    default:
      throw new ValidationError(`Unknown AI adapter: ${String(adapter)}`);
  }
}
