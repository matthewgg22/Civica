import { createHmac, randomUUID } from 'node:crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface EngineResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export interface EngineClientConfig {
  baseUrl: string;
  hmacSecret: string;
  /** Defaults to globalThis.fetch. Override in tests. */
  fetch?: typeof globalThis.fetch;
}

// ── Client ─────────────────────────────────────────────────────────────────

export class EngineClient {
  private readonly baseUrl: string;
  private readonly hmacSecret: string;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(config: EngineClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.hmacSecret = config.hmacSecret;
    this._fetch = config.fetch ?? globalThis.fetch;
  }

  async get<T = unknown>(path: string, actor: string, requestId?: string): Promise<EngineResponse<T>> {
    return this.request<T>('GET', path, null, actor, requestId);
  }

  async post<T = unknown>(path: string, body: unknown, actor: string, requestId?: string): Promise<EngineResponse<T>> {
    return this.request<T>('POST', path, body, actor, requestId);
  }

  async patch<T = unknown>(path: string, body: unknown, actor: string, requestId?: string): Promise<EngineResponse<T>> {
    return this.request<T>('PATCH', path, body, actor, requestId);
  }

  // Forwards a multipart/form-data body. Signs with empty body string (no deterministic serialization).
  async postMultipart<T = unknown>(path: string, formData: FormData, actor: string, requestId?: string): Promise<EngineResponse<T>> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const reqId = requestId ?? randomUUID();
    const signature = this.sign(timestamp, 'POST', path, '');

    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'X-Internal-Actor': actor,
        'X-Internal-Request-Id': reqId,
        'X-Internal-Timestamp': timestamp,
        'X-Internal-Signature': signature,
        // Content-Type intentionally omitted — fetch sets multipart boundary automatically
      },
      body: formData,
    });

    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  }

  // Returns the raw fetch Response for non-JSON responses (e.g. PDF binary).
  async fetchRaw(method: string, path: string, body: unknown, actor: string, requestId?: string): Promise<Response> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const reqId = requestId ?? randomUUID();
    const bodyStr = body != null ? JSON.stringify(body) : '';
    const signature = this.sign(timestamp, method, path, bodyStr);

    return this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Actor': actor,
        'X-Internal-Request-Id': reqId,
        'X-Internal-Timestamp': timestamp,
        'X-Internal-Signature': signature,
      },
      ...(body != null ? { body: bodyStr } : {}),
    });
  }

  // Signs: "<timestamp>.<METHOD>.<path>.<body>"
  // FastAPI verifies this before processing any internal request.
  sign(timestamp: string, method: string, path: string, body: string): string {
    const message = `${timestamp}.${method}.${path}.${body}`;
    return createHmac('sha256', this.hmacSecret).update(message).digest('hex');
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    actor: string,
    requestId?: string,
  ): Promise<EngineResponse<T>> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const reqId = requestId ?? randomUUID();
    const bodyStr = body != null ? JSON.stringify(body) : '';
    const signature = this.sign(timestamp, method, path, bodyStr);

    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Actor': actor,
        'X-Internal-Request-Id': reqId,
        'X-Internal-Timestamp': timestamp,
        'X-Internal-Signature': signature,
      },
      ...(body != null ? { body: bodyStr } : {}),
    });

    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  }
}

// ── Singleton factory ──────────────────────────────────────────────────────

let _client: EngineClient | null = null;

export function getEngineClient(): EngineClient {
  if (!_client) {
    const baseUrl = process.env.ENGINE_BASE_URL;
    if (!baseUrl) throw new Error('ENGINE_BASE_URL is required');
    const hmacSecret = process.env.INTERNAL_HMAC_SECRET;
    if (!hmacSecret) throw new Error('INTERNAL_HMAC_SECRET is required');
    _client = new EngineClient({ baseUrl, hmacSecret });
  }
  return _client;
}

export function _resetEngineClientCache(): void {
  _client = null;
}
