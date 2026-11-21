import { z } from 'zod';
import { env } from '../config/env';
import type { ApiErrorBody, ApiErrorCode, ApiMeta } from '../types/api';

export class SutraApiError extends Error {
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNEXPECTED_RESPONSE' | (string & {});
  readonly status?: number;
  readonly requestId?: string;
  readonly details?: unknown[];
  readonly retryAfterSeconds?: number;

  constructor(params: {
    code: SutraApiError['code'];
    message: string;
    status?: number;
    requestId?: string;
    details?: unknown[];
    retryAfterSeconds?: number;
  }) {
    super(params.message);
    this.name = 'SutraApiError';
    this.code = params.code;
    this.status = params.status;
    this.requestId = params.requestId;
    this.details = params.details;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }
}

export function mapErrorCodeToUserMessage(
  code: string,
  fallbackMessage?: string,
  retryAfterSeconds?: number,
): string {
  switch (code) {
    case 'AUTH_REQUIRED':
      return 'Your session is not signed in or has expired. Please sign in to continue.';
    case 'FORBIDDEN':
      return 'This resource or action is not permitted for your role.';
    case 'NOT_FOUND':
      return 'The requested item is not available.';
    case 'RATE_LIMITED':
      return retryAfterSeconds
        ? `Too many requests. Please wait ${retryAfterSeconds} seconds before retrying.`
        : 'Too many requests. Please wait a moment and try again.';
    case 'DEPENDENCY_UNAVAILABLE':
    case 'UPSTREAM_TIMEOUT':
      return 'A backend intelligence service dependency is temporarily unavailable. Please retry.';
    case 'VALIDATION_ERROR':
      return fallbackMessage || 'The request failed validation. Check the highlighted fields.';
    case 'PAYLOAD_TOO_LARGE':
      return `The uploaded file exceeds the maximum allowed size (${env.MAX_UPLOAD_MB} MB).`;
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Unsupported file type. Supply a valid CSV and supported attachments.';
    case 'UNEXPECTED_RESPONSE':
      return 'The service returned an unexpected response.';
    case 'TIMEOUT':
      return 'The request timed out before the server responded.';
    case 'NETWORK_ERROR':
      return `Unable to reach the SUTRA backend at ${env.API_BASE_URL}.`;
    default:
      return fallbackMessage || 'An unexpected service error occurred.';
  }
}

let inMemoryCsrfToken: string | null = null;

export function readCsrfToken(): string | null {
  if (inMemoryCsrfToken) return inMemoryCsrfToken;
  if (typeof document === 'undefined') return null;
  const cookieNames = ['csrftoken', 'csrf_token', 'XSRF-TOKEN', 'sutra_csrf'];
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (cookieNames.includes(k)) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function captureCsrfHeader(headers: Headers) {
  const token = headers.get(env.CSRF_HEADER) || headers.get('X-CSRF-Token');
  if (token) {
    inMemoryCsrfToken = token;
  }
}

export function mapHttpStatusToErrorCode(status: number): ApiErrorCode {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 415) return 'UNSUPPORTED_MEDIA_TYPE';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'DEPENDENCY_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export interface ApiRequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  signal?: AbortSignal;
  idempotencyKey?: string;
  schema?: z.ZodType<T>;
  unwrapEnvelope?: boolean;
}

