/**
 * @psp/station-agent — superficie para pruebas e integración: servidor, agente y apoyos.
 */
export { buildServer, API_PREFIX, type ServerOptions } from './server';
export { StationAgent, createAgent, demoOrMinimalBundle, type AgentOptions } from './agent';
export { loadConfig, type AgentConfig } from './config';
export { standaloneBundle, type StandaloneBundleOptions } from './bundle/standalone';
export { BundleService, ASSET_URL_BASE } from './bundle/bundle-service';
export { SessionService } from './sessions/session-service';
export { PaymentService, AiService, DeliveryService, mockAiTransform } from './sessions/commerce';
export { Hardware, MockPrinter } from './hardware/hardware';
export { Store } from './store/store';
export { Outbox } from './sync/outbox';
export { Heartbeat } from './sync/heartbeat';
export { CloudClient, CloudError, type FetchLike } from './sync/cloud-client';
export {
  AgentError,
  EventBus,
  manualClock,
  sequentialIdFactory,
  realClock,
  realIdFactory,
  type Clock,
  type IdFactory,
  type ManualClock,
} from './support';
