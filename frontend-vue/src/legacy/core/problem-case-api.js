/**
 * [INPUT]: `APP_CONFIG`、`getAuthHeaders`、`applyAuthRenewalFromResponse`、`handleAuthError`（均由首屏脚本注入 global）
 * [OUTPUT]: online 案例相关 HTTP 封装（problem-cases CRUD 周边、导入/导出/恢复、task action、bundle refresh 委托；设计详情任务进展工作区 GET/PUT/DELETE；设计详情推理图只读 GET design-detail/task-graph（非 2xx 时返回可读 `errorMessage`，便于弹层区分 404/鉴权/配置）；Task1 客户基本信息图 POST sync-task1-basic-info-graph；Task1 客户需求分域图 POST sync-customer-req-section-graph；任务 2 L1 Target_KV Feature_Key → token 行 POST sync-task2-l1-target-kv-tokens；任务 2 L1 推理图同步别名 POST sync-task2-l1-inference-graph（body 可省略 `l1InferenceRaw`、根即矩阵对象）；任务 3 L2 Target_KV POST sync-task3-l2-target-kv-tokens；任务 4 L2 Target_KV POST sync-task4-l2-target-kv-tokens；DELETE design-detail/task-graph 清空本案例全部推理图；DELETE design-detail/task-graph/:taskId；POST llm-logs/clear 按 taskId 或 `{ all: true }` 删案例 LLM 审计）
 * [POS]: Phase 1A 从 `main.js` 抽离的 API 层；业务编排与 UI 仍在 `main.js` bridge
 *
 * [PROTOCOL]: 变更契约或 path 时必须同步 `frontend/js/core/AGENTS.md` 与主记录覆盖表；非 2xx 时在控制台输出 `[problem-case-api] taskAction HTTP error` 便于排查回退等失败；`postClearCaseLlmLogsAll` 成功/失败时额外输出 **`[design-detail:full-restart]`** `http_llm_logs_clear_all_*`，与设计页顶栏对账；**`parseBackendErrorMessageForProblemCaseIo`** 遇 Express 默认页 `<pre>Cannot POST…</pre>` 时返回单行摘要（含 design-detail/sync 时的 build+重启提示），避免整页 HTML 进入进度文案
 */

function getBackendBaseUrl() {
  const cfg = typeof globalThis !== 'undefined' ? globalThis.APP_CONFIG || {} : {};
  return String(cfg.BACKEND_API_URL || '').replace(/\/$/, '');
}

function isOnlineMode() {
  return !!(globalThis.APP_CONFIG && globalThis.APP_CONFIG.MODE === 'online');
}

function maybeApplyAuthRenewal(res) {
  if (typeof globalThis.applyAuthRenewalFromResponse === 'function') {
    globalThis.applyAuthRenewalFromResponse(res);
  }
}

async function refreshProblemDetailBundle(caseId) {
  const adapter = globalThis.STORAGE_HTTP_ADAPTER;
  if (!adapter || typeof adapter.refreshProblemDetailBundle !== 'function') return null;
  return adapter.refreshProblemDetailBundle(caseId);
}

/**
 * @param {{ onAccessDenied?: (caseId: string, status: number) => void }} [hooks]
 */
