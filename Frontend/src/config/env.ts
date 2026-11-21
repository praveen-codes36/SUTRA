export type DataMode = 'demo' | 'live';
export type RouterMode = 'hash' | 'browser';

function readEnv(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.[key];
  } catch {
    return undefined;
  }
}

function parseIntWithDefault(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseBoolWithDefault(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return fallback;
}

const rawMode = readEnv('VITE_DATA_MODE');
const rawRouter = readEnv('VITE_ROUTER_MODE');

export const env = {
  DATA_MODE: (rawMode === 'live' ? 'live' : 'demo') as DataMode,
  ALLOW_MODE_SWITCH: parseBoolWithDefault(readEnv('VITE_ALLOW_MODE_SWITCH'), true),
  API_BASE_URL: (readEnv('VITE_API_BASE_URL') || 'http://localhost:8000/api/v1').replace(/\/+$/, ''),
  ROUTER_MODE: (rawRouter === 'browser' ? 'browser' : 'hash') as RouterMode,
  ORG_TIMEZONE: readEnv('VITE_ORG_TIMEZONE') || 'Asia/Kolkata',
  REQUEST_TIMEOUT_MS: parseIntWithDefault(readEnv('VITE_REQUEST_TIMEOUT_MS'), 20000),
  ANSWER_TIMEOUT_MS: parseIntWithDefault(readEnv('VITE_ANSWER_TIMEOUT_MS'), 45000),
  UPLOAD_TIMEOUT_MS: parseIntWithDefault(readEnv('VITE_UPLOAD_TIMEOUT_MS'), 120000),
  MAX_UPLOAD_MB: parseIntWithDefault(readEnv('VITE_MAX_UPLOAD_MB'), 100),
  CSRF_HEADER: readEnv('VITE_CSRF_HEADER') || 'X-CSRF-Token',
} as const;

export function getEnvOverride(name: string): string | undefined {
  return readEnv(name);
}
