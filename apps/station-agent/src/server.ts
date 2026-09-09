/**
 * Servidor HTTP `/station/v1` para el kiosco (ADR-003). Toda entrada pasa por `safeParse` del
 * esquema de contracts; toda respuesta tiene la forma del contrato. SSE en `/events`.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import type { ApiError, StationEvent } from '@psp/contracts';
import {
  AdvanceStageRequest,
  AiJobRequest,
  CancelSessionRequest,
  CreatePaymentIntentRequest,
  CreateSessionRequest,
  DeliveryRequest,
  ExtendSessionRequest,
  LocalConfigPatchRequest,
  MaintenanceActionRequest,
  PrintRequest,
  RecordConsentRequest,
  RunTestRequest,
  SaveCompositionRequest,
  SaveEditsRequest,
  SetSelectionRequest,
  SimulateFaultRequest,
  SimulatePaymentRequest,
  TechLoginRequest,
  UploadCaptureRequest,
} from '@psp/contracts';
import type { z } from 'zod';
import { InvalidTransitionError as DomainInvalidTransition } from '@psp/domain';
import {
  IntegrationError,
  InvalidTransitionError,
  NotConfiguredError,
  NotFoundError,
  ValidationError,
} from '@psp/integrations';
import type { StationAgent } from './agent';
import { AgentError } from './support';

export const API_PREFIX = '/station/v1';
const SSE_KEEPALIVE_MS = 15_000;

function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new AgentError(
      400,
      'validation_error',
      'request body does not match the contract',
      result.error.issues,
    );
  return result.data as z.infer<S>;
}

function toApiError(error: unknown): { status: number; body: ApiError } {
  if (error instanceof AgentError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details as ApiError['details'] } : {}),
      },
    };
  }
  if (error instanceof NotFoundError)
    return { status: 404, body: { code: 'not_found', message: error.message } };
  if (error instanceof InvalidTransitionError || error instanceof DomainInvalidTransition)
    return { status: 409, body: { code: 'invalid_transition', message: error.message } };
  if (error instanceof ValidationError)
    return { status: 400, body: { code: 'validation_error', message: error.message } };
  if (error instanceof NotConfiguredError)
    return { status: 409, body: { code: 'not_configured', message: error.message } };
  if (error instanceof IntegrationError)
    return { status: 409, body: { code: error.code, message: error.message } };
  const message = error instanceof Error ? error.message : String(error);
  return { status: 500, body: { code: 'internal', message } };
}

type Params<K extends string> = FastifyRequest<{ Params: Record<K, string> }>;

export interface ServerOptions {
  /** Directorio del kiosco compilado; por defecto `../kiosk/dist` relativo a esta app. */
  kioskDist?: string;
  logger?: boolean;
}