async function postProblemCaseTaskAction(caseId, backendTaskId, action, payload, hooks) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId || !backendTaskId || !action) return null;
  const url = `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(backendTaskId)}/${action}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {}),
  });
  if (isOnlineMode() && typeof globalThis.applyAuthRenewalFromResponse === 'function') {
    globalThis.applyAuthRenewalFromResponse(res);
  }
  if (!res.ok) {
    if (res.status === 401 && typeof globalThis.handleAuthError === 'function') {
      let msg = '';
      try {
        const j = await res.clone().json().catch(() => ({}));
        msg = j && (j.message || j.error) ? String(j.message || j.error) : '';
      } catch (_) {}
      globalThis.handleAuthError(res.status, {
        url,
        message: msg,
        source: 'main:postProblemCaseTaskAction',
      });
      return null;
    }
    if (res.status === 403 || res.status === 404) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[problem-case-api] taskAction access denied / missing', {
          action,
          caseId,
          backendTaskId,
          url,
          status: res.status,
        });
      }
      if (hooks && typeof hooks.onAccessDenied === 'function') hooks.onAccessDenied(caseId, res.status);
      return null;
    }
    const txt = await res.text().catch(() => '');
    if (typeof console !== 'undefined' && console.error) {
      const maxPreview = 6000;
      console.error('[problem-case-api] taskAction HTTP error', {
        action,
        caseId,
        backendTaskId,
        url,
        status: res.status,
        bodyLength: txt.length,
        bodyPreview: txt.length > maxPreview ? `${txt.slice(0, maxPreview)}…(truncated, total ${txt.length} chars)` : txt,
      });
    }
    throw new Error(`taskAction ${action} failed: ${res.status} ${txt}`);
  }
  return res.json().catch(() => null);
}

/** 核心业务对象节点 checkpoint 已下线；保留占位避免旧代码调用抛错 */
async function putProblemCaseTask11StepCheckpoint() {
  return null;
}

/** Express 默认 HTML 404（`<pre>Cannot POST …</pre>`）：压缩为可读一行，避免整页 HTML 进 UI */
function summarizeExpressCannotMethodHtml(txt) {
  const s = String(txt || '').trim();
  if (!s.includes('<pre>')) return null;
  const m = /<pre>([^<]*)<\/pre>/i.exec(s);
  const inner = m ? String(m[1] || '').trim() : '';
  if (!inner || !/^Cannot (POST|GET|PUT|DELETE|PATCH)\s/i.test(inner)) return null;
  if (/\/design-detail\/sync-/.test(inner)) {
    return `${inner} — 多为监听端口上的后端仍是旧构建（未注册该路由），请在 backend 执行 npm run build 后重启；npm start 走 dist 时须先 build。`;
  }
  return `${inner} — 请核对后端版本与路由是否已部署并重试。`;
}

async function parseBackendErrorMessageForProblemCaseIo(res) {
  const txt = await res.text().catch(() => '');
  try {
    const j = JSON.parse(txt);
    if (j && typeof j.message === 'string') return j.message;
    if (j && typeof j.error === 'string') return j.error;
    if (Array.isArray(j.issues) && j.issues.length) {
      const first = j.issues[0];
      const pathStr = first && Array.isArray(first.path) ? first.path.join('.') : '';
      const im = first && typeof first.message === 'string' ? first.message : '';
      if (im) return (pathStr ? `${pathStr}: ` : '') + im;
    }
  } catch (_) {}
  const html404 = summarizeExpressCannotMethodHtml(txt);
  if (html404) return html404;
  return txt || `HTTP ${res.status}`;
}

function parseContentDispositionFilename(cd) {
  if (!cd || typeof cd !== 'string') return null;
  const star = /filename\*=(?:UTF-8'')?([^;\n]+)/i.exec(cd);
  if (star && star[1]) {
    try {
      return decodeURIComponent(star[1].replace(/"/g, '').trim());
    } catch (_) {
      return star[1].replace(/"/g, '').trim();
    }
  }
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(cd);
  if (quoted && quoted[1]) return quoted[1];
  const unquoted = /filename\s*=\s*([^;\s]+)/i.exec(cd);
  if (unquoted && unquoted[1]) return unquoted[1].replace(/"/g, '').trim();
  return null;
}

function extractImportedProblemCaseId(json) {
  if (!json || typeof json !== 'object') return null;
  return json.caseId || json.id || (json.case && json.case.id) || (json.problemCase && json.problemCase.id) || null;
}

async function fetchProblemCaseDetail(baseUrl, caseId) {
  const detailUrl = `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}`;
  const res = await fetch(detailUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
    },
    cache: 'no-store',
  });
  if (isOnlineMode() && typeof globalThis.applyAuthRenewalFromResponse === 'function') {
    globalThis.applyAuthRenewalFromResponse(res);
  }
  if (!res.ok) {
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    throw new Error(`已导入为新案例，但拉取详情失败：${msg}`);
  }
  const raw = await res.json();
  const item = raw && typeof raw === 'object' ? raw : null;
  if (!item) {
    throw new Error('已导入，但详情 JSON 无效。');
  }
  return item;
}

/**
 * @param {{ onAccessDenied?: (caseId: string, status: number) => void }} [hooks]
 */
async function fetchProblemCaseExport(caseId, hooks) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) {
    return { ok: false, errorKind: 'config', errorMessage: '未配置 BACKEND_API_URL 或案例 id 缺失。' };
  }
  const url = `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/export`;
  const headers = {
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, { method: 'GET', headers });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if (res.status === 401 && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false, errorKind: 'auth' };
    }
    if (res.status === 403 || res.status === 404) {
      if (hooks && typeof hooks.onAccessDenied === 'function') hooks.onAccessDenied(caseId, res.status);
      return { ok: false, errorKind: 'access', status: res.status };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    return { ok: false, errorKind: 'http', errorMessage: msg };
  }
  let filename = `problem-case-${caseId}.json`;
  const cd = res.headers.get('Content-Disposition');
  const fromCd = parseContentDispositionFilename(cd);
  if (fromCd) filename = fromCd;
  let pkg;
  try {
    pkg = await res.json();
  } catch (e) {
    return { ok: false, errorKind: 'parse', errorMessage: `响应不是合法 JSON（${e?.message || String(e)}）` };
  }
  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, errorKind: 'format', errorMessage: '案例包格式异常。' };
  }
  return { ok: true, pkg, filename };
}

/**
 * @param {{ onAccessDenied?: (caseId: string, status: number) => void }} [hooks] — import 无 caseId 时仅用于 401
 */
async function postProblemCaseImport(parsed, hooks) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return { ok: false, errorMessage: '未配置 BACKEND_API_URL。' };
  }
  const url = `${baseUrl}/problem-cases/import`;
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(parsed) });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    return { ok: false, errorMessage: msg };
  }
  if (res.status !== 201 && res.status !== 200) {
    return { ok: false, errorMessage: `导入响应异常：HTTP ${res.status}` };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data, status: res.status };
}

/**
 * @param {{ onAccessDenied?: (caseId: string, status: number) => void }} [hooks]
 */
async function postProblemCaseRestore(caseId, parsed, hooks) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) {
    return { ok: false, errorMessage: '未配置 BACKEND_API_URL 或案例 id 缺失。' };
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const url = `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/restore`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(parsed) });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    if (res.status === 404) {
      if (hooks && typeof hooks.onAccessDenied === 'function') hooks.onAccessDenied(caseId, 404);
      return { ok: false, errorKind: 'access' };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    return { ok: false, errorMessage: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

function designDetailProgressWorkspaceUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/progress-workspace`;
}

