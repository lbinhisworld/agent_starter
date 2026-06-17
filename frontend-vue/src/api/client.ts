/**
 * [INPUT]: window.APP_CONFIG、localStorage 鉴权键（与 frontend/js/auth-runtime.js 对齐）
 * [OUTPUT]: backendApi（登录与管理端受保护请求）
 * [POS]: Vue 侧统一 HTTP 客户端
 *
 * [PROTOCOL]: 变更鉴权/续期行为时同步更新 frontend-vue 相关文档与 frontend/js/auth-runtime.js 约定；案例 LLM 审计见 `fetchCaseLlmLogs`
 * FE-20260327：成功响应不再读取 X-Auth-Token / X-Auth-Expires-At 覆盖本地 token（同 token 会话）
 * FE-20260324-17：401 仍清 token 并跳转；403 调用 `handleAuthForbidden`，不清 token、不跳转
 * FE-20260324-18：`login()` 成功响应同样接续期头（不走 requestJson 的唯一 fetch 入口）
 */

type ApiUser = {
  id?: string;
  username: string;
  status?: string;
  createdAt?: string;
};

export type MyAiConfigStatus = {
  provider?: string;
  apiUrl?: string | null;
  model?: string | null;
  verifiedAt?: string | null;
  hasApiKey?: boolean;
  hasConfig?: boolean;
  configured?: boolean;
  isConfigured?: boolean;
  verified?: boolean;
  isVerified?: boolean;
  ready?: boolean;
  gatePassed?: boolean;
};

export type SaveMyAiConfigPayload = {
  apiKey: string;
  apiUrl?: string;
  model?: string;
};

/** `GET /problem-cases/:id/llm-logs` 聚合区 */
export type CaseLlmLogSummaryDto = {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

/** 列表行（无全文 prompt / 回复） */
export type CaseLlmLogRowDto = {
  id: string;
  caseId: string;
  taskId: string;
  callTarget: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  createdAt: string;
};

const AUTH_TOKEN_KEY = 'smart_cto_auth_token';
const AUTH_ROLE_KEY = 'smart_cto_auth_role';
const AUTH_USERNAME_KEY = 'smart_cto_auth_username';
const AUTH_EXPIRES_AT_KEY = 'smart_cto_auth_expires_at';
const AI_CONFIG_REQUIRED_CODE = 'AI_CONFIG_REQUIRED';

function getBackendBaseUrl() {
  const cfg = (window as any).APP_CONFIG || {};
  return String(cfg.BACKEND_API_URL || '').replace(/\/$/, '');
}

function getMode() {
  // local 模式（AI 直连 DeepSeek + IndexedDB）已于 2026-06-17 废弃，统一 online（走后端）。
  return 'online';
}

function getJwtToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function isAuthDebugEnabled() {
  try {
    const cfg = (window as any).APP_CONFIG || {};
    return (window as any).__FE_AUTH_DEBUG === true || !!cfg.FE_AUTH_DEBUG;
  } catch {
    return false;
  }
}

/** 与 auth-runtime 同步：同 token 会话，不做响应头续期写回 */
function applyAuthRenewalFromHeaders(res: Response) {
  if (!res || typeof res.headers.get !== 'function') return;
}

function clearAuthLocal() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_ROLE_KEY);
    localStorage.removeItem(AUTH_USERNAME_KEY);
    localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
  } catch {
    // ignore
  }
}

/** 与 frontend/js/auth-runtime.js 的 isLoginPathname 对齐，避免登录页上 401 再次整页跳转转圈 */
function isLoginPathname(pathname: string): boolean {
  try {
    const p = String(pathname || '').replace(/\/+$/, '');
    return /\/login\.html$/i.test(p) || /\/login$/i.test(p);
  } catch {
    return false;
  }
}

function isModelConfigPathname(pathname: string): boolean {
  try {
    const p = String(pathname || '').replace(/\/+$/, '');
    return /\/model-config\.html$/i.test(p) || /\/model-config$/i.test(p);
  } catch {
    return false;
  }
}