export function buildServer(agent: StationAgent, opts: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 64 * 1024 * 1024 });
  void app.register(cors, { origin: true });

  app.setErrorHandler((error, _request, reply) => {
    const mapped = toApiError(error);
    if (mapped.status === 500) app.log.error(error);
    void reply.status(mapped.status).send(mapped.body);
  });

  const tech = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!agent.techAuthorized(request.headers.authorization)) {
      await reply
        .status(401)
        .send({
          code: 'tech_unauthorized',
          message: 'technician token required',
        } satisfies ApiError);
    }
  };

  app.get(`${API_PREFIX}/status`, async () => agent.status());
  app.get(`${API_PREFIX}/bundle`, async () => agent.kioskBundle());
  app.get(`${API_PREFIX}/assets/:hash`, async (request: Params<'hash'>, reply) => {
    const asset = await agent.asset(request.params.hash);
    return reply
      .header('Content-Type', asset.mime)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(Buffer.from(asset.bytes));
  });

  app.get(`${API_PREFIX}/events`, (request, reply) => {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });
    const write = (event: StationEvent): void => {
      raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    write({ type: 'status', status: agent.status() });
    const unsubscribe = agent.bus.subscribe(write);
    const keepalive = setInterval(() => raw.write(': keepalive\n\n'), SSE_KEEPALIVE_MS);
    keepalive.unref?.();
    request.raw.on('close', () => {
      unsubscribe();
      clearInterval(keepalive);
    });
  });

  /* ---------- sesiones ---------- */

  app.post(`${API_PREFIX}/sessions`, async (request, reply) =>
    reply.status(201).send(agent.sessions.create(parse(CreateSessionRequest, request.body))),
  );
  app.get(`${API_PREFIX}/sessions/active`, async (_request, reply) => {
    const active = agent.sessions.active();
    return active ? active : reply.status(204).send();
  });
  app.get(`${API_PREFIX}/sessions/:id`, async (request: Params<'id'>) =>
    agent.sessions.require(request.params.id),
  );
  app.post(`${API_PREFIX}/sessions/:id/stage`, async (request: Params<'id'>) => {
    const body = parse(AdvanceStageRequest, request.body);
    return agent.sessions.advance(request.params.id, body.to, body.reason);
  });
  app.post(`${API_PREFIX}/sessions/:id/consents`, async (request: Params<'id'>) =>
    agent.sessions.recordConsents(
      request.params.id,
      parse(RecordConsentRequest, request.body).consents,
    ),
  );
  app.post(`${API_PREFIX}/sessions/:id/captures`, async (request: Params<'id'>, reply) =>
    reply
      .status(201)
      .send(
        agent.sessions.addCapture(request.params.id, parse(UploadCaptureRequest, request.body)),
      ),
  );
  app.delete(
    `${API_PREFIX}/sessions/:id/captures/:captureId`,
    async (request: Params<'id' | 'captureId'>) =>
      agent.sessions.deleteCapture(request.params.id, request.params.captureId),
  );
  app.post(`${API_PREFIX}/sessions/:id/edits`, async (request: Params<'id'>) =>
    agent.sessions.saveEdits(request.params.id, parse(SaveEditsRequest, request.body)),
  );
  app.post(`${API_PREFIX}/sessions/:id/selection`, async (request: Params<'id'>) =>
    agent.sessions.setSelection(
      request.params.id,
      parse(SetSelectionRequest, request.body).captureIds,
    ),
  );
  app.post(`${API_PREFIX}/sessions/:id/composition`, async (request: Params<'id'>) =>
    agent.sessions.saveComposition(request.params.id, parse(SaveCompositionRequest, request.body)),
  );
  app.post(`${API_PREFIX}/sessions/:id/print`, async (request: Params<'id'>, reply) =>
    reply
      .status(202)
      .send(agent.sessions.print(request.params.id, parse(PrintRequest, request.body))),
  );
  app.post(
    `${API_PREFIX}/sessions/:id/print/:jobId/retry`,
    async (request: Params<'id' | 'jobId'>, reply) =>
      reply.status(202).send(agent.sessions.retryPrint(request.params.id, request.params.jobId)),
  );
  app.post(`${API_PREFIX}/sessions/:id/extend`, async (request: Params<'id'>) =>
    agent.sessions.extend(request.params.id, parse(ExtendSessionRequest, request.body).extraSec),
  );
  app.post(`${API_PREFIX}/sessions/:id/cancel`, async (request: Params<'id'>) =>
    agent.sessions.cancel(
      request.params.id,
      parse(CancelSessionRequest, request.body ?? {}).reason,
    ),
  );
  app.post(`${API_PREFIX}/sessions/:id/finish`, async (request: Params<'id'>) =>
    agent.sessions.finish(request.params.id),
  );
  app.get(
    `${API_PREFIX}/sessions/:id/files/:name`,
    async (request: Params<'id' | 'name'>, reply) => {
      const file = agent.sessions.fileBytes(request.params.id, request.params.name);
      return reply
        .header('Content-Type', file.mime)
        .header('Cache-Control', 'no-store')
        .send(file.bytes);
    },
  );

  /* ---------- pagos, IA, entrega ---------- */

  app.post(`${API_PREFIX}/payments/intents`, async (request, reply) =>
    reply
      .status(201)
      .send(
        await agent.payments.createIntent(
          parse(CreatePaymentIntentRequest, request.body).sessionId,
        ),
      ),
  );
  app.post(`${API_PREFIX}/payments/intents/:id/cancel`, async (request: Params<'id'>) =>
    agent.payments.cancel(request.params.id),
  );
  app.post(`${API_PREFIX}/payments/simulate`, async (request) => {
    const body = parse(SimulatePaymentRequest, request.body);
    return agent.payments.simulate(body.intentId, body.outcome);
  });
  app.post(`${API_PREFIX}/ai/jobs`, async (request, reply) =>
    reply.status(201).send(await agent.ai.submit(parse(AiJobRequest, request.body))),
  );
  app.get(`${API_PREFIX}/ai/jobs/:id`, async (request: Params<'id'>) => {
    const job = agent.ai.get(request.params.id);
    if (!job) throw new AgentError(404, 'not_found', `ai job not found: ${request.params.id}`);
    return job;
  });
  app.post(`${API_PREFIX}/delivery`, async (request, reply) =>
    reply.status(201).send(await agent.delivery.submit(parse(DeliveryRequest, request.body))),
  );

  /* ---------- panel técnico ---------- */

  app.post(`${API_PREFIX}/tech/login`, async (request) =>
    agent.techLogin(parse(TechLoginRequest, request.body).pin),
  );
  app.get(`${API_PREFIX}/tech/status`, { preHandler: tech }, async () => agent.techStatus());
  app.post(`${API_PREFIX}/tech/tests`, { preHandler: tech }, async (request) =>
    agent.runTest(parse(RunTestRequest, request.body).kind),
  );
  app.post(`${API_PREFIX}/tech/maintenance`, { preHandler: tech }, async (request) =>
    agent.maintenance(parse(MaintenanceActionRequest, request.body)),
  );
  app.patch(`${API_PREFIX}/tech/config`, { preHandler: tech }, async (request) => {
    const body = parse(LocalConfigPatchRequest, request.body);
    return { values: agent.patchLocalConfig(body.values, body.reason) };
  });
  app.post(`${API_PREFIX}/tech/simulate`, { preHandler: tech }, async (request) =>
    agent.simulate(parse(SimulateFaultRequest, request.body)),
  );
  app.post(`${API_PREFIX}/tech/print-test`, { preHandler: tech }, async (_request, reply) =>
    reply.status(202).send(agent.printTest()),
  );

  /* ---------- kiosco compilado ---------- */

  const kioskDist = opts.kioskDist ?? fileURLToPath(new URL('../../kiosk/dist', import.meta.url));
  if (existsSync(kioskDist)) {
    void app.register(fastifyStatic, { root: kioskDist, prefix: '/', decorateReply: false });
  }

  return app;
}
