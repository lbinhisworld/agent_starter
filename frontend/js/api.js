/**
 * [INPUT]: messages（对话消息数组）；可选 options（online：taskTag / maxOutputTokens）
 * [OUTPUT]: {content, usage, model, durationMs, finishReason?, truncated?, maxOutputTokens?}
 * [POS]: 统一封装 DeepSeek（local 直连 / online 走后端代理）的调用能力
 *
 * [PROTOCOL]: 如果调整了 local 的流式/非流式实现方式或返回字段，请同步更新此 Header；online 受保护响应会调用 `auth-runtime.applyAuthRenewalFromResponse`，但同 token 会话下不再覆盖本地 token；online `/ai/chat` 的 **JWT** 401/403 走 `handleAuthError`；上游模型 Key 无效时后端应返回 502 + `AI_UPSTREAM_AUTH_FAILED`（或旧版英文 401），前端走 `handleAiConfigRequired`、**不**清 token（FE-20260408）。`taskTag` 以 `task8-it-design` 开头且异常响应时输出 `[FE:task8-it-design-ai]`。
 * FE-20260324-31：online `fetch('/ai/chat')` 与 local 直连均带 `AbortSignal` 超时（默认 online 180s / local 90s）；可选 `options.timeoutMs`（15s～600s）避免挂死；审计等长任务可传更大 `timeoutMs`。
 * FE-20260331-47：`options.taskTag === 'task4'` 且 `globalThis.__FE_TASK4_LLM_DEBUG === true` 时，在 fetch 前后/超时分支打 `[FE:task4-llm][api]` 日志（消息体量与 `timeoutMs`），与 `task4ValueStream.js` 编排层日志对照排查二阶段超时。
 * FE-20260403：`taskTag` 为 `task1-prelim-depth-v2` / `task1-prelim-refine` / `task1-prelim-merge` / `tool-experience-capability` 时，local 直连走**非流式** + `response_format: json_object` + `max_tokens`（`taskUsesLocalJsonObjectMode`），与 online 后端代理一致，降低 JSON 被模型混入非法引号或说明文字的概率。
 * FE-20260413：工具经验「沉淀知识树」`fetchToolExpKnowledgeTree` / `saveToolExpKnowledgeTree`：online 已登录走 `/me/tool-experience/knowledge-tree`，否则仅读写 localStorage（与上传历史并存）。**FE-20260413-02**：`fetchToolExpChatState` / `saveToolExpChatState` 对话区同上，路径 `/me/tool-experience/chat-state`。**FE-20260413-03**：上述 PUT 若 HTTP 404，错误文案提示重建并重启后端（旧 dist 或未加载本仓库路由时常见）。
 * FE-20260506：可选 `llmLog` / `SmartCto.designDetailLlmLogContext`；online `/ai/chat` 代理落 `ProblemCaseLlmLog`；local 直连成功且已 Bearer + `BACKEND_API_URL` 时 `POST /problem-cases/:id/llm-logs` 补记。
 * FE-20260507：local 补记须 **`await maybePostCaseLlmLogAfterLocalSuccess`**（禁止 `void`），保证 Promise 在落库尝试结束后再 resolve，避免设计详情「LLM 调用详情」等依赖 `withDesignDetailLlmLogContext.finally` 的刷新早于 POST 完成仍见旧数据。**FE-20260508**：`fetchDeepSeekChat` 支持 `options.signal` 与超时 `AbortSignal` 合并，避免「完全重启」已清库后旧 `/ai/chat` 成功返回再次写入 `ProblemCaseLlmLog`。
 */
