/**
 * Auth Runtime（多页面共用）
 * - 读取 localStorage 中的 JWT token
 * - 统一构建 Authorization header
 * - 受保护请求响应若含 X-Auth-Token / X-Auth-Expires-At，不再覆盖本地 token（同 token 会话）
 * - 401：清理 token 并跳转 login.html（`auth_reason=auth`）；诊断见 `[FE:auth-401]`（需 `__FE_AUTH_DEBUG`）；IT 设计补齐自动顺序另可开 `__FE_TASK8_IT_DESIGN_AUTO_SEQ_LOG` 见 `[FE:task8-it-design-auto-seq][auth-401-will-redirect-login]`
 * - 403：不清 token、不跳转；页面提示 + `[FE:auth-403]`；同文案短时去重（FE-20260324-17）
 *
 * [PROTOCOL]: 变更鉴权/续期/跳转行为时同步更新 frontend/AGENTS.md；诊断开关见 `__FE_AUTH_DEBUG` / `APP_CONFIG.FE_AUTH_DEBUG`（FE-20260324-16）；`report.html`、`home.html`（Vue 影子页）、`tool-experience.html`、`tool-detail.html`、`design-detail.html`、`design-llm-log.html` 与 `index.html` 同属首屏登录门禁（FE-20260324-19；影子页 FE-20260406）。FE-20260408：online 且 role=user 时，业务页首屏追加个人模型配置二次门禁；`model-config.html` 为豁免页，后端 `AI_CONFIG_REQUIRED` 统一回跳此页
 */
