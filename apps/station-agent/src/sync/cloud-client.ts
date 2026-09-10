/**
 * Cliente HTTP hacia `/fleet/v1` (protocolo `docs/protocolos/fleet-sync-v1.md`). Toda respuesta se
 * valida con `safeParse`; cualquier fallo de red o de forma se convierte en `cloudReachable = false`.
 */
import type {
  BundleResponse,
  EventBatchRequest,
  EventBatchResponse,
  HeartbeatRequest,
  HeartbeatResponse,
} from '@psp/contracts';
import {
  BundleResponse as BundleResponseSchema,
  EventBatchResponse as EventBatchResponseSchema,
  HeartbeatResponse as HeartbeatResponseSchema,
} from '@psp/contracts';
import type { z } from 'zod';

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
  headers: { get(name: string): string | null };
}>;

export interface CloudClientOptions {
  baseUrl: string;
  machineId: string;
  machineSecret: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  /** Fallas simuladas desde el panel técnico: con `true`, toda llamada falla sin tocar la red. */
  forcedOffline?: () => boolean;
}

export class CloudError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

export class CloudClient {
  reachable = false;
  lastAttemptAt: string | undefined;
  lastSuccessAt: string | undefined;
  lastError: string | undefined;
  readonly #opts: CloudClientOptions;
  readonly #fetch: FetchLike;

  constructor(opts: CloudClientOptions) {
    this.#opts = opts;
    this.#fetch =
      opts.fetch ??
      (globalThis.fetch as unknown as FetchLike | undefined) ??
      (() => Promise.reject(new Error('fetch not available')));
  }

  get baseUrl(): string {
    return `${this.#opts.baseUrl}/fleet/v1`;
  }

  async getBundle(version: string | undefined): Promise<BundleResponse> {
    const query = version ? `?version=${encodeURIComponent(version)}` : '';
    return this.#request(`/bundle${query}`, undefined, BundleResponseSchema);
  }

  async postHeartbeat(request: HeartbeatRequest): Promise<HeartbeatResponse> {
    return this.#request('/heartbeat', request, HeartbeatResponseSchema);
  }

  async postEvents(request: EventBatchRequest): Promise<EventBatchResponse> {
    return this.#request('/events', request, EventBatchResponseSchema);
  }

  async getAsset(hash: string): Promise<{ bytes: Uint8Array; mime: string }> {
    const response = await this.#raw(`/assets/${encodeURIComponent(hash)}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, mime: response.headers.get('content-type') ?? 'application/octet-stream' };
  }

  async #request<S extends z.ZodTypeAny>(
    path: string,
    body: unknown,
    schema: S,
  ): Promise<z.infer<S>> {
    const response = await this.#raw(path, body);
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      this.#fail(`invalid response from ${path}`);
      throw new CloudError(502, 'invalid_response', `invalid response from ${path}`);
    }
    return parsed.data as z.infer<S>;
  }

  async #raw(path: string, body?: unknown): Promise<Awaited<ReturnType<FetchLike>>> {
    const now = new Date().toISOString();
    this.lastAttemptAt = now;
    if (this.#opts.forcedOffline?.()) {
      this.#fail('cloud disabled by simulated fault');
      throw new CloudError(0, 'offline', 'cloud disabled by simulated fault');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#opts.timeoutMs ?? 5000);
    try {
      const response = await this.#fetch(`${this.baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-PSP-Contracts': 'v1',
          Authorization: `Machine ${this.#opts.machineId}:${this.#opts.machineSecret}`,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      if (!response.ok) {
        const code =
          response.status === 401
            ? 'machine_unauthorized'
            : response.status === 429
              ? 'rate_limited'
              : 'http_error';
        // Un 4xx significa que la nube responde: sigue siendo alcanzable aunque rechace.
        this.reachable = response.status < 500;
        this.lastError = `${code} (${response.status}) on ${path}`;
        throw new CloudError(response.status, code, this.lastError);
      }
      this.reachable = true;
      this.lastSuccessAt = now;
      this.lastError = undefined;
      return response;
    } catch (error) {
      if (error instanceof CloudError) throw error;
      this.#fail(error instanceof Error ? error.message : String(error));
      throw new CloudError(0, 'unreachable', this.lastError ?? 'unreachable');
    } finally {
      clearTimeout(timer);
    }
  }

  #fail(message: string): void {
    this.reachable = false;
    this.lastError = message;
  }
}