/** @returns {Promise<{ caseId?: string, payload?: unknown } | null>} */
async function getDesignDetailProgressWorkspace(caseId) {
  const url = designDetailProgressWorkspaceUrl(caseId);
  if (!url) return null;
  const headers = {
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, { method: 'GET', headers });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return null;
    }
    return null;
  }
  return res.json().catch(() => null);
}

/** @param {unknown} payload — 设计详情任务进展快照 JSON（须可 JSON 序列化）
 *  @returns {Promise<{ ok: boolean, status?: number }>}
 */
async function putDesignDetailProgressWorkspace(caseId, payload) {
  const url = designDetailProgressWorkspaceUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ payload }),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
    }
    return { ok: false, status: res.status };
  }
  return { ok: true, status: res.status };
}

async function deleteDesignDetailProgressWorkspace(caseId) {
  const url = designDetailProgressWorkspaceUrl(caseId);
  if (!url) return;
  const headers = {
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, { method: 'DELETE', headers });
  maybeApplyAuthRenewal(res);
  if (!res.ok && (res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
    const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
    globalThis.handleAuthError(res.status, { url, message: msg401 });
  }
}

function designDetailSyncTask1BasicInfoGraphUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task1-basic-info-graph`;
}

function designDetailSyncTask1L1OriginalFeatureMatrixUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task1-l1-original-feature-matrix`;
}

function designDetailSyncCustomerReqSectionGraphUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-customer-req-section-graph`;
}

function designDetailSyncTask2L1TargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task2-l1-target-kv-tokens`;
}

function designDetailSyncTask2L1InferenceGraphUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task2-l1-inference-graph`;
}

function designDetailSyncTask3L2TargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task3-l2-target-kv-tokens`;
}

function designDetailSyncTask4L2TargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task4-l2-target-kv-tokens`;
}

function designDetailSyncTask5L3TargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task5-l3-target-kv-tokens`;
}