(function (global) {
  const cfg = global.APP_CONFIG || {};
  const mode = (cfg.MODE || 'local');
  const DEEPSEEK_API_URL = cfg.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  const DEEPSEEK_API_KEY = cfg.DEEPSEEK_API_KEY || '';
  const DEEPSEEK_MODEL = cfg.DEEPSEEK_MODEL || 'deepseek-chat';
  const BACKEND_API_URL = (cfg.BACKEND_API_URL || '').replace(/\/$/, '');

  /**
   * 调用 DeepSeek Chat Completion 接口（local 采用 stream=true，在线采用后端代理）。
   * @param {Array<{role: string, content: string}>} messages - 对话消息数组。
   * @param {{ taskTag?: string, maxOutputTokens?: number, timeoutMs?: number, signal?: AbortSignal, llmLog?: { caseId: string, taskId: string, callTarget: string } }} [options] - online 时透传后端 /api/ai/chat；`llmLog` 与 `SmartCto.designDetailLlmLogContext` 二选一供案例级审计落库（online 由代理写；local 直连成功且已登录后端时 POST 补记）。**FE-20260508**：可选 `signal` 与内置超时合并，供设计详情「完全重启」取消进行中的请求。
   * @returns {Promise<{content: string, usage: Object, model: string, durationMs: number, finishReason?: string, truncated?: boolean, maxOutputTokens?: number}>} 模型返回结果。
   */
  function resolveFetchTimeoutMs(opts, defaultMs) {
    const raw = opts && opts.timeoutMs != null ? Number(opts.timeoutMs) : NaN;
    if (!Number.isFinite(raw)) return defaultMs;
    return Math.max(15_000, Math.min(Math.floor(raw), 600_000));
  }

  /**
   * 合并「超时中止」与业务侧传入的 `AbortSignal`（如设计详情「完全重启」取消进行中的 /ai/chat）。
   * @param {AbortController} timeoutController
   * @param {AbortSignal|undefined|null} userSignal
   * @returns {AbortSignal}
   */
  function mergeTimeoutAndUserAbortSignals(timeoutController, userSignal) {
    if (!userSignal) return timeoutController.signal;
    try {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
        return AbortSignal.any([timeoutController.signal, userSignal]);
      }
    } catch (_) {}
    userSignal.addEventListener(
      'abort',
      () => {
        try {
          timeoutController.abort();
        } catch (_) {}
      },
      { once: true },
    );
    return timeoutController.signal;
  }

  /** 显式 `options.llmLog` 优先；否则读 `SmartCto.designDetailLlmLogContext`（设计详情 task1 等） */
  function resolveLlmLogForRequest(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const direct = o.llmLog;
    if (direct && direct.caseId && direct.taskId && direct.callTarget) {
      return {
        caseId: String(direct.caseId).trim(),
        taskId: String(direct.taskId).trim(),
        callTarget: String(direct.callTarget).trim(),
      };
    }
    try {
      const ctx = global.SmartCto && global.SmartCto.designDetailLlmLogContext;
      if (ctx && ctx.caseId && ctx.taskId && ctx.callTarget) {
        return {
          caseId: String(ctx.caseId).trim(),
          taskId: String(ctx.taskId).trim(),
          callTarget: String(ctx.callTarget).trim(),
        };
      }
    } catch (_) {}
    return null;
  }

  function hasBearerForBackendCaseApi() {
    const h = typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {};
    const a = h && h.Authorization;
    return typeof a === 'string' && a.length > 12;
  }

  /** local 直连成功后补记（online 已由 /api/ai/chat 落库，禁止重复 POST） */
  async function maybePostCaseLlmLogAfterLocalSuccess(messages, outputContent, usage, durationMs, modelName, llmLogCtx) {
    if (!llmLogCtx || mode === 'online') return;
    if (!BACKEND_API_URL || !hasBearerForBackendCaseApi()) return;
    const inputPrompt = (Array.isArray(messages) ? messages : [])
      .map((m) => {
        const r = m && m.role != null ? String(m.role) : '?';
        const c = m && m.content != null ? String(m.content) : '';
        return '[' + r + ']\n' + c;
      })
      .join('\n\n');
    const pt = usage && usage.prompt_tokens != null ? Number(usage.prompt_tokens) : NaN;
    const ct = usage && usage.completion_tokens != null ? Number(usage.completion_tokens) : NaN;
    const url = BACKEND_API_URL + '/problem-cases/' + encodeURIComponent(llmLogCtx.caseId) + '/llm-logs';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {}),
        },
        body: JSON.stringify({
          taskId: llmLogCtx.taskId,
          callTarget: llmLogCtx.callTarget,
          inputPrompt,
          inputTokens: Number.isFinite(pt) ? pt : null,
          outputContent: String(outputContent || ''),
          outputTokens: Number.isFinite(ct) ? ct : null,
          durationMs: Math.max(0, Math.floor(Number(durationMs) || 0)),
          model: modelName != null ? String(modelName) : null,
        }),
      });
      if (typeof global.applyAuthRenewalFromResponse === 'function') global.applyAuthRenewalFromResponse(res);
      if (!res.ok && typeof console !== 'undefined' && console.warn) {
        const txt = await res.text().catch(function () { return ''; });
        console.warn('[api.js] case llm-log POST failed', res.status, txt.slice(0, 500));
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[api.js] case llm-log POST error', e);
    }
  }

  function summarizeMessagesCharLens(messages) {
    if (!Array.isArray(messages)) return { count: 0, totalChars: 0, byRole: {} };
    const byRole = {};
    let totalChars = 0;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const len = m && m.content != null ? String(m.content).length : 0;
      totalChars += len;
      const r = (m && m.role) || '?';
      byRole[r] = (byRole[r] || 0) + len;
    }
    return { count: messages.length, totalChars, byRole };
  }

  /** 旧后端将上游 401 原样透出时，与 JWT 401 区分，避免误清 token */
  function looksLikeUpstreamAiApiKey401(httpStatus, body) {
    if (httpStatus !== 401) return false;
    const msg = body && body.message != null ? String(body.message).toLowerCase() : '';
    if (!msg) return false;
    if (msg.includes('api key') && (msg.includes('invalid') || msg.includes('incorrect'))) return true;
    if (msg.includes('authentication fails')) return true;
    if (msg.includes('invalid api key')) return true;
    return false;
  }

  async function fetchDeepSeekChat(messages, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const task4Dbg = opts.taskTag === 'task4' && typeof globalThis !== 'undefined' && globalThis.__FE_TASK4_LLM_DEBUG === true;
    if (mode === 'online') {
      const taskTagStr = String(opts.taskTag || '');
      const authHeaders = (typeof global.getAuthHeaders === 'function') ? global.getAuthHeaders() : {};
      const llmLogCtxOnline = resolveLlmLogForRequest(opts);
      const body = {
        messages,
        ...(opts.taskTag != null && opts.taskTag !== '' ? { taskTag: String(opts.taskTag) } : {}),
        ...(opts.maxOutputTokens != null && Number.isFinite(Number(opts.maxOutputTokens))
          ? { maxOutputTokens: Number(opts.maxOutputTokens) }
          : {}),
        ...(llmLogCtxOnline ? { llmLog: llmLogCtxOnline } : {}),
      };
      const timeoutMs = resolveFetchTimeoutMs(opts, 180_000);
      if (task4Dbg) {
        console.log('[FE:task4-llm][api]', {
          lane: 'online',
          phase: 'before_fetch',
          timeoutMs,
          maxOutputTokens: opts.maxOutputTokens,
          ...summarizeMessagesCharLens(messages),
        });
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const fetchSignal = mergeTimeoutAndUserAbortSignals(controller, opts.signal);
      let res;
      try {
        res = await fetch(BACKEND_API_URL + '/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body),
          signal: fetchSignal,
        });
      } catch (fetchErr) {
        const name = fetchErr && fetchErr.name;
        const msg = fetchErr && fetchErr.message ? String(fetchErr.message) : '';
        if (task4Dbg) {
          console.warn('[FE:task4-llm][api]', {
            lane: 'online',
            phase: 'fetch_error',
            timeoutMs,
            errName: name,
            errMsg: msg,
            isAbort: name === 'AbortError' || /aborted/i.test(msg),
            ...summarizeMessagesCharLens(messages),
          });
        }
        if (name === 'AbortError' || /aborted/i.test(msg)) {
          throw new Error(`AI 请求超时（已超过 ${Math.round(timeoutMs / 1000)} 秒）。请稍后重试、缩小上下文，或检查网络与后端代理。`);
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }
      if (typeof global.applyAuthRenewalFromResponse === 'function') global.applyAuthRenewalFromResponse(res);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          taskTagStr.startsWith('task8-it-design') &&
          (res.status === 401 || res.status === 403 || res.status === 428 || res.status === 502)
        ) {
          try {
            console.warn('[FE:task8-it-design-ai]', {
              phase: 'online_ai_chat_not_ok',
              httpStatus: res.status,
              taskTag: taskTagStr,
              message: data && data.message != null ? String(data.message) : '',
              code: data && (data.code != null ? data.code : data.errorCode),
            });
          } catch (_) {}
        }
        const aiConfigRequired =
          res.status === 428 ||
          (data && (data.code === 'AI_CONFIG_REQUIRED' || data.errorCode === 'AI_CONFIG_REQUIRED'));
        if (aiConfigRequired && typeof global.handleAiConfigRequired === 'function') {
          global.handleAiConfigRequired({
            url: BACKEND_API_URL + '/ai/chat',
            message: data && data.message ? String(data.message) : '',
            source: 'frontend/js/api.js',
          });
        }
        const upstreamAuthFailed =
          res.status === 502 &&
          data &&
          (data.code === 'AI_UPSTREAM_AUTH_FAILED' || data.errorCode === 'AI_UPSTREAM_AUTH_FAILED');
        if (upstreamAuthFailed && typeof global.handleAiConfigRequired === 'function') {
          global.handleAiConfigRequired({
            url: BACKEND_API_URL + '/ai/chat',
            message:
              data && data.message
                ? String(data.message)
                : '模型服务商鉴权失败，请检查个人模型配置中的 API Key 是否有效。',
            source: 'api.js:fetchDeepSeekChat-upstream-auth',
          });
        }
        if (
          (res.status === 401 || res.status === 403) &&
          typeof global.handleAuthError === 'function' &&
          !looksLikeUpstreamAiApiKey401(res.status, data)
        ) {
          global.handleAuthError(res.status, {
            url: BACKEND_API_URL + '/ai/chat',
            message: data && data.message ? String(data.message) : '',
            source: 'api.js:fetchDeepSeekChat',
            taskTag: taskTagStr,
          });
        }
        if (looksLikeUpstreamAiApiKey401(res.status, data) && typeof global.handleAiConfigRequired === 'function') {
          global.handleAiConfigRequired({
            url: BACKEND_API_URL + '/ai/chat',
            message: data && data.message ? String(data.message) : '',
            source: 'api.js:fetchDeepSeekChat-legacy-upstream-401',
          });
        }
        throw new Error(data.message || 'AI 请求失败');
      }
      const out = {
        content: (data.content || '').trim(),
        usage: data.usage || {},
        model: data.model || DEEPSEEK_MODEL,
        durationMs: data.durationMs || 0,
        finishReason: data.finishReason,
        truncated: data.truncated === true,
        maxOutputTokens: data.maxOutputTokens,
      };
      if (task4Dbg) {
        console.log('[FE:task4-llm][api]', {
          lane: 'online',
          phase: 'after_fetch',
          httpOk: true,
          durationMs: out.durationMs,
          responseChars: out.content.length,
          usage: out.usage,
          finishReason: out.finishReason,
          truncated: out.truncated,
        });
      }
      return out;
    }

    /** task1 初步需求 V2 / 工具经验页：JSON Object 模式（提示词须含 JSON 字样以满足 DeepSeek json_mode）。 */
    function taskUsesLocalJsonObjectMode(o) {
      const t = String((o && o.taskTag) || '');
      return (
        t === 'task1-prelim-depth-v2' ||
        t === 'task1-prelim-refine' ||
        t === 'task1-prelim-merge' ||
        t === 'tool-experience-capability'
      );
    }

    async function fetchLocalDeepSeekJsonObjectMode(msgs, o) {
      const localTimeoutMs = resolveFetchTimeoutMs(o, 180_000);
      const maxTok =
        o.maxOutputTokens != null && Number.isFinite(Number(o.maxOutputTokens))
          ? Math.min(8192, Math.max(256, Math.floor(Number(o.maxOutputTokens))))
          : 8192;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), localTimeoutMs);
      const jsonFetchSignal = mergeTimeoutAndUserAbortSignals(controller, o.signal);
      try {
        const res = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: msgs,
            stream: false,
            response_format: { type: 'json_object' },
            max_tokens: maxTok,
          }),
          signal: jsonFetchSignal,
        });
        const raw = await res.text();
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (_) {
          data = {};
        }
        if (!res.ok) {
          const msg = data?.error?.message || data?.message || raw || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error));
        const choice = data.choices?.[0];
        const content = (choice?.message?.content ?? '').trim();
        return {
          content,
          usage: data.usage || {},
          finishReason: choice?.finish_reason,
          truncated: choice?.finish_reason === 'length',
          maxOutputTokens: maxTok,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (taskUsesLocalJsonObjectMode(opts)) {
      const startJson = Date.now();
      const runJson = async () => fetchLocalDeepSeekJsonObjectMode(messages, opts);
      let jr;
      try {
        jr = await runJson();
      } catch (err) {
        const name = err && err.name;
        const msg = err?.message || String(err || '');
        if (name === 'AbortError' || /aborted/i.test(msg)) {
          const localTimeoutMs = resolveFetchTimeoutMs(opts, 180_000);
          throw new Error(
            `DeepSeek 直连请求超时（已超过 ${Math.round(localTimeoutMs / 1000)} 秒）。请稍后重试或缩小上下文；也可切换 online 模式走后端代理。`,
          );
        }
        const networkLike = /Failed to fetch|NetworkError|ERR_HTTP2_PROTOCOL_ERROR|Load failed|aborted/i.test(msg);
        if (!networkLike) throw err;
        await new Promise((r) => setTimeout(r, 350));
        jr = await runJson();
      }
      const durationMs = Date.now() - startJson;
      const trimmedJ = (jr.content || '').trim();
      const llmLogJson = resolveLlmLogForRequest(opts);
      await maybePostCaseLlmLogAfterLocalSuccess(messages, trimmedJ, jr.usage || {}, durationMs, DEEPSEEK_MODEL, llmLogJson);
      return {
        content: trimmedJ,
        usage: jr.usage || {},
        model: DEEPSEEK_MODEL,
        durationMs,
        finishReason: jr.finishReason,
        truncated: jr.truncated === true,
        maxOutputTokens: jr.maxOutputTokens,
      };
    }

    const start = Date.now();

    // 说明：浏览器直连 DeepSeek 偶发出现 HTTP/2 协议层错误（如 ERR_HTTP2_PROTOCOL_ERROR）。
    // 这里做一次短暂重试，并补充可读的错误信息，避免业务层拿到模糊异常。
    const requestOnce = async () => {
      const controller = new AbortController();
      const localTimeoutMs = resolveFetchTimeoutMs(opts, 90_000);
      if (task4Dbg) {
        console.log('[FE:task4-llm][api]', {
          lane: 'local',
          phase: 'before_fetch_attempt',
          timeoutMs: localTimeoutMs,
          maxOutputTokens: opts.maxOutputTokens,
          ...summarizeMessagesCharLens(messages),
        });
      }
      const timeoutId = setTimeout(() => controller.abort(), localTimeoutMs);
      const streamFetchSignal = mergeTimeoutAndUserAbortSignals(controller, opts.signal);
      try {
        const res = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            stream: true,
            // 让最后一个 SSE chunk 携带 usage，方便我们返回一致的 usage 字段
            stream_options: { include_usage: true },
          }),
          signal: streamFetchSignal,
        });
        if (!res.ok) {
          const raw = await res.text();
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch (_) {
            data = {};
          }
          const msg = data?.error?.message || data?.message || raw || `HTTP ${res.status}`;
          throw new Error(msg);
        }

        // 兼容：如果浏览器拿不到流，则退回非 stream 的解析逻辑（避免硬失败）。
        if (!res.body) {
          const raw = await res.text();
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch (_) {
            data = {};
          }
          if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error));
          return {
            content: (data.choices?.[0]?.message?.content ?? '').trim(),
            usage: data.usage || {},
          };
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let content = '';
        let usage = {};
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const s = line.trim();
            if (!s.startsWith('data:')) continue;
            const dataStr = s.slice(5).trim();
            if (dataStr === '[DONE]') {
              return { content, usage };
            }
            if (!dataStr) continue;

            let chunk = null;
            try {
              chunk = JSON.parse(dataStr);
            } catch (_) {
              // SSE data 行偶发非 JSON（或被切分），直接跳过等待下一段。
              continue;
            }

            const delta = chunk?.choices?.[0]?.delta || {};
            const piece = delta?.content ?? delta?.reasoning_content ?? delta?.message?.content ?? '';
            if (piece) content += piece;

            // include_usage=true 时，可能会在 DONE 前收到 usage chunk
            if (chunk?.usage && chunk.usage !== null) usage = chunk.usage;
          }
        }
        return { content, usage };
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let content = '';
    let usage = {};
    try {
      const result = await requestOnce();
      content = result.content || '';
      usage = result.usage || {};
    } catch (err) {
      const name = err && err.name;
      const msg = err?.message || String(err || '');
      if (task4Dbg) {
        console.warn('[FE:task4-llm][api]', {
          lane: 'local',
          phase: 'fetch_error',
          timeoutMs: resolveFetchTimeoutMs(opts, 90_000),
          errName: name,
          errMsg: msg,
          isAbort: name === 'AbortError' || /aborted/i.test(msg),
          ...summarizeMessagesCharLens(messages),
        });
      }
      if (name === 'AbortError' || /aborted/i.test(msg)) {
        const timeoutMs = resolveFetchTimeoutMs(opts, 90_000);
        throw new Error(
          `DeepSeek 直连请求超时（已超过 ${Math.round(timeoutMs / 1000)} 秒）。请稍后重试或缩小上下文；也可切换 online 模式走后端代理。`
        );
      }
      const networkLike =
        /Failed to fetch|NetworkError|ERR_HTTP2_PROTOCOL_ERROR|Load failed|aborted/i.test(msg);
      if (!networkLike) throw err;
      await new Promise((r) => setTimeout(r, 350));
      try {
        const result = await requestOnce();
        content = result.content || '';
        usage = result.usage || {};
      } catch (retryErr) {
        const retryMsg = retryErr?.message || String(retryErr || '');
        throw new Error(
          `DeepSeek 直连请求失败（可能为网络/HTTP2链路波动）：${retryMsg}。` +
          `建议稍后重试，或切换 online 模式通过后端代理调用。`
        );
      }
    }

    const durationMs = Date.now() - start;
    const trimmed = content.trim();
    if (task4Dbg) {
      console.log('[FE:task4-llm][api]', {
        lane: 'local',
        phase: 'after_fetch',
        durationMs,
        responseChars: trimmed.length,
        usage,
      });
    }
    const llmLogLocal = resolveLlmLogForRequest(opts);
    await maybePostCaseLlmLogAfterLocalSuccess(messages, trimmed, usage, durationMs, DEEPSEEK_MODEL, llmLogLocal);
    return { content: trimmed, usage, model: DEEPSEEK_MODEL, durationMs, finishReason: undefined, truncated: false, maxOutputTokens: undefined };
  }

  /** 判断 online 代理返回是否因长度截断（与后端 finishReason / truncated 对齐） */
  function isAiChatTruncatedResponse(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.truncated === true) return true;
    return data.finishReason === 'length';
  }

  /** 是否有 AI 配置 */
  function hasAiConfig() {
    return mode === 'online' ? Boolean(BACKEND_API_URL) : Boolean(DEEPSEEK_API_KEY);
  }

  const TOOL_EXP_KNOWLEDGE_STORAGE_KEY = 'toolExperience.knowledgeTree.v1';

  function emptyToolExpKnowledgePayload() {
    return { version: 1, productEntries: [], comparisonEntries: [], scenarioEntries: [] };
  }

  function normalizeToolExpKnowledgePayload(p) {
    if (!p || typeof p !== 'object') return emptyToolExpKnowledgePayload();
    return {
      version: 1,
      productEntries: Array.isArray(p.productEntries) ? p.productEntries : [],
      comparisonEntries: Array.isArray(p.comparisonEntries) ? p.comparisonEntries : [],
      scenarioEntries: Array.isArray(p.scenarioEntries) ? p.scenarioEntries : [],
    };
  }

  function readLocalToolExpKnowledgeTree() {
    try {
      const raw = localStorage.getItem(TOOL_EXP_KNOWLEDGE_STORAGE_KEY);
      if (!raw) return emptyToolExpKnowledgePayload();
      const parsed = JSON.parse(raw);
      return normalizeToolExpKnowledgePayload(parsed);
    } catch {
      return emptyToolExpKnowledgePayload();
    }
  }

  function writeLocalToolExpKnowledgeTree(payload) {
    try {
      localStorage.setItem(TOOL_EXP_KNOWLEDGE_STORAGE_KEY, JSON.stringify(normalizeToolExpKnowledgePayload(payload)));
    } catch (e) {
      console.warn('[tool-exp-knowledge] localStorage write failed', e);
    }
  }

  function hasBearerForKnowledgeTree() {
    const h = typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {};
    const a = h && h.Authorization;
    return typeof a === 'string' && a.length > 12;
  }

  /** 工具经验远程保存失败时的可读文案（404 多为后端未含本仓库 tool-experience 路由或指错端口） */
  function toolExpRemoteSaveErrorMessage(label, status, data) {
    const serverMsg =
      data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : '';
    const base = serverMsg || `${label}保存失败（HTTP ${status}）`;
    if (status === 404) {
      return `${base}。服务端未注册该路径：请在仓库 backend 目录执行 npm run build 后重启 Node 进程（本地勿长期用 -SkipBuild 跳过构建），并确认 frontend 的 BACKEND_API_URL（以 /api 结尾）与当前监听端口一致。`;
    }
    return base;
  }

  /**
   * 加载工具经验知识树：online 且已带 Bearer 时优先 GET 后端并回写本地缓存；否则仅本地。
   * @returns {Promise<{version:number,productEntries:Array,comparisonEntries:Array,scenarioEntries:Array}>}
   */
  async function fetchToolExpKnowledgeTree() {
    if (mode === 'online' && BACKEND_API_URL && hasBearerForKnowledgeTree()) {
      try {
        const authHeaders = global.getAuthHeaders();
        const res = await fetch(`${BACKEND_API_URL}/me/tool-experience/knowledge-tree`, {
          method: 'GET',
          headers: { ...authHeaders },
        });
        if (typeof global.applyAuthRenewalFromResponse === 'function') {
          global.applyAuthRenewalFromResponse(res);
        }
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.payload && typeof data.payload === 'object') {
            const synced = normalizeToolExpKnowledgePayload(data.payload);
            writeLocalToolExpKnowledgeTree(synced);
            return synced;
          }
        }
      } catch (e) {
        console.warn('[tool-exp-knowledge] remote fetch failed, fallback local', e);
      }
    }
    return readLocalToolExpKnowledgeTree();
  }

  /**
   * 保存知识树：始终写 localStorage；online 已登录时再 PUT 后端。
   * @param {Object} payload - { productEntries, comparisonEntries, scenarioEntries }
   */
  async function saveToolExpKnowledgeTree(payload) {
    const normalized = normalizeToolExpKnowledgePayload(payload);
    writeLocalToolExpKnowledgeTree(normalized);
    if (mode === 'online' && BACKEND_API_URL && hasBearerForKnowledgeTree()) {
      const res = await fetch(`${BACKEND_API_URL}/me/tool-experience/knowledge-tree`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {}),
        },
        body: JSON.stringify({ payload: normalized }),
      });
      if (typeof global.applyAuthRenewalFromResponse === 'function') {
        global.applyAuthRenewalFromResponse(res);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(toolExpRemoteSaveErrorMessage('知识树', res.status, data));
      }
    }
    return normalized;
  }

  const TOOL_EXP_CHAT_STORAGE_KEY = 'toolExperience.chatState.v1';

  function emptyToolExpChatState() {
    return { version: 1, messages: [], inputDraft: '' };
  }

  function readNullableTokenNum(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  /** 与后端归一化对齐：去掉 parsing 占位、裁剪体量 */
  function normalizeToolExpChatState(p) {
    const empty = emptyToolExpChatState();
    if (!p || typeof p !== 'object') return empty;
    const rawList = Array.isArray(p.messages) ? p.messages : [];
    const messages = [];
    for (let i = 0; i < rawList.length && messages.length < 400; i++) {
      const m = rawList[i];
      if (!m || typeof m !== 'object') continue;
      if (m.parsing === true) continue;
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      if (typeof m.key !== 'string' || !m.key) continue;
      const row = { key: m.key.slice(0, 200), role: m.role };
      if (typeof m.content === 'string' && m.content.length) {
        row.content = m.content.length > 500000 ? m.content.slice(0, 500000) : m.content;
      }
      if (m.kind === 'tool-exp-done' || m.kind === 'tool-exp-tree') row.kind = m.kind;
      if (m.meta && typeof m.meta === 'object') {
        const meta = m.meta;
        row.meta = {
          model: String(meta.model != null ? meta.model : '').slice(0, 500) || '—',
          durationMs:
            typeof meta.durationMs === 'number' && Number.isFinite(meta.durationMs)
              ? meta.durationMs
              : 0,
          promptTokens: readNullableTokenNum(meta.promptTokens),
          completionTokens: readNullableTokenNum(meta.completionTokens),
          totalTokens: readNullableTokenNum(meta.totalTokens),
        };
      }
      messages.push(row);
    }
    const inputDraft =
      typeof p.inputDraft === 'string'
        ? p.inputDraft.length > 100000
          ? p.inputDraft.slice(0, 100000)
          : p.inputDraft
        : '';
    return { version: 1, messages, inputDraft };
  }

  function readLocalToolExpChatState() {
    try {
      const raw = localStorage.getItem(TOOL_EXP_CHAT_STORAGE_KEY);
      if (!raw) return emptyToolExpChatState();
      const parsed = JSON.parse(raw);
      return normalizeToolExpChatState(parsed);
    } catch {
      return emptyToolExpChatState();
    }
  }

  function writeLocalToolExpChatState(state) {
    try {
      const n = normalizeToolExpChatState(state);
      localStorage.setItem(TOOL_EXP_CHAT_STORAGE_KEY, JSON.stringify(n));
    } catch (e) {
      console.warn('[tool-exp-chat] localStorage write failed', e);
    }
  }

  /**
   * 加载工具经验对话区：online 且已带 Bearer 时优先 GET 后端并回写本地；否则仅本地。
   */
  async function fetchToolExpChatState() {
    if (mode === 'online' && BACKEND_API_URL && hasBearerForKnowledgeTree()) {
      try {
        const authHeaders = global.getAuthHeaders();
        const res = await fetch(`${BACKEND_API_URL}/me/tool-experience/chat-state`, {
          method: 'GET',
          headers: { ...authHeaders },
        });
        if (typeof global.applyAuthRenewalFromResponse === 'function') {
          global.applyAuthRenewalFromResponse(res);
        }
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.payload && typeof data.payload === 'object') {
            const synced = normalizeToolExpChatState(data.payload);
            writeLocalToolExpChatState(synced);
            return synced;
          }
        }
      } catch (e) {
        console.warn('[tool-exp-chat] remote fetch failed, fallback local', e);
      }
    }
    return readLocalToolExpChatState();
  }

  /**
   * 保存对话区：始终写 localStorage；online 已登录时再 PUT 后端。
   */
  async function saveToolExpChatState(state) {
    const normalized = normalizeToolExpChatState(state);
    writeLocalToolExpChatState(normalized);
    if (mode === 'online' && BACKEND_API_URL && hasBearerForKnowledgeTree()) {
      const res = await fetch(`${BACKEND_API_URL}/me/tool-experience/chat-state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {}),
        },
        body: JSON.stringify({ payload: normalized }),
      });
      if (typeof global.applyAuthRenewalFromResponse === 'function') {
        global.applyAuthRenewalFromResponse(res);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(toolExpRemoteSaveErrorMessage('对话区', res.status, data));
      }
    }
    return normalized;
  }

  /**
   * 构建 LLM 消耗信息 HTML 片段。
   * @param {{usage?: Object, model?: string, durationMs?: number}} meta - 模型元信息。
   * @returns {string} 可直接插入页面的 HTML。
   */
  function buildLlmMetaHtml(meta) {
    if (!meta) return '';
    const totalTokens = meta.usage?.total_tokens ?? ((meta.usage?.prompt_tokens || 0) + (meta.usage?.completion_tokens || 0));
    return `<div class="problem-detail-chat-msg-llm-meta">模型: ${escapeHtml(meta.model || DEEPSEEK_MODEL)} | 消耗 token: ${totalTokens} | 耗时: ${meta.durationMs || 0}ms</div>`;
  }

  global.DEEPSEEK_API_URL = DEEPSEEK_API_URL;
  global.DEEPSEEK_API_KEY = DEEPSEEK_API_KEY;
  global.DEEPSEEK_MODEL = DEEPSEEK_MODEL;
  global.fetchDeepSeekChat = fetchDeepSeekChat;
  global.buildLlmMetaHtml = buildLlmMetaHtml;
  global.hasAiConfig = hasAiConfig;
  global.isAiChatTruncatedResponse = isAiChatTruncatedResponse;
  const TOOL_DETAIL_WORKSPACE_STORAGE_KEY = 'smart_cto_tool_detail_knowledge_v1';

  function emptyToolDetailWorkspace() {
    return { version: 1, byToolId: {} };
  }

  function normalizeToolDetailWorkspace(p) {
    const empty = emptyToolDetailWorkspace();
    if (!p || typeof p !== 'object') return empty;
    const byToolId = {};
    const raw = p.byToolId;
    if (raw && typeof raw === 'object') {
      for (const [id, entry] of Object.entries(raw)) {
        if (!entry || typeof entry !== 'object') continue;
        const groups = Array.isArray(entry.groups) ? entry.groups : [];
        const normGroups = [];
        for (const g of groups) {
          if (!g || typeof g !== 'object') continue;
          const featureKey = String(g.featureKey != null ? g.featureKey : '—').trim() || '—';
          const values = Array.isArray(g.values)
            ? g.values
                .filter((v) => v && typeof v === 'object')
                .map((v) => ({
                  value: String(v.value != null ? v.value : '—').trim() || '—',
                  featureId:
                    v.featureId != null && String(v.featureId).trim()
                      ? String(v.featureId).trim()
                      : undefined,
                }))
            : [];
          if (values.length) normGroups.push({ featureKey, values });
        }
        if (normGroups.length) {
          const summary =
            typeof entry.summary === 'string' && entry.summary.trim() ? entry.summary.trim() : undefined;
          byToolId[id] = { groups: normGroups, summary };
        }
      }
    }
    return { version: 1, byToolId };
  }

  function readLocalToolDetailWorkspace() {
    try {
      const raw = localStorage.getItem(TOOL_DETAIL_WORKSPACE_STORAGE_KEY);
      if (!raw) return emptyToolDetailWorkspace();
      return normalizeToolDetailWorkspace(JSON.parse(raw));
    } catch {
      return emptyToolDetailWorkspace();
    }
  }

  function writeLocalToolDetailWorkspace(store) {
    try {
      localStorage.setItem(TOOL_DETAIL_WORKSPACE_STORAGE_KEY, JSON.stringify(normalizeToolDetailWorkspace(store)));
    } catch (e) {
      console.warn('[tool-detail-workspace] localStorage write failed', e);
    }
  }

  /**
   * 加载工具详情工作画布：online 且已带 Bearer 时优先 GET 后端并回写本地；否则仅本地。
   */
  async function fetchToolDetailWorkspace() {
    if (mode === 'online' && BACKEND_API_URL && hasBearerForKnowledgeTree()) {
      try {
        const authHeaders = global.getAuthHeaders();
        const ac =
          typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(12000)
            : undefined;
        const res = await fetch(`${BACKEND_API_URL}/me/tool-detail/workspace`, {
          method: 'GET',
          headers: { ...authHeaders },
          ...(ac ? { signal: ac } : {}),
        });
        if (typeof global.applyAuthRenewalFromResponse === 'function') {
          global.applyAuthRenewalFromResponse(res);
        }
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.payload && typeof data.payload === 'object') {
            const synced = normalizeToolDetailWorkspace(data.payload);
            writeLocalToolDetailWorkspace(synced);
            return synced;
          }
        }
      } catch (e) {
        console.warn('[tool-detail-workspace] remote fetch failed, fallback local', e);
      }
    }
    return readLocalToolDetailWorkspace();
  }

  /**
   * 保存工具详情工作画布：始终写 localStorage；online 已登录时再 PUT 后端。
   */
  async function saveToolDetailWorkspace(store) {
    const normalized = normalizeToolDetailWorkspace(store);
    writeLocalToolDetailWorkspace(normalized);
    if (mode === 'online' && BACKEND_API_URL && hasBearerForKnowledgeTree()) {
      const res = await fetch(`${BACKEND_API_URL}/me/tool-detail/workspace`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {}),
        },
        body: JSON.stringify({ payload: normalized }),
      });
      if (typeof global.applyAuthRenewalFromResponse === 'function') {
        global.applyAuthRenewalFromResponse(res);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(toolExpRemoteSaveErrorMessage('工具详情工作画布', res.status, data));
      }
    }
    return normalized;
  }

  global.fetchToolExpKnowledgeTree = fetchToolExpKnowledgeTree;
  global.saveToolExpKnowledgeTree = saveToolExpKnowledgeTree;
  global.fetchToolExpChatState = fetchToolExpChatState;
  global.saveToolExpChatState = saveToolExpChatState;
  global.fetchToolDetailWorkspace = fetchToolDetailWorkspace;
  global.saveToolDetailWorkspace = saveToolDetailWorkspace;
})(typeof window !== 'undefined' ? window : this);
