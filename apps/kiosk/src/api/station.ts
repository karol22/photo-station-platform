/**
 * Cliente tipado del agente local (`/station/v1`). Único punto de red del kiosco: mismo origen
 * (en desarrollo Vite lo reenvía al agente). Cada respuesta pasa por `safeParse` del contrato antes
 * de usarse; una respuesta inválida se convierte en `StationApiError('invalid_response')`.
 */
import { z } from 'zod';
import {
  AiJob,
  ApiError,
  DeliveryRequestRecord,
  FinishSessionResponse,
  KioskBundle,
  PaymentIntent,
  StationSession,
  StationStatus,
  TechLoginResponse,
  TechStatus,
  TechTestKind as TechTestKindSchema,
  TestResult,
  type AiExperienceKey,
  type ConsentRecord,
  type EditOp,
  type EditingTool,
  type MaintenanceActionRequest,
  type SessionStage,
  type SimulateFaultRequest,
  type UploadCaptureRequest,
} from '@psp/contracts';

export type TechTestKind = ReturnType<typeof TechTestKindSchema.parse>;

export const STATION_BASE = '/station/v1';
export const EVENTS_URL = `${STATION_BASE}/events`;

export class StationApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly incidentCode: string | undefined;
  constructor(input: { code: string; message: string; status: number; incidentCode?: string }) {
    super(input.message);
    this.name = 'StationApiError';
    this.code = input.code;
    this.status = input.status;
    this.incidentCode = input.incidentCode;
  }
}

export function errorCode(error: unknown): string {
  return error instanceof StationApiError ? error.code : 'generic';
}

let techToken: string | undefined;
export function setTechToken(token: string | undefined): void {
  techToken = token;
}

const OkResponse = z.object({ ok: z.boolean().optional() }).passthrough();

async function request<T>(schema: z.ZodType<T>, method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (techToken && path.startsWith('/tech')) headers['Authorization'] = `Tech ${techToken}`;
  let response: Response;
  try {
    response = await fetch(`${STATION_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (error) {
    throw new StationApiError({ code: 'connection_lost', message: String(error), status: 0 });
  }
  const text = await response.text();
  let json: unknown = undefined;
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  if (!response.ok) {
    const parsed = ApiError.safeParse(json);
    if (parsed.success) {
      throw new StationApiError({ code: parsed.data.code, message: parsed.data.message, status: response.status, ...(parsed.data.incidentCode ? { incidentCode: parsed.data.incidentCode } : {}) });
    }
    throw new StationApiError({ code: response.status === 401 ? 'unauthorized' : response.status === 404 ? 'not_found' : 'service_unavailable', message: response.statusText, status: response.status });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new StationApiError({ code: 'invalid_response', message: parsed.error.message, status: response.status });
  }
  return parsed.data;
}

const MaybeSession = z.union([StationSession, z.null(), z.undefined(), z.object({ session: StationSession.nullable() })]);

/**
 * Mutación de sesión tolerante: si el agente responde la sesión completa se usa tal cual; si responde
 * el recurso creado (Capture, PrintJob, PaymentIntent) se vuelve a leer la sesión. Así el kiosco no
 * depende de qué forma devuelve cada ruta.
 */
async function requestSession(id: string, method: string, path: string, body?: unknown): Promise<StationSession> {
  const raw = await request(z.unknown(), method, path, body);
  const asSession = StationSession.safeParse(raw);
  if (asSession.success) return asSession.data;
  const wrapped = z.object({ session: StationSession }).safeParse(raw);
  if (wrapped.success) return wrapped.data.session;
  return request(StationSession, 'GET', `/sessions/${encodeURIComponent(id)}`);
}

/** Compuerta: toda respuesta del agente se valida aquí. */
export const stationApi = {
  status: () => request(StationStatus, 'GET', '/status'),
  bundle: () => request(KioskBundle, 'GET', '/bundle'),
  async activeSession(): Promise<StationSession | undefined> {
    try {
      const result = await request(MaybeSession, 'GET', '/sessions/active');
      if (!result) return undefined;
      if ('session' in result) return result.session ?? undefined;
      return result;
    } catch (error) {
      if (error instanceof StationApiError && error.status === 404) return undefined;
      throw error;
    }
  },
  session: (id: string) => request(StationSession, 'GET', `/sessions/${encodeURIComponent(id)}`),
  createSession: (input: { productId: string; locale: 'es' | 'en'; isDemo?: boolean; accessible?: boolean }) =>
    request(StationSession, 'POST', '/sessions', { productId: input.productId, locale: input.locale, isDemo: input.isDemo ?? false, operatorStarted: false, accessible: input.accessible ?? false }),
  advanceStage: (id: string, to: SessionStage, reason?: string) =>
    requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/stage`, { to, ...(reason ? { reason } : {}) }),
  recordConsents: (id: string, consents: ConsentRecord[]) =>
    requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/consents`, { consents }),
  uploadCapture: (id: string, input: UploadCaptureRequest) => requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/captures`, input),
  saveEdits: (id: string, input: { captureId: string; ops: EditOp[]; toolsUsed: EditingTool[]; resultBase64?: string }) =>
    requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/edits`, input),
  setSelection: (id: string, captureIds: string[]) => requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/selection`, { captureIds }),
  saveComposition: (id: string, input: { imageBase64: string; width: number; height: number; copies?: number }) =>
    requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/composition`, input),
  print: (id: string, input: { copies?: number; printerId?: string; idempotencyKey: string }) =>
    requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/print`, input),
  finish: (id: string) => request(FinishSessionResponse, 'POST', `/sessions/${encodeURIComponent(id)}/finish`),
  cancel: (id: string, reason?: string) => requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/cancel`, { ...(reason ? { reason } : {}) }),
  extend: (id: string, extraSec: number) => requestSession(id, 'POST', `/sessions/${encodeURIComponent(id)}/extend`, { extraSec }),
  createPaymentIntent: (sessionId: string) => request(PaymentIntent, 'POST', '/payments/intents', { sessionId }),
  cancelPaymentIntent: (intentId: string) => request(PaymentIntent, 'POST', `/payments/intents/${encodeURIComponent(intentId)}/cancel`),
  simulatePayment: (intentId: string, outcome: 'approve' | 'decline' | 'cancel' | 'expire' | 'review' | 'device_out' | 'recover') =>
    request(PaymentIntent, 'POST', '/payments/simulate', { intentId, outcome }),
  createAiJob: (input: { sessionId: string; captureId: string; experience: AiExperienceKey; consent?: ConsentRecord }) => request(AiJob, 'POST', '/ai/jobs', input),
  requestDelivery: (input: { sessionId: string; channel: 'whatsapp' | 'sms' | 'email'; destination: string }) => request(DeliveryRequestRecord, 'POST', '/delivery', input),
  // Panel técnico
  techLogin: (pin: string) => request(TechLoginResponse, 'POST', '/tech/login', { pin }),
  techStatus: () => request(TechStatus, 'GET', '/tech/status'),
  techTest: (kind: TechTestKind) => request(TestResult, 'POST', '/tech/tests', { kind }),
  techMaintenance: (action: MaintenanceActionRequest) => request(OkResponse, 'POST', '/tech/maintenance', action),
  techConfig: (values: Record<string, unknown>, reason?: string) => request(OkResponse, 'PATCH', '/tech/config', { values, ...(reason ? { reason } : {}) }),
  techSimulate: (fault: SimulateFaultRequest) => request(OkResponse, 'POST', '/tech/simulate', fault),
};

export type StationApi = typeof stationApi;