function designDetailSyncTask51L3ValuePropositionTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task51-l3-value-proposition-target-kv-tokens`;
}

function designDetailSyncTask53L3WorkflowFlowTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task53-l3-workflow-flow-target-kv-tokens`;
}

function designDetailSyncTask52L3AssetFieldSetTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task52-l3-asset-field-set-target-kv-tokens`;
}

function designDetailSyncTask55L3VsmTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task55-l3-vsm-target-kv-tokens`;
}

function designDetailSyncTask6L3ScenarioTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task6-l3-scenario-target-kv-tokens`;
}

function designDetailSyncTask65L3ItGapTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task65-l3-it-gap-target-kv-tokens`;
}

function designDetailSyncTask7L4CollaborationTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task7-l4-collaboration-target-kv-tokens`;
}

function designDetailSyncTask0ToolboxPrimitivesUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task0-toolbox-primitives`;
}

function designDetailSyncTask8L45PrototypeTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task8-l45-prototype-target-kv-tokens`;
}

function designDetailSyncTask85L475PhysicalHookTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task85-l475-physical-hook-target-kv-tokens`;
}

function designDetailSyncTask9L5BlueprintTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task9-l5-blueprint-target-kv-tokens`;
}

function designDetailSyncTask10L5TechnicalDdlTargetKvTokensUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/sync-task10-l5-technical-ddl-target-kv-tokens`;
}

/** GET：按案例聚合各任务 token / feature / logic（只读） */
function designDetailTaskGraphBundleUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/task-graph`;
}

function designDetailTaskGraphUrl(caseId, taskId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId || !taskId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/task-graph/${encodeURIComponent(taskId)}`;
}

/**
 * @returns {Promise<{ ok: true, data: { caseId: string, tasks: unknown[] } } | { ok: false, errorMessage?: string, errorKind?: string }>}
 */
async function getDesignDetailTaskGraph(caseId) {
  const url = designDetailTaskGraphBundleUrl(caseId);
  if (!url) {
    const baseUrl = getBackendBaseUrl();
    return {
      ok: false,
      errorMessage: baseUrl
        ? '案例 ID 为空，无法请求推理图。'
        : '未配置 BACKEND_API_URL（或为空），无法请求推理图；请指向含 /api 的后端根，例如 https://host:port/api。',
    };
  }
  const headers = {
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, { method: 'GET', headers });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return {
        ok: false,
        errorMessage: msg401 && String(msg401).trim() ? String(msg401).trim() : '未授权或会话已失效，请重新登录后再试。',
      };
    }
    if (res.status === 404) {
      const msg404 = await parseBackendErrorMessageForProblemCaseIo(res);
      const trimmed = msg404 && String(msg404).trim() ? String(msg404).trim() : '';
      const hint =
        '若为线上环境，请确认后端已部署 GET …/problem-cases/:id/design-detail/task-graph，且 BACKEND_API_URL 与后端挂载的 /api 前缀一致。';
      return {
        ok: false,
        errorKind: 'access',
        errorMessage: trimmed || `找不到资源（404）。${hint}若接口存在，则可能是案例不存在或无权访问。`,
      };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    return { ok: false, errorMessage: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 删除某设计任务线步在后台的 token / 特征 / 逻辑边（级联） */
async function deleteDesignDetailTaskGraph(caseId, taskId) {
  const url = designDetailTaskGraphUrl(caseId, taskId);
  if (!url) return { ok: false };
  const headers = {
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, { method: 'DELETE', headers });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] delete task-graph HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  return { ok: true };
}

function designDetailClearInferenceRevisionRecordsUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/inference-revision-records/clear`;
}

/**
 * 清理 `DesignDetailInferenceRevisionRecord`。
 * @param {string} caseId
 * @param {{ scope: 'line_step' | 'from_line_step', lineStepId: string }} body
 */
async function clearDesignDetailInferenceRevisionRecords(caseId, body) {
  const url = designDetailClearInferenceRevisionRecordsUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] clear inference-revision-records HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  try {
    return { ok: true, ...(await res.json()) };
  } catch {
    return { ok: true };
  }
}

function designDetailResetTask1PainPointConfirmedUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/task1-pain-point-confirmed/reset`;
}

function designDetailMarkTask1ValidationResolvedUrl(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return '';
  return `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/design-detail/mark-task1-validation-resolved`;
}

