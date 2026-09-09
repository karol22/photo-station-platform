/**
 * Cliente HTTP tipado del control-plane (`/admin/v1`). Toda respuesta se valida con zod
 * (`safeParse`); un 401 cierra la sesión; los errores llegan como `ApiClientError` con el
 * `code` del contrato `ApiError`.
 */
import { z } from 'zod';
import { ApiError } from '@psp/contracts';

export const API_BASE = '/admin/v1';

export type ApiErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'asset_in_use'
  | 'internal'
  | 'network'
  | 'invalid_response'
  | string;

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly incidentCode: string | undefined;

  constructor(input: { code: ApiErrorCode; message: string; status: number; details?: unknown; incidentCode?: string }) {
    super(input.message);
    this.name = 'ApiClientError';
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
    this.incidentCode = input.incidentCode;
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiClientError {
  return error instanceof ApiClientError && (code === undefined || error.code === code);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

interface AuthHooks {
  getToken: () => string | undefined;
  onUnauthorized: () => void;
}

let hooks: AuthHooks = { getToken: () => undefined, onUnauthorized: () => undefined };

/** El store de autenticación registra aquí cómo obtener el token y qué hacer ante un 401. */
export function configureApi(next: AuthHooks): void {
  hooks = next;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  signal?: AbortSignal;
  /** No cerrar sesión ante 401 (login). */
  skipAuth?: boolean;
}

async function rawFetch(method: HttpMethod, path: string, body: unknown, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' };
  const token = options.skipAuth ? undefined : hooks.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiClientError({ code: 'network', message: error instanceof Error ? error.message : 'network error', status: 0 });
  }
  if (!response.ok) throw await toApiError(response, options);
  return response;
}

async function toApiError(response: Response, options: RequestOptions): Promise<ApiClientError> {
  let payload: unknown;
  const text = await response.text().catch(() => '');
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }
  const parsed = ApiError.safeParse(payload);
  const fallbackCode = response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'not_found' : response.status === 409 ? 'conflict' : 'internal';
  const error = new ApiClientError({
    code: parsed.success ? parsed.data.code : fallbackCode,
    message: parsed.success ? parsed.data.message : text || `HTTP ${response.status}`,
    status: response.status,
    ...(parsed.success && parsed.data.details !== undefined ? { details: parsed.data.details } : {}),
    ...(parsed.success && parsed.data.incidentCode !== undefined ? { incidentCode: parsed.data.incidentCode } : {}),
  });
  if (response.status === 401 && !options.skipAuth) hooks.onUnauthorized();
  return error;
}

/** Petición JSON validada con `schema`. Un cuerpo vacío se entrega como `undefined` al esquema. */
export async function request<T>(schema: z.ZodType<T>, method: HttpMethod, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const response = await rawFetch(method, path, body, options);
  const text = await response.text();
  let payload: unknown = undefined;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.warn(`[admin] respuesta inválida en ${method} ${path}`, parsed.error.issues.slice(0, 5));
    throw new ApiClientError({
      code: 'invalid_response',
      message: `${method} ${path}: ${parsed.error.issues[0]?.path.join('.') ?? ''} ${parsed.error.issues[0]?.message ?? 'invalid response'}`,
      status: response.status,
      details: parsed.error.issues.slice(0, 20).map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  return parsed.data;
}

/** Petición cuyo cuerpo es texto (exportaciones CSV). */
export async function requestText(method: HttpMethod, path: string, body?: unknown, options: RequestOptions = {}): Promise<string> {
  const response = await rawFetch(method, path, body, options);
  return response.text();
}

/** Petición binaria (contenido de activos) → URL de objeto para `<img>`/`<video>`. */
export async function requestObjectUrl(path: string, options: RequestOptions = {}): Promise<{ url: string; mime: string }> {
  const response = await rawFetch('GET', path, undefined, options);
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), mime: response.headers.get('content-type') ?? blob.type };
}

export const Unknown = z.unknown();