export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = `${env.API_BASE_URL}${cleanPath}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions<T> = {},
): Promise<ApiResult<T>> {
  const method = options.method || 'GET';
  const url = buildUrl(path, options.query);
  const maxRetries = method === 'GET' ? 2 : 0;
  const timeoutMs = options.timeoutMs ?? env.REQUEST_TIMEOUT_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort('timeout'), timeoutMs);

    const onExternalAbort = () => controller.abort('external');
    if (options.signal) {
      if (options.signal.aborted) {
        window.clearTimeout(timeoutId);
        throw new SutraApiError({ code: 'ABORTED', message: 'Request cancelled.' });
      }
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const headers = new Headers();
      if (!(options.body instanceof FormData)) {
        headers.set('Accept', 'application/json');
        if (options.body !== undefined) {
          headers.set('Content-Type', 'application/json');
        }
      }
      if (options.idempotencyKey) {
        headers.set('Idempotency-Key', options.idempotencyKey);
      }
      if (method !== 'GET') {
        const csrf = readCsrfToken();
        if (csrf) {
          headers.set(env.CSRF_HEADER, csrf);
        }
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body:
          options.body === undefined
            ? undefined
            : options.body instanceof FormData
              ? options.body
              : JSON.stringify(options.body),
        signal: controller.signal,
      });

      captureCsrfHeader(response.headers);

      if (!response.ok) {
        const retryAfterRaw = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined;

        if (attempt < maxRetries && isRetryableStatus(response.status)) {
          const jitter = Math.floor(Math.random() * 150);
          await sleep(250 * 2 ** attempt + jitter);
          continue;
        }

        let errorBody: ApiErrorBody | null = null;
        try {
          errorBody = (await response.json()) as ApiErrorBody;
        } catch {
          errorBody = null;
        }

        const errObj = errorBody?.error;
        const code = errObj?.code || mapHttpStatusToErrorCode(response.status);

        throw new SutraApiError({
          code,
          status: response.status,
          requestId: errObj?.request_id || response.headers.get('X-Request-Id') || undefined,
          details: errObj?.details,
          retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
          message: mapErrorCodeToUserMessage(code, errObj?.message, retryAfterSeconds),
        });
      }

      if (response.status === 204) {
        return { data: undefined as T };
      }

      const json = (await response.json()) as unknown;
      const shouldUnwrap = options.unwrapEnvelope !== false;
      let rawData: unknown = json;
      let meta: ApiMeta | undefined;

      if (shouldUnwrap && json && typeof json === 'object' && 'data' in json) {
        const envelope = json as { data: unknown; meta?: ApiMeta };
        rawData = envelope.data;
        meta = envelope.meta;
      }

      if (options.schema) {
        const parsed = options.schema.safeParse(rawData);
        if (!parsed.success) {
          console.error('SUTRA API schema validation failed:', {
            path,
            issues: parsed.error.issues,
          });
          throw new SutraApiError({
            code: 'UNEXPECTED_RESPONSE',
            requestId: meta?.request_id,
            message: mapErrorCodeToUserMessage('UNEXPECTED_RESPONSE'),
          });
        }
        return { data: parsed.data, meta };
      }

      return { data: rawData as T, meta };
    } catch (err) {
      if (err instanceof SutraApiError) {
        throw err;
      }
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) {
        if (options.signal?.aborted) {
          throw new SutraApiError({ code: 'ABORTED', message: 'Request cancelled.' });
        }
        if (attempt < maxRetries) {
          await sleep(250 * 2 ** attempt);
          continue;
        }
        throw new SutraApiError({
          code: 'TIMEOUT',
          message: mapErrorCodeToUserMessage('TIMEOUT'),
        });
      }

      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 150);
        await sleep(250 * 2 ** attempt + jitter);
        continue;
      }

      throw new SutraApiError({
        code: 'NETWORK_ERROR',
        message: mapErrorCodeToUserMessage('NETWORK_ERROR'),
      });
    } finally {
      window.clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  throw new SutraApiError({
    code: 'NETWORK_ERROR',
    message: mapErrorCodeToUserMessage('NETWORK_ERROR'),
  });
}

export function uploadWithProgress<T>(params: {
  path: string;
  formData: FormData;
  idempotencyKey?: string;
  timeoutMs?: number;
  onProgress?: (percent: number) => void;
  schema?: z.ZodType<T>;
}): Promise<ApiResult<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = buildUrl(params.path);
    xhr.open('POST', url, true);
    xhr.withCredentials = true;
    xhr.timeout = params.timeoutMs ?? env.UPLOAD_TIMEOUT_MS;

    if (params.idempotencyKey) {
      xhr.setRequestHeader('Idempotency-Key', params.idempotencyKey);
    }
    const csrf = readCsrfToken();
    if (csrf) {
      xhr.setRequestHeader(env.CSRF_HEADER, csrf);
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && params.onProgress) {
        const pct = Math.min(100, Math.round((ev.loaded / ev.total) * 100));
        params.onProgress(pct);
      }
    };

    xhr.onload = () => {
      let json: unknown = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const errBody = json as ApiErrorBody | null;
        const code = errBody?.error?.code || mapHttpStatusToErrorCode(xhr.status);
        reject(
          new SutraApiError({
            code,
            status: xhr.status,
            requestId: errBody?.error?.request_id || xhr.getResponseHeader('X-Request-Id') || undefined,
            details: errBody?.error?.details,
            message: mapErrorCodeToUserMessage(code, errBody?.error?.message),
          }),
        );
        return;
      }

      const envelope =
        json && typeof json === 'object' && 'data' in json
          ? (json as { data: unknown; meta?: ApiMeta })
          : { data: json, meta: undefined };

      if (params.schema) {
        const parsed = params.schema.safeParse(envelope.data);
        if (!parsed.success) {
          console.error('Upload response validation failed:', parsed.error.issues);
          reject(
            new SutraApiError({
              code: 'UNEXPECTED_RESPONSE',
              requestId: envelope.meta?.request_id,
              message: mapErrorCodeToUserMessage('UNEXPECTED_RESPONSE'),
            }),
          );
          return;
        }
        resolve({ data: parsed.data, meta: envelope.meta });
        return;
      }

      resolve({ data: envelope.data as T, meta: envelope.meta });
    };

    xhr.onerror = () => {
      reject(
        new SutraApiError({
          code: 'NETWORK_ERROR',
          message: mapErrorCodeToUserMessage('NETWORK_ERROR'),
        }),
      );
    };

    xhr.ontimeout = () => {
      reject(
        new SutraApiError({
          code: 'TIMEOUT',
          message: mapErrorCodeToUserMessage('TIMEOUT'),
        }),
      );
    };

    xhr.send(params.formData);
  });
}