function isAdminPathname(pathname: string): boolean {
  try {
    const p = String(pathname || '').replace(/\/+$/, '');
    return /\/admin\.html$/i.test(p) || /\/admin$/i.test(p);
  } catch {
    return false;
  }
}

function resolveSafeRedirect(raw?: string | null): string {
  try {
    const candidate = String(raw || '').trim();
    if (!candidate) return 'home.html';
    const url = new URL(candidate, location.href);
    const pathname = String(url.pathname || '').replace(/\/+$/, '');
    if (isLoginPathname(pathname) || isModelConfigPathname(pathname) || isAdminPathname(pathname)) {
      return 'home.html';
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return 'home.html';
  }
}

function getAiConfigRequiredRedirectTarget(): string {
  try {
    if (isLoginPathname(location.pathname) || isModelConfigPathname(location.pathname)) {
      const url = new URL(location.href);
      const redirect = url.searchParams.get('redirect');
      if (redirect) return resolveSafeRedirect(redirect);
    }
  } catch {
    // ignore
  }
  return resolveSafeRedirect(location.pathname + location.search + location.hash);
}

export function buildModelConfigUrl(redirect?: string | null): string {
  try {
    const url = new URL('model-config.html', location.href);
    const safeRedirect = resolveSafeRedirect(redirect);
    if (safeRedirect) url.searchParams.set('redirect', safeRedirect);
    return url.pathname + url.search + url.hash;
  } catch {
    const safeRedirect = encodeURIComponent(resolveSafeRedirect(redirect));
    return `model-config.html?redirect=${safeRedirect}`;
  }
}

export function handleAiConfigRequired(detail?: { redirect?: string; source?: string; url?: string; message?: string }) {
  try {
    if (isModelConfigPathname(location.pathname)) return;
  } catch {
    // ignore
  }

  try {
    const runtimeHandler =
      (window as any)?.AUTH_RUNTIME?.handleAiConfigRequired ||
      (window as any)?.handleAiConfigRequired;
    if (typeof runtimeHandler === 'function' && runtimeHandler !== handleAiConfigRequired) {
      runtimeHandler({
        ...(detail || {}),
        redirect: resolveSafeRedirect(detail?.redirect),
      });
      return;
    }
  } catch {
    // ignore
  }

  location.href = buildModelConfigUrl(detail?.redirect);
}

function readBoolFlag(value: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      return Boolean((value as any)[key]);
    }
  }
  return null;
}

export function isMyAiConfigGatePassed(status: unknown): boolean {
  if (!status || typeof status !== 'object') return false;
  const value = status as Record<string, unknown>;
  const ready = readBoolFlag(value, ['ready', 'gatePassed']);
  if (ready != null) return ready;

  const configured = readBoolFlag(value, ['hasConfig', 'configured', 'isConfigured', 'hasApiKey']);
  const verified = readBoolFlag(value, ['verified', 'isVerified']);
  return Boolean(configured && verified);
}

function redirectToLogin() {
  if (isLoginPathname(location.pathname)) {
    return;
  }
  try {
    const current = location.pathname + location.search + location.hash;
    location.href = 'login.html?redirect=' + encodeURIComponent(current) + '&auth_reason=auth';
  } catch {
    location.href = 'login.html?auth_reason=auth';
  }
}

