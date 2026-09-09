/**
 * @psp/control-plane — API pública del paquete: construcción de la app, contexto, persistencia y
 * tabla de recursos. El binario vive en `src/main.ts`; el seed en `seed/`.
 */
export { createApp, type ControlPlaneApp, type CreateAppOptions } from './app';
export { AppContext, HttpError } from './context';
export { openControlPlaneDb, EntityRepo, type EntityType } from './store';
export { RESOURCES, RESOURCE_BY_NAME, type ResourceDef } from './resources';
export { createSimulator, type SimulatorHandle } from './simulator';
export { DEMO_PROVISIONING_TOKEN } from './fleet';
export { computeDashboard, computeMetrics } from './reports';
