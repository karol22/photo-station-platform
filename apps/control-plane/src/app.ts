/**
 * Construcción de la app Fastify: contexto inyectable (base, reloj, ids), rutas `/admin/v1` y
 * `/fleet/v1`, manejo de errores como `ApiError` y simulador opcional.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { DatabaseSync } from '@psp/sqlite';
import { ZodError } from 'zod';
import { registerAdminRoutes, type AdminOptions } from './admin';
import { AppContext, HttpError } from './context';
import { registerFleetRoutes } from './fleet';
import { createSimulator, type SimulatorHandle } from './simulator';

export interface CreateAppOptions {
  db: DatabaseSync;
  now?: () => Date;
  random?: () => string;
  assetsDir: string;
  assetUrlBase?: string;
  logger?: boolean;
  simulatorIntervalMs?: number;
  fixtures?: AdminOptions['fixtures'];
}

export interface ControlPlaneApp {
  app: FastifyInstance;
  ctx: AppContext;
  simulator: SimulatorHandle;
}

export async function createApp(opts: CreateAppOptions): Promise<ControlPlaneApp> {
  const ctx = new AppContext(opts);
  const simulator = createSimulator(ctx, { intervalMs: opts.simulatorIntervalMs ?? 10_000 });
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 8 * 1024 * 1024 });
  await app.register(cors, { origin: true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ code: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({ code: 'validation', message: 'Validation failed', details: error.issues });
    }
    const status = typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : 500;
    if (status >= 500) app.log.error(error);
    const code = status === 404 ? 'not_found' : status === 400 || status === 415 ? 'validation' : status >= 500 ? 'internal' : 'error';
    const message = error instanceof Error ? error.message : String(error);
    return reply.code(status).send({ code, message: status >= 500 ? 'Internal error' : message, ...(status >= 500 ? { incidentCode: `CP-${Date.now().toString(36).toUpperCase().slice(-6)}` } : {}) });
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: 'not_found', message: 'Route not found' }));

  app.get('/health', async () => ({ ok: true, now: ctx.nowIso() }));

  await app.register(async (admin) => registerAdminRoutes(admin, ctx, { simulator, ...(opts.fixtures ? { fixtures: opts.fixtures } : {}) }), { prefix: '/admin/v1' });
  await app.register(async (fleet) => registerFleetRoutes(fleet, ctx), { prefix: '/fleet/v1' });

  app.addHook('onClose', async () => simulator.stop());
  return { app, ctx, simulator };
}