async function requestJson<T>(path: string, options: RequestInit & { jsonBody?: any } = {}) {
  const backend = getBackendBaseUrl();
  const url = backend + path;

  const token = getJwtToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
    body: options.jsonBody !== undefined ? JSON.stringify(options.jsonBody) : options.body,
  });

  if (res.ok) {
    applyAuthRenewalFromHeaders(res);
  }

  const data = await res.clone().json().catch(() => ({}));
  const message =
    data && (data.message || data.error) ? String(data.message || data.error) : '';
  const code =
    data && (data.code || data.errorCode) ? String(data.code || data.errorCode) : '';

  if (!res.ok && (res.status === 428 || code === AI_CONFIG_REQUIRED_CODE)) {
    handleAiConfigRequired({
      url,
      source: 'frontend-vue/client.ts',
      message,
      redirect: getAiConfigRequiredRedirectTarget(),
    });
    throw new Error(message || '当前账号尚未完成模型配置');
  }

  if (res.status === 403) {
    const w = window as any;
    if (typeof w.handleAuthForbidden === 'function') {
      w.handleAuthForbidden({ url, message, source: 'frontend-vue/client.ts' });
    } else {
      const fallback =
        message.trim() || '权限不足或当前账号不可用，请联系管理员';
      console.warn('[FE:auth-403]', { status: 403, url, message: fallback, source: 'frontend-vue/client.ts' });
      alert(fallback);
    }
    throw new Error('Forbidden');
  }

  if (res.status === 401) {
    if (isAuthDebugEnabled() && !(window as any).__FE_AUTH_FIRST_FAIL_LOGGED) {
      (window as any).__FE_AUTH_FIRST_FAIL_LOGGED = true;
      console.warn('[FE:auth-401]', { status: 401, url, message, source: 'frontend-vue/client.ts' });
    }
    clearAuthLocal();
    redirectToLogin();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || ('Request failed: ' + res.status);
    throw new Error(msg);
  }

  return data as T;
}

export type LoginResponse = {
  token: string;
  expiresIn?: number;
  user?: { id?: string; username: string; role: 'admin' | 'user' };
};

export const backendApi = {
  getMode,
  async login(payload: { username: string; password: string }): Promise<LoginResponse> {
    const backend = getBackendBaseUrl();
    const res = await fetch(backend + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || ('登录失败: ' + res.status));
    // 与 requestJson 一致：2xx 成功且响应含续期头则覆盖（无剩余时间判断）；随后 LoginPage signIn 仍以 body.token 为准写入
    applyAuthRenewalFromHeaders(res);
    return data as LoginResponse;
  },

  async listUsers(): Promise<{ items: ApiUser[] } | ApiUser[]> {
    return requestJson('/admin/users', { method: 'GET' });
  },

  async createUser(payload: { username: string }): Promise<{ user?: ApiUser; password?: string; passwordPlain?: string; }>{
    return requestJson('/admin/users', { method: 'POST', jsonBody: payload });
  },

  async updateUserStatus(username: string, status: 'ENABLED' | 'DISABLED') {
    return requestJson(`/admin/users/${encodeURIComponent(username)}`, { method: 'PUT', jsonBody: { status } });
  },

  async updateUserPassword(username: string, password: string) {
    return requestJson(`/admin/users/${encodeURIComponent(username)}/password`, { method: 'PUT', jsonBody: { password } });
  },

  async getMyAiConfigStatus(): Promise<MyAiConfigStatus> {
    return requestJson('/me/ai-config/status', { method: 'GET' });
  },

  async saveMyAiConfig(payload: SaveMyAiConfigPayload): Promise<MyAiConfigStatus> {
    const body: Record<string, string> = {};
    const apiKey = String(payload.apiKey || '').trim();
    const apiUrl = String(payload.apiUrl || '').trim();
    const model = String(payload.model || '').trim();
    if (apiKey) body.apiKey = apiKey;
    if (apiUrl) body.apiUrl = apiUrl;
    if (model) body.model = model;
    return requestJson('/me/ai-config', { method: 'PUT', jsonBody: body });
  },

  async fetchCaseLlmLogs(caseId: string): Promise<{ summary: CaseLlmLogSummaryDto; items: CaseLlmLogRowDto[] }> {
    return requestJson(`/problem-cases/${encodeURIComponent(caseId)}/llm-logs`, { method: 'GET' });
  },
};
