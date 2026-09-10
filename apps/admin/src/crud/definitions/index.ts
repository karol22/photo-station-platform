/** Registro agregado de recursos con CRUD genérico. */
import type { ResourceDefinition } from '../types';
import { NETWORK_RESOURCES } from './network';
import { OFFER_RESOURCES } from './offer';
import { OPS_RESOURCES } from './ops';
import { PLATFORM_RESOURCES } from './platform';

export * from './network';
export * from './offer';
export * from './ops';
export * from './platform';

export const ALL_RESOURCES: ResourceDefinition[] = [...NETWORK_RESOURCES, ...OFFER_RESOURCES, ...PLATFORM_RESOURCES, ...OPS_RESOURCES];

export const RESOURCE_BY_KEY: Record<string, ResourceDefinition> = Object.fromEntries(ALL_RESOURCES.map((r) => [r.key, r]));