(function (global) {
  const cfg = global.APP_CONFIG || {};

  // 注意：这里的 key 需要与 login/admin 页写入保持一致（本项目采用 localStorage，跨页面同源共享）。
  const AUTH_TOKEN_STORAGE_KEY = cfg.AUTH_TOKEN_STORAGE_KEY || 'smart_cto_auth_token';
  const AUTH_ROLE_STORAGE_KEY = cfg.AUTH_ROLE_STORAGE_KEY || 'smart_cto_auth_role';
  const AUTH_USERNAME_STORAGE_KEY = cfg.AUTH_USERNAME_STORAGE_KEY || 'smart_cto_auth_username';
  /** 后端续期头中的过期时间（毫秒时间戳字符串）；前端本轮不据此做剩余时间判断，仅持久化备查 */
  const AUTH_EXPIRES_AT_STORAGE_KEY = cfg.AUTH_EXPIRES_AT_STORAGE_KEY || 'smart_cto_auth_expires_at';

  /** 与 backend jwt.middleware RENEWAL_HEADER_* 一致 */
  const RENEWAL_HEADER_TOKEN = 'X-Auth-Token';
  const RENEWAL_HEADER_EXPIRES = 'X-Auth-Expires-At';
  const AI_CONFIG_REQUIRED_CODE = 'AI_CONFIG_REQUIRED';

  /** 控制台执行 `window.__FE_AUTH_DEBUG = true` 后刷新，可观察 `[FE:auth-refresh]` / `[FE:auth-gate]` / `[FE:auth-401]`；403 的 `[FE:auth-403]` 不依赖该开关 */
  function isAuthDebugEnabled() {
    try {
      return global.__FE_AUTH_DEBUG === true || !!(cfg && cfg.FE_AUTH_DEBUG);
    } catch {
      return false;
    }
  }

  function getAuthToken() {
    try {
      return global.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  function getCurrentRole() {
    try {
      return global.localStorage.getItem(AUTH_ROLE_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  function getUsername() {
    try {
      return global.localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  function setAuthToken(token, role) {
    try {
      if (token) global.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, String(token));
      else global.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      if (role) global.localStorage.setItem(AUTH_ROLE_STORAGE_KEY, String(role));
      else global.localStorage.removeItem(AUTH_ROLE_STORAGE_KEY);
      if (!token) global.localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  function clearAuth() {
    setAuthToken('', '');
    try {
      global.localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
      global.localStorage.removeItem(AUTH_EXPIRES_AT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * online 退出：先调用后端会话注销，再做本地安全收口。
   * 注意：接口失败也不阻断本地 clearAuth/跳转。
   * @returns {Promise<boolean>} 是否后端注销成功（2xx）
   */
  async function postLogoutToBackend() {
    try {
      const mode = String((cfg && cfg.MODE) || '').toLowerCase();
      const baseUrl = String((cfg && cfg.BACKEND_API_URL) || '').replace(/\/$/, '');
      const token = getAuthToken();
      if (mode !== 'online' || !baseUrl || !token) return false;
      const res = await fetch(baseUrl + '/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'same-origin',
      });
      return !!(res && res.ok);
    } catch {
      return false;
    }
  }

  function getAuthHeaders() {
    const token = getAuthToken();
    if (!token) return {};
    return { Authorization: 'Bearer ' + token };
  }

  /**
   * 同 token 会话：不再根据响应头续期覆盖本地 token，避免并发请求状态撕裂。
   * @param {Response} res - fetch Response
   */
  function applyAuthRenewalFromResponse(res) {
    if (!res || typeof res.headers.get !== 'function') return;
  }

  function getBackendBaseUrl() {
    try {
      return String((cfg && cfg.BACKEND_API_URL) || '').replace(/\/$/, '');
    } catch {
      return '';
    }
  }

  function isOnlineMode() {
    try {
      return String((cfg && cfg.MODE) || '').toLowerCase() === 'online';
    } catch {
      return false;
    }
  }

  /**
   * 是否当前为登录页路径（与 Vite 构建后路径、大小写、尾随斜杠兼容）。
   * 仅用 endsWith('login.html') 时，/frontend/login.html/ 会误判为「业务首页」触发门禁；DevTools 改.viewport 还会放大 backdrop 合成层重绘问题，表现为「像被重定向」。
   */
  function isLoginPathname(pathname) {
    try {
      const p = String(pathname || '').replace(/\/+$/, '');
      return /\/login\.html$/i.test(p) || /\/login$/i.test(p);
    } catch {
      return false;
    }
  }

  function isModelConfigPathname(pathname) {
    try {
      const p = String(pathname || '').replace(/\/+$/, '');
      return /\/model-config\.html$/i.test(p) || /\/model-config$/i.test(p);
    } catch {
      return false;
    }
  }

  function isAdminPathname(pathname) {
    try {
      const p = String(pathname || '').replace(/\/+$/, '');
      return /\/admin\.html$/i.test(p) || /\/admin$/i.test(p);
    } catch {
      return false;
    }
  }

  function isProtectedBusinessPathname(pathname) {
    try {
      const p = String(pathname || '').replace(/\/+$/, '');
      return (
        p.endsWith('index.html') ||
        p.endsWith('/') ||
        p.endsWith('report.html') ||
        p.endsWith('home.html') ||
        p.endsWith('tool-experience.html') ||
        p.endsWith('tool-detail.html') ||
        p.endsWith('design-detail.html') ||
        p.endsWith('design-llm-log.html')
      );
    } catch {
      return false;
    }
  }

  function buildCurrentRedirect() {
    try {
      return (global.location && global.location.pathname ? global.location.pathname : '') +
        (global.location && global.location.search ? global.location.search : '') +
        (global.location && global.location.hash ? global.location.hash : '');
    } catch {
      return 'home.html';
    }
  }

  function buildSafeRedirect(raw) {
    try {
      const candidate = String(raw || '').trim();
      if (!candidate) return 'home.html';
      const url = new URL(candidate, global.location && global.location.href ? global.location.href : undefined);
      const pathname = String(url.pathname || '').replace(/\/+$/, '');
      if (isLoginPathname(pathname) || isModelConfigPathname(pathname) || isAdminPathname(pathname)) {
        return 'home.html';
      }
      return url.pathname + url.search + url.hash;
    } catch {
      return 'home.html';
    }
  }

  function buildModelConfigUrl(redirect) {
    try {
      const url = new URL('model-config.html', global.location && global.location.href ? global.location.href : undefined);
      const safeRedirect = buildSafeRedirect(redirect);
      if (safeRedirect) url.searchParams.set('redirect', safeRedirect);
      return url.pathname + url.search + url.hash;
    } catch {
      return 'model-config.html?redirect=' + encodeURIComponent(buildSafeRedirect(redirect));
    }
  }

  function readBoolFlag(data, keys) {
    const value = data && typeof data === 'object' ? data : null;
    if (!value) return null;
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        return Boolean(value[key]);
      }
    }
    return null;
  }

  function isAiConfigGatePassed(data) {
    const ready = readBoolFlag(data, ['ready', 'gatePassed']);
    if (ready != null) return ready;
    const configured = readBoolFlag(data, ['hasConfig', 'configured', 'isConfigured', 'hasApiKey']);
    const verified = readBoolFlag(data, ['verified', 'isVerified']);
    return Boolean(configured && verified);
  }

  function handleAiConfigRequired(detail) {
    const d = detail && typeof detail === 'object' ? detail : {};
    const pathname = global.location && global.location.pathname ? global.location.pathname : '';
    if (isModelConfigPathname(pathname) || isAdminPathname(pathname)) return;

    try {
      console.warn('[FE:auth-gate]', {
        reason: 'ai_config_required',
        pathname,
        url: d.url || '',
        message: d.message || '',
        source: d.source || 'handleAiConfigRequired',
      });
    } catch {
      // ignore
    }

    const next = buildModelConfigUrl(d.redirect || buildCurrentRedirect());
    try {
      if (typeof global.location.replace === 'function') global.location.replace(next);
      else global.location.href = next;
    } catch {
      global.location.href = next;
    }
  }

  async function readResponseJson(res) {
    try {
      return await res.clone().json().catch(() => ({}));
    } catch {
      return {};
    }
  }

  async function ensureAiConfigGateForCurrentPage() {
    const pathname = global.location && global.location.pathname ? global.location.pathname : '';
    if (!isProtectedBusinessPathname(pathname) || isAdminPathname(pathname) || isModelConfigPathname(pathname)) return;
    if (!isOnlineMode()) return;
    if (String(getCurrentRole() || '').toLowerCase() === 'admin') return;

    const token = getAuthToken();
    const baseUrl = getBackendBaseUrl();
    if (!token || !baseUrl) return;

    const url = baseUrl + '/me/ai-config/status';
    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'same-origin',
      });
    } catch (err) {
      if (isAuthDebugEnabled()) {
        try {
          console.warn('[FE:auth-gate]', {
            reason: 'ai_config_status_fetch_failed',
            url,
            message: err && err.message ? String(err.message) : String(err || ''),
          });
        } catch {
          // ignore
        }
      }
      // FE-20260506：网络失败（fetch 抛错）不再跳 model-config，留在当前页提示刷新
      try {
        const toastMsg = '网络异常，无法校验模型配置状态，请刷新重试';
        if (typeof global.showError === 'function') global.showError(toastMsg);
        else global.alert(toastMsg);
      } catch {
        // ignore
      }
      return;
    }

    applyAuthRenewalFromResponse(res);
    const data = await readResponseJson(res);
    const message =
      data && (data.message || data.error) ? String(data.message || data.error) : '';
    const code =
      data && (data.code || data.errorCode) ? String(data.code || data.errorCode) : '';

    if (res.status === 401 || res.status === 403) {
      handleAuthError(res.status, { url, message, source: 'auth-runtime/status' });
      return;
    }

    if (!res.ok) {
      if (res.status === 428 || code === AI_CONFIG_REQUIRED_CODE) {
        handleAiConfigRequired({ url, message, source: 'auth-runtime/status-428' });
        return;
      }
      if (isAuthDebugEnabled()) {
        try {
          console.warn('[FE:auth-gate]', {
            reason: 'ai_config_status_http_error',
            url,
            status: res.status,
            message,
          });
        } catch {
          // ignore
        }
      }
      // FE-20260506：5xx 服务器错误不再跳 model-config，留在当前页提示重试
      if (res.status >= 500) {
        try {
          const toastMsg = '服务器暂时不可用，请稍后刷新重试';
          if (typeof global.showError === 'function') global.showError(toastMsg);
          else global.alert(toastMsg);
        } catch {
          // ignore
        }
        return;
      }
      handleAiConfigRequired({
        url,
        message: message || '当前无法确认模型配置状态，请先完成配置后再进入系统。',
        source: 'auth-runtime/status-non-ok',
      });
      return;
    }

    if (!isAiConfigGatePassed(data)) {
      handleAiConfigRequired({ url, message, source: 'auth-runtime/status-not-ready' });
    }
  }

  /** 无后端 message 时的默认用户提示 */
  const DEFAULT_FORBIDDEN_USER_MESSAGE = '权限不足或当前账号不可用，请联系管理员';
  /** 同一提示文案在窗口内的最小间隔（毫秒），避免并行请求连环弹窗 */
  const FORBIDDEN_TOAST_DEDUP_MS = 2500;

  /**
   * 403：仅提示 + 控制台日志，不清 token、不跳转。与 Vue `client.ts` 共用去重键（`__FE_AUTH_403_DEDUP`）。
   * @param {{ url?: string, message?: string, source?: string }} [detail]
   */
  function handleAuthForbidden(detail) {
    const d = detail && typeof detail === 'object' ? detail : {};
    const raw = d.message != null ? String(d.message).trim() : '';
    const userText = raw !== '' ? raw : DEFAULT_FORBIDDEN_USER_MESSAGE;
    const dedupKey = userText;

    const now = Date.now();
    try {
      if (!global.__FE_AUTH_403_DEDUP) global.__FE_AUTH_403_DEDUP = { key: '', at: 0 };
      const slot = global.__FE_AUTH_403_DEDUP;
      if (slot.key === dedupKey && now - slot.at < FORBIDDEN_TOAST_DEDUP_MS) return;
      slot.key = dedupKey;
      slot.at = now;
    } catch {
      // ignore
    }

    try {
      console.warn('[FE:auth-403]', {
        status: 403,
        url: d.url || '',
        message: raw || userText,
        userMessage: userText,
        source: d.source || 'handleAuthForbidden',
      });
    } catch {
      // ignore
    }

    try {
      if (typeof global.showError === 'function') global.showError(userText);
      else global.alert(userText);
    } catch {
      try {
        global.alert(userText);
      } catch {
        // ignore
      }
    }
  }

  /**
   * @param {number} statusOrErr - HTTP 状态或占位
   * @param {{ url?: string, message?: string, source?: string }} [detail] - 诊断用（不记录 token 原文）
   */
  function handleAuthError(statusOrErr, detail) {
    const status = typeof statusOrErr === 'number' ? statusOrErr : null;
    if (status != null && status !== 401 && status !== 403) return;

    if (status === 403) {
      handleAuthForbidden(detail);
      return;
    }

    // 401：维持清 token + 跳转；保留 `[FE:auth-401]` 仅在调试开关开启时输出一次
    const d = detail && typeof detail === 'object' ? detail : {};
    if (isAuthDebugEnabled()) {
      try {
        if (!global.__FE_AUTH_FIRST_FAIL_LOGGED) {
          global.__FE_AUTH_FIRST_FAIL_LOGGED = true;
          console.warn('[FE:auth-401]', {
            status: 401,
            url: d.url || '',
            message: d.message || '',
            source: d.source || 'handleAuthError',
          });
        }
      } catch {
        // ignore
      }
    }

    try {
      if (globalThis.__FE_TASK8_IT_DESIGN_AUTO_SEQ_LOG === true) {
        console.warn('[FE:task8-it-design-auto-seq][auth-401-will-redirect-login]', {
          url: d.url || '',
          message: (d.message || '').slice(0, 400),
          source: d.source || '',
          taskTag: d.taskTag || '',
        });
      }
    } catch {
      // ignore
    }

    clearAuth();

    // FE-20260325-06：401 自动跳转登录前，清理在线案例相关缓存与视图态，避免跨账号残留（不做 owner 推断，仅做安全态收口）。
    try {
      if (typeof global.clearProblemCaseCachesAndUiStateOnLogout === 'function') {
        global.clearProblemCaseCachesAndUiStateOnLogout();
      }
    } catch {
      // ignore
    }

    // 已在登录页则只清会话、不再 location 跳转，避免重复加载、URL 套娃与「打开 DevTools 才正常」的竞态/闪烁感知
    if (isLoginPathname(global.location && global.location.pathname)) {
      try {
        if (isAuthDebugEnabled()) {
          console.warn('[FE:auth-401]', {
            skippedRedirect: 'already_on_login',
            pathname: global.location.pathname || '',
            source: d.source || 'handleAuthError',
          });
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const url = new URL(global.location.href);
      const redirect = url.pathname + url.search + url.hash;
      global.location.href =
        'login.html?redirect=' +
        encodeURIComponent(redirect) +
        '&auth_reason=auth&auth_status=' +
        encodeURIComponent(String(status || ''));
    } catch {
      global.location.href = 'login.html?auth_reason=auth';
    }
  }

  global.AUTH_RUNTIME = {
    AUTH_TOKEN_STORAGE_KEY,
    AUTH_ROLE_STORAGE_KEY,
    AUTH_USERNAME_STORAGE_KEY,
    AUTH_EXPIRES_AT_STORAGE_KEY,
    RENEWAL_HEADER_TOKEN,
    RENEWAL_HEADER_EXPIRES,
    getAuthToken,
    getCurrentRole,
    getUsername,
    setAuthToken,
    clearAuth,
    postLogoutToBackend,
    getAuthHeaders,
    applyAuthRenewalFromResponse,
    handleAuthError,
    handleAuthForbidden,
    handleAiConfigRequired,
    buildModelConfigUrl,
    isModelConfigPathname,
    isAuthDebugEnabled,
  };

  // 兼容写法：直接把函数挂到全局，便于 main.js/storage-http-adapter.js/bridge 调用
  global.getAuthToken = getAuthToken;
  global.getAuthHeaders = getAuthHeaders;
  global.getUsername = getUsername;
  global.applyAuthRenewalFromResponse = applyAuthRenewalFromResponse;
  global.handleAuthError = handleAuthError;
  global.handleAuthForbidden = handleAuthForbidden;
  global.handleAiConfigRequired = handleAiConfigRequired;
  global.postLogoutToBackend = postLogoutToBackend;

  // 刷新诊断：首屏门禁判断之前打印 token / expiresAt 是否存在（不打印密钥内容）
  try {
    if (isAuthDebugEnabled()) {
      const hasToken = Boolean(getAuthToken());
      let hasExpiresAt = false;
      try {
        hasExpiresAt = Boolean(global.localStorage.getItem(AUTH_EXPIRES_AT_STORAGE_KEY));
      } catch {
        // ignore
      }
      console.info('[FE:auth-refresh]', {
        hasToken,
        hasExpiresAt,
        pathname: global.location && global.location.pathname ? global.location.pathname : '',
      });
    }
  } catch {
    // ignore
  }

  /**
   * 业务入口首屏门禁：
   * 1. 缺 token：跳 `login.html`
   * 2. online + 普通用户 + 未完成个人模型配置：跳 `model-config.html`
   */
  try {
    const pathname = global.location && global.location.pathname ? global.location.pathname : '';
    const isLoginPage = isLoginPathname(pathname);
    const isAdminPage = isAdminPathname(pathname);

    if (isProtectedBusinessPathname(pathname) && !isLoginPage && !isAdminPage) {
      const token = getAuthToken();
      if (!token) {
        if (isAuthDebugEnabled()) {
          console.warn('[FE:auth-gate]', { reason: 'missing_token', trigger: 'first_screen_index' });
        }
        const redirectUrl = buildCurrentRedirect();
        global.location.href =
          'login.html?redirect=' + encodeURIComponent(redirectUrl) + '&auth_reason=gate';
      } else {
        void ensureAiConfigGateForCurrentPage();
      }
    }
  } catch {
    // ignore
  }
})(typeof window !== 'undefined' ? window : this);