/**
 * 重置任务 1 特征「是否确认痛点」。
 * @param {string} caseId
 * @param {{ scope: 'line_step' | 'from_line_step' | 'all', lineStepId?: string }} body
 */
async function resetDesignDetailTask1PainPointConfirmed(caseId, body) {
  const url = designDetailResetTask1PainPointConfirmedUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] reset task1 pain-point-confirmed HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  try {
    return { ok: true, ...(await res.json()) };
  } catch {
    return { ok: true };
  }
}

/**
 * 对齐后：任务 1 冲突节点 Validation_Status → Resolved_By_Customer。
 * @param {string} caseId
 * @param {{ targetFeatureIds: string[] }} body
 */
async function postDesignDetailMarkTask1ValidationResolved(caseId, body) {
  const url = designDetailMarkTask1ValidationResolvedUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] mark-task1-validation-resolved HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  try {
    return { ok: true, ...(await res.json()) };
  } catch {
    return { ok: true };
  }
}

/** 删除本案例全部设计详情推理图（级联 token / 特征 / 逻辑边） */
async function deleteAllDesignDetailTaskGraph(caseId) {
  const url = designDetailTaskGraphBundleUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, { method: 'DELETE', headers });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] delete all task-graph HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  return { ok: true };
}

/** Task1 经营信息提炼完成后：同步 DesignDetailTaskToken / DesignFeatureNode / DesignLogicLink */
async function postDesignDetailSyncTask1BasicInfoGraph(caseId, basicInfo) {
  const url = designDetailSyncTask1BasicInfoGraphUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ basicInfo: basicInfo ?? {} }),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task1-basic-info-graph HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/**
 * 任务 1 L1 原始实然特征集：同步 `L1_Original_Feature_Matrix.Target_KV`（含行级 `Validation_Status`）
 * @param {string} caseId
 * @param {string|Record<string, unknown>} l1OriginalFeatureRaw
 */
async function postDesignDetailSyncTask1L1OriginalFeatureMatrix(caseId, l1OriginalFeatureRaw) {
  const url = designDetailSyncTask1L1OriginalFeatureMatrixUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const body =
    typeof l1OriginalFeatureRaw === 'string'
      ? { l1OriginalFeatureRaw }
      : { l1OriginalFeatureRaw: l1OriginalFeatureRaw ?? {} };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task1-l1-original-feature-matrix HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/**
 * Task1 客户需求提炼：按顶层分域同步 DesignDetailTaskToken / DesignFeatureNode / DesignLogicLink（taskId = customer_requirement）
 * @param {string} caseId
 * @param {{ sectionKey: string, requirementParsed?: Record<string, unknown> }} body
 */
/**
 * 按 taskId 列表删除案例下 LLM 审计行（设计页「重启当前」与推理图清理对齐）
 * @param {string} caseId
 * @param {string[]} taskIds
 * @returns {Promise<{ ok: true, deleted: number } | { ok: false, status?: number, message?: string }>}
 */
async function postClearCaseLlmLogsByTaskIds(caseId, taskIds) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId || !Array.isArray(taskIds) || taskIds.length === 0) return { ok: false };
  const url = `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/llm-logs/clear`;
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ taskIds }),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] llm-logs/clear HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => ({}));
  const deleted = typeof data.deleted === 'number' && Number.isFinite(data.deleted) ? data.deleted : 0;
  if (typeof console !== 'undefined' && console.info) {
    console.info('[problem-case-api] llm-logs/clear ok', { caseId, taskIdsCount: taskIds.length, deleted });
  }
  return { ok: true, deleted };
}

/** 删除本案例下全部 LLM 审计行（设计页「完全重启」） */
async function postClearCaseLlmLogsAll(caseId) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl || !caseId) return { ok: false };
  const url = `${baseUrl}/problem-cases/${encodeURIComponent(caseId)}/llm-logs/clear`;
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ all: true }),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] llm-logs/clear all HTTP', res.status, msg);
    if (typeof console !== 'undefined' && console.info) {
      console.info('[design-detail:full-restart]', {
        phase: 'http_llm_logs_clear_all_http_error',
        caseId,
        status: res.status,
        message: msg,
      });
    }
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => ({}));
  const deleted = typeof data.deleted === 'number' && Number.isFinite(data.deleted) ? data.deleted : 0;
  if (typeof console !== 'undefined' && console.info) {
    console.info('[problem-case-api] llm-logs/clear ok', { caseId, mode: 'all', deleted });
    console.info('[design-detail:full-restart]', { phase: 'http_llm_logs_clear_all_ok', caseId, deleted });
  }
  return { ok: true, deleted };
}

async function postDesignDetailSyncCustomerReqSectionGraph(caseId, body) {
  const url = designDetailSyncCustomerReqSectionGraphUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-customer-req-section-graph HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 任务 2 L1：将 `Target_KV[].Feature_Key` 各写一条 `DesignDetailTaskToken`（`taskId` =「任务 2：规模与组织模式推理」；历史库可能仍为更名前中文） */
async function postDesignDetailSyncTask2L1TargetKvTokens(caseId, body) {
  const url = designDetailSyncTask2L1TargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task2-l1-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 任务 2 L1 推理图同步（与 target-kv-tokens 同落库；body 可传整份 `L1_Inference_Matrix` 根对象） */
async function postDesignDetailSyncTask2L1InferenceGraph(caseId, body) {
  const url = designDetailSyncTask2L1InferenceGraphUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task2-l1-inference-graph HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 任务 3 L2：将 `L2_Business_Inference_Matrix` / `L2_Inference_Matrix` 内 `Target_KV` 写入任务 3 推理图 token / 特征 / 逻辑边 */
async function postDesignDetailSyncTask3L2TargetKvTokens(caseId, body) {
  const url = designDetailSyncTask3L2TargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task3-l2-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 任务 4 L2：将 `L2_Value_Inference_Matrix.Target_KV` 写入任务 4 推理图 token / 特征 / 逻辑边 */
async function postDesignDetailSyncTask4L2TargetKvTokens(caseId, body) {
  const url = designDetailSyncTask4L2TargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task4-l2-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 任务 5 L3：将 `L3_Process_Inference_Matrix.Target_KV` 写入任务 5 推理图 */
async function postDesignDetailSyncTask5L3TargetKvTokens(caseId, body) {
  const url = designDetailSyncTask5L3TargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task5-l3-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 任务 5.1 L3.1：将战略价值主张与业务能力单元写入推理图 */
async function postDesignDetailSyncTask51L3ValuePropositionTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask51L3ValuePropositionTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task51-l3-value-proposition-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 任务 5.2 L3.2：将存量 Excel 字段集层次映射写入推理图 */
async function postDesignDetailSyncTask53L3WorkflowFlowTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask53L3WorkflowFlowTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task53-l3-workflow-flow-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

async function postDesignDetailSyncTask52L3AssetFieldSetTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask52L3AssetFieldSetTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task52-l3-asset-field-set-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

/** 任务 5.5 L3.5：将价值流阶段_* 写入任务 5.5 推理图 */
async function postDesignDetailSyncTask55L3VsmTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask55L3VsmTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task55-l3-vsm-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

async function postDesignDetailSyncTask7L4CollaborationTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask7L4CollaborationTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task7-l4-collaboration-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

async function postDesignDetailSyncTask85L475PhysicalHookTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask85L475PhysicalHookTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task85-l475-physical-hook-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

async function postDesignDetailSyncTask9L5BlueprintTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask9L5BlueprintTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task9-l5-blueprint-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

async function postDesignDetailSyncTask10L5TechnicalDdlTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask10L5TechnicalDdlTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task10-l5-technical-ddl-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

async function postDesignDetailSyncTask0ToolboxPrimitives(caseId, body) {
  const url = designDetailSyncTask0ToolboxPrimitivesUrl(caseId);
  if (!url) return { ok: false };
  const primLen = Array.isArray(body?.primitives) ? body.primitives.length : 0;
  try {
    console.info('[problem-case-api:task0-sync]', {
      phase: 'request',
      caseId,
      url,
      primitiveCount: primLen,
      sampleKeys: Array.isArray(body?.primitives)
        ? body.primitives.slice(0, 3).map((p) => p?.featureKey)
        : [],
    });
  } catch {
    /* ignore */
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api:task0-sync]', { phase: 'http_error', caseId, status: res.status, message: msg });
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  try {
    const features = data && Array.isArray(data.features) ? data.features : [];
    console.info('[problem-case-api:task0-sync]', {
      phase: 'response',
      caseId,
      status: res.status,
      tokenCount: data?.tokenCount,
      featureCount: data?.featureCount,
      featuresLen: features.length,
      sampleFeatureIds: features.slice(0, 3).map((f) => f?.featureId),
    });
  } catch {
    /* ignore */
  }
  return { ok: true, data };
}

async function postDesignDetailSyncTask8L45PrototypeTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask8L45PrototypeTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task8-l45-prototype-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

async function postDesignDetailSyncTask6L3ScenarioTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask6L3ScenarioTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task6-l3-scenario-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

async function postDesignDetailSyncTask65L3ItGapTargetKvTokens(caseId, body) {
  const url = designDetailSyncTask65L3ItGapTargetKvTokensUrl(caseId);
  if (!url) return { ok: false };
  const headers = {
    'Content-Type': 'application/json',
    ...(typeof globalThis.getAuthHeaders === 'function' ? globalThis.getAuthHeaders() : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  maybeApplyAuthRenewal(res);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && typeof globalThis.handleAuthError === 'function') {
      const msg401 = await parseBackendErrorMessageForProblemCaseIo(res.clone());
      globalThis.handleAuthError(res.status, { url, message: msg401 });
      return { ok: false };
    }
    const msg = await parseBackendErrorMessageForProblemCaseIo(res);
    console.warn('[problem-case-api] sync-task65-l3-it-gap-target-kv-tokens HTTP', res.status, msg);
    return { ok: false, status: res.status, message: msg };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

export const problemCaseApi = {
  getBackendBaseUrl,
  refreshProblemDetailBundle,
  postProblemCaseTaskAction,
  putProblemCaseTask11StepCheckpoint,
  parseBackendErrorMessageForProblemCaseIo,
  parseContentDispositionFilename,
  extractImportedProblemCaseId,
  fetchProblemCaseDetail,
  fetchProblemCaseExport,
  postProblemCaseImport,
  postProblemCaseRestore,
  getDesignDetailProgressWorkspace,
  putDesignDetailProgressWorkspace,
  deleteDesignDetailProgressWorkspace,
  postDesignDetailSyncTask1BasicInfoGraph,
  postDesignDetailSyncTask1L1OriginalFeatureMatrix,
  postDesignDetailSyncCustomerReqSectionGraph,
  postDesignDetailSyncTask2L1TargetKvTokens,
  postDesignDetailSyncTask2L1InferenceGraph,
  postDesignDetailSyncTask3L2TargetKvTokens,
  postDesignDetailSyncTask4L2TargetKvTokens,
  postDesignDetailSyncTask5L3TargetKvTokens,
  postDesignDetailSyncTask51L3ValuePropositionTargetKvTokens,
  postDesignDetailSyncTask52L3AssetFieldSetTargetKvTokens,
  postDesignDetailSyncTask53L3WorkflowFlowTargetKvTokens,
  postDesignDetailSyncTask55L3VsmTargetKvTokens,
  postDesignDetailSyncTask6L3ScenarioTargetKvTokens,
  postDesignDetailSyncTask65L3ItGapTargetKvTokens,
  postDesignDetailSyncTask7L4CollaborationTargetKvTokens,
  postDesignDetailSyncTask0ToolboxPrimitives,
  postDesignDetailSyncTask8L45PrototypeTargetKvTokens,
  postDesignDetailSyncTask85L475PhysicalHookTargetKvTokens,
  postDesignDetailSyncTask9L5BlueprintTargetKvTokens,
  postDesignDetailSyncTask10L5TechnicalDdlTargetKvTokens,
  getDesignDetailTaskGraph,
  deleteDesignDetailTaskGraph,
  deleteAllDesignDetailTaskGraph,
  clearDesignDetailInferenceRevisionRecords,
  resetDesignDetailTask1PainPointConfirmed,
  postDesignDetailMarkTask1ValidationResolved,
  postClearCaseLlmLogsByTaskIds,
  postClearCaseLlmLogsAll,
};

if (typeof globalThis !== 'undefined') {
  globalThis.SmartCto = globalThis.SmartCto || {};
  globalThis.SmartCto.problemCaseApi = problemCaseApi;
}
