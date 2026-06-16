/**
 * Storage HTTP 适配器：将数字化问题与聊天记录通过 Backend API 持久化。
 * 依赖 APP_CONFIG.BACKEND_API_URL，需在 config.js 之后加载。
 * 使用内存缓存 + 异步写回，兼容 main.js 的同步调用。
 *
 * [INPUT]: APP_CONFIG、getAuthHeaders、handleAuthError、localStorage 迁移键名
 * [OUTPUT]: global.STORAGE_HTTP_ADAPTER（列表/详情/聊天读写）
 * [POS]: online 模式下问题案例与消息的 HTTP 持久化适配层
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新本 Header 与 frontend/AGENTS.md（若对外行为变化）
 * FE-20260323：占位消息不写后端；saveProblemDetailChat 增 POST/DELETE/PATCH，非必要不 PUT
 * FE-20260323-02：saveProblemDetailChat 对 prev/next 做数组快照，避免与 UI 共用同一数组引用导致增量误判 noop
 * FE-20260411-chat-alias：saveProblemDetailChat 在非空写入时同步 problemChatsCache 的 id/createdAt 双键，与清空时双键逻辑对称，避免 main 去重只扫到陈旧单键而重复推 task1「初步需求提取」块
 * FE-20260415：problemChatsCache / taskSummaries 主键与 main `getProblemDetailChatStorageKey` 对齐——**优先 id 再 createdAt**，避免在线案详情 bundle 补全 createdAt 后缓存键从 problem_* 漂移到 ISO、误绑另一份会话
 * FE-20260415-reset：`clearProblemCaseTaskSummariesCacheForItem` 供顶栏「重置」清空内存 `problemTaskSummariesCache` 双键，避免沟通历史仍读旧任务 Skill 摘要
 * FE-20260415-msg-payload：`toMessagePayload` 剔除非法 `role`、规范 `taskId`/`taskName`/`type`；`saveProblemDetailChat` 对消息 DELETE/PATCH 遇 **404** 视为已不存在，避免控制台红错（重置后本地 id 与库不一致时）
 * FE-20260415-put-coerce：`updateDigitalProblem` PUT 前 `coerceProblemCasePutForBackend`，将重置合并中的 `null` 标量转为后端 Zod 可接受的 `''`/`false`（optional 不含 null 时 400）
 * FE-20260415-chat-clear：由非空清空为 `[]` 时优先 **PUT messages 全量 `items:[]`**，避免逐条 DELETE 本地未同步 id → 404 红字
 * FE-20260323-06：`init`/`reloadCachesFromBackend` 维护 `__STORAGE_HTTP_HYDRATED` 与 `storageBackendReady` 同序，`console.debug('[FE:http-hydration]')`
 * FE-20260323-08（废止）：曾按列表 createdAt 重排 1..n 作为 archiveNo，删除案例会导致编号重算。**FE-20260409-archive-no**：`archiveNo` 以服务端 `ProblemCase.archiveNo` 为准。**FE-20260409-archive-sticky**：若接口暂未带编号（未迁移等），用 `localStorage` `smart_cto_online_case_archive_no_v1` 按 `id`（无则 `createdAt`）粘滞分配，删除他案不重排已有号；服务端一旦有号则覆盖粘滞表。
 * FE-20260323-09：`init`/`reloadCachesFromBackend` 结束后置 `global.__STORAGE_HTTP_HYDRATED = true`，与 `main.js` `isProblemDetailStorageHydrated()` 对齐，避免详情聊天区永久「正在加载聊天记录…」
 * FE-20260322-06：`updateDigitalProblem` / `resolveCaseId` 对 `problemCasesCache` 按 `createdAt` 与 `id` 双键查找
 * FE-20260324-09：案例 PUT/create 载荷含 `coreBusinessObjectSystemPromptOverride`（task11 修改链路）
 * FE-20260324-16：`serializeMessageContent`/`hydrateMessageContentAfterLoad` 修复 task10/task11 推演卡片 `content` 对象被 `String()` 成「[object Object]」；`patchableFingerprint` 与序列化一致
 * FE-20260327：online 请求返回后仍统一调用 `applyAuthRenewalFromResponse`，但同 token 会话下不再依据响应头覆盖本地 token
 * FE-20260324-16：`authErrorFromRes` 向 `handleAuthError` 透传请求 URL 与错误 message，便于 `[FE:auth-401]` 诊断
 * FE-20260324-17：401 仍清 token 跳登录；403 仅 `handleAuthForbidden` 提示（与 `auth-runtime` 一致）
 * FE-20260325-06：新增 `clearProblemDetailCaches()`（online 跨账号清空案例列表/聊天/task summaries 内存缓存）；对 detail/chat/task 获取的 404/403 透传 status（由 main.js 统一切回安全态并提示“案例不存在或无权访问”）
 * FE-20260328-18：`removeTaskSummaryEntriesForRestart` 供「重启当前任务」剔除内存 `problemTaskSummariesCache` 中指定前端 taskId 对应条目（含 strategy-* / e2e-flow 等别名），与 main 截断聊天后沟通历史一致
 * FE-20260328-21：`toLegacyItem` 映射 `e2e_flow_landscape_json` → `e2eFlowLandscapeJson`（历史数据兼容；前端已不再展示端到端「压缩 json」Tab）
 * FE-20260331：`toLegacyItem` 补充 `preliminary_req` → `preliminaryReq`（防御性；服务端主契约见 prisma `mapProblemCase` 顶层抬升）
 * FE-20260402：顶层缺省时从 `basicInfo.__createContractExtras.preliminaryReq` 抬升，与 `buildResolvedPreliminaryRequirement` 一致，避免 GET/列表仅嵌套存储时工作区 view 空
 * FE-20260402-02：`e2e_transaction_flow_json` ↔ `e2eTransactionFlowJson`（task7 业务事务流 BPM JSON，与 create/update 载荷透传）。**FE-20260412-05**：`globalThis.__FE_E2E_WORKSPACE_DEBUG === true` 且 patch 含 `e2eTransactionFlowJson` 时打 `[FE:task7-e2e-workspace] http-adapter:PUT-e2eTransactionFlowJson`（caseId、JSON 字符长度），便于核对是否发起库表更新。
 * FE-20260403-20：`toLegacyItem` 将字符串形态的 `roleTaskCenterPortalDesignJson` 尝试 `JSON.parse`，供 task9 工作区与归一化逻辑消费对象形态。
 * FE-20260403-task9-debug：`globalThis.__FE_TASK9_PORTAL_DEBUG === true` 时 `updateDigitalProblem` 含 `roleTaskCenterPortalDesignJson` 会打 `[FE:task9-portal]`（缓存命中/PUT 响应）。
 * FE-20260408：`__FE_TASK8_IT_DESIGN_AUTO_SEQ_LOG === true` 且 `authErrorFromRes` 命中 `/problem-cases` 或 `/ai/` 时打 `[FE:task8-it-design-auto-seq][storage-http-auth]`（区分案例 PUT 401 与模型接口 401）。
 * FE-20260408-task8-persist：`upsertProblemCase` 合并 `itDesignSupplementSessions`，详情 GET 滞后或空数组时不覆盖内存中已单步 PUT 的进度；`toLegacyItem` 兼容 `it_design_supplement_sessions`。
 * FE-20260407-home：首页 `home.html` 路由首屏只预拉案例列表；先派发 `problemCasesChanged` 让列表渲染，再将聊天消息保留到详情 bundle / 显式刷新按需拉取，避免首页被全量 messages 请求串行阻塞。
 */
(function (global) {
  const cfg = (global.APP_CONFIG || {});
  const useRemoteStorage = (cfg.MODE === 'online');
  const baseUrl = (cfg.BACKEND_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
  const problemCasesPath = baseUrl + '/problem-cases';

  let problemCasesCache = [];
  let problemChatsCache = {};
  let problemTaskSummariesCache = {};

  function maybeApplyAuthRenewal(res) {
    if (!useRemoteStorage) return;
    if (typeof global.applyAuthRenewalFromResponse === 'function') global.applyAuthRenewalFromResponse(res);
  }

  /** online 下所有 fetch 走此包装，统一接后端续期响应头 */
  function fetchWithAuthRenewal(url, init) {
    return fetch(url, init).then((res) => {
      maybeApplyAuthRenewal(res);
      return res;
    });
  }

  /** 401/403 时解析 body message 并交给 auth-runtime（401 清 token 跳登录；403 仅提示） */
  async function authErrorFromRes(res, url) {
    if (!res || (res.status !== 401 && res.status !== 403)) return;
    let message = '';
    try {
      const j = await res.clone().json().catch(() => ({}));
      message = j && (j.message || j.error) ? String(j.message || j.error) : '';
    } catch (_) {}
    try {
      if (globalThis.__FE_TASK8_IT_DESIGN_AUTO_SEQ_LOG === true) {
        const u = String(url || '');
        if (u.includes('/problem-cases') || u.includes('/ai/')) {
          console.warn('[FE:task8-it-design-auto-seq][storage-http-auth]', {
            status: res.status,
            url: u.slice(0, 260),
            message: message.slice(0, 200),
          });
        }
      }
    } catch (_) {}
    if (typeof global.handleAuthError === 'function') global.handleAuthError(res.status, { url, message });
  }

  function buildAuthHeaders(extraHeaders) {
    const authHeaders = (typeof global.getAuthHeaders === 'function') ? global.getAuthHeaders() : {};
    return {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(extraHeaders || {}),
    };
  }

  function resolveCaseId(key) {
    if (!key) return key;
    const k = String(key);
    const item = problemCasesCache.find((it) => String(it.createdAt || '') === k || String(it.id || '') === k);
    return (item && item.id) ? item.id : key;
  }

  function isHomeShadowPagePath() {
    try {
      const pathname = String((global.location && global.location.pathname) || '');
      return pathname.endsWith('/home.html') || pathname.endsWith('home.html');
    } catch (_) {
      return false;
    }
  }

  function shouldPreloadAllChatsForCurrentRoute() {
    return !isHomeShadowPagePath();
  }

  function dispatchProblemCasesChanged(reason, extraDetail) {
    try {
      global.dispatchEvent(new CustomEvent('problemCasesChanged', {
        detail: {
          reason,
          ...(extraDetail || {}),
        },
      }));
    } catch (_) {}
  }

  const CREATE_CONTRACT_EXTRAS_META_KEY = '__createContractExtras';

  /** task8：按行合并 session，避免 GET 早于 PUT 或返回空数组时清掉本地已生成事务 */
  function mergeItDesignSupplementSessionsForCache(nextVal, prevVal) {
    const defined = [nextVal, prevVal].filter((x) => x != null && Array.isArray(x));
    if (defined.length === 0) return nextVal ?? prevVal;
    const arrs = defined.filter((x) => x.length > 0);
    if (arrs.length === 0) return defined[0];
    const base = arrs.reduce((best, cur) => (cur.length > best.length ? cur : best));
    return base.map((baseRow, idx) => {
      let acc = baseRow && typeof baseRow === 'object' ? { ...baseRow } : {};
      for (const arr of arrs) {
        const row = arr[idx];
        if (!row || typeof row !== 'object') continue;
        if (row.stageName != null && acc.stageName == null) acc.stageName = row.stageName;
        if (row.transactionId != null && acc.transactionId == null) acc.transactionId = row.transactionId;
        if (row.transactionName != null && acc.transactionName == null) acc.transactionName = row.transactionName;
        if (row.stepIndex != null && acc.stepIndex == null) acc.stepIndex = row.stepIndex;
        if (row.designOutputJson != null && acc.designOutputJson == null) acc.designOutputJson = row.designOutputJson;
        const md = row.bpmFlowDrawMarkdown;
        if (md != null && String(md).trim() !== '') {
          if (acc.bpmFlowDrawMarkdown == null || String(acc.bpmFlowDrawMarkdown).trim() === '') {
            acc.bpmFlowDrawMarkdown = md;
          }
        }
      }
      return acc;
    });
  }

  /** 与 preliminaryRequirement.js `readPreliminaryReqObjectFromItem` 同序：非空顶层优先，否则 extras 内 preliminaryReq */
  function readPreliminaryReqFromPayload(item) {
    if (!item || typeof item !== 'object') return undefined;
    const top = item.preliminaryReq ?? item.preliminary_req;
    let nested;
    const bi = item.basicInfo;
    if (bi && typeof bi === 'object' && !Array.isArray(bi)) {
      const meta = bi[CREATE_CONTRACT_EXTRAS_META_KEY];
      if (meta && typeof meta === 'object' && !Array.isArray(meta) && meta.preliminaryReq != null && typeof meta.preliminaryReq === 'object') {
        nested = meta.preliminaryReq;
      }
    }
    if (top && typeof top === 'object' && !Array.isArray(top) && Object.keys(top).length > 0) return top;
    if (nested && typeof nested === 'object' && Object.keys(nested).length > 0) return nested;
    if (top !== undefined && top !== null) return top;
    return nested;
  }

  const FE_ONLINE_ARCHIVE_STICKY_KEY = 'smart_cto_online_case_archive_no_v1';

  function normalizeArchiveNoFromApi(item) {
    const n = Number(item?.archiveNo ?? item?.archive_no);
    if (Number.isFinite(n) && n > 0) return n;
    return null;
  }

  function readOnlineArchiveStickyMap() {
    try {
      const raw = global.localStorage.getItem(FE_ONLINE_ARCHIVE_STICKY_KEY);
      const p = raw ? JSON.parse(raw) : {};
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch (_) {
      return {};
    }
  }

  function writeOnlineArchiveStickyMap(map) {
    try {
      global.localStorage.setItem(FE_ONLINE_ARCHIVE_STICKY_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  /** online 列表展示用：优先服务端 archiveNo；缺失时按案例键粘滞分配（不随删除他案重排） */
  function caseArchiveStickyKey(row) {
    const id = String(row && row.id != null ? row.id : '').trim();
    if (id) return id;
    return String(row && row.createdAt != null ? row.createdAt : '').trim();
  }

  function applyOnlineArchiveNoDisplayCache() {
    if (!useRemoteStorage || !Array.isArray(problemCasesCache)) return;
    try {
      const sticky = readOnlineArchiveStickyMap();
      let changedSticky = false;
      let maxAll = 0;
      for (let i = 0; i < problemCasesCache.length; i++) {
        const row = problemCasesCache[i];
        const n = normalizeArchiveNoFromApi(row);
        if (n != null) maxAll = Math.max(maxAll, n);
        const k = caseArchiveStickyKey(row);
        if (k) {
          const s = Number(sticky[k]);
          if (Number.isFinite(s) && s > 0) maxAll = Math.max(maxAll, s);
        }
      }
      let nextSeq = maxAll;
      const nextCache = problemCasesCache.map((it) => {
        const row = { ...it };
        const idStr = String(row.id || '').trim();
        const caStr = String(row.createdAt || '').trim();
        if (idStr && caStr && sticky[caStr] != null && sticky[idStr] == null) {
          sticky[idStr] = sticky[caStr];
          delete sticky[caStr];
          changedSticky = true;
        }
        const fromApi = normalizeArchiveNoFromApi(row);
        const k = caseArchiveStickyKey(row);
        if (!k) return row;
        if (fromApi != null) {
          if (Number(sticky[k]) !== fromApi) {
            sticky[k] = fromApi;
            changedSticky = true;
          }
          row.archiveNo = fromApi;
          return row;
        }
        let n = Number(sticky[k]);
        if (!(Number.isFinite(n) && n > 0)) {
          nextSeq += 1;
          n = nextSeq;
          sticky[k] = n;
          changedSticky = true;
        }
        row.archiveNo = n;
        return row;
      });
      if (changedSticky) writeOnlineArchiveStickyMap(sticky);
      problemCasesCache.splice(0, problemCasesCache.length, ...nextCache);
    } catch (_) {}
  }

  function toLegacyItem(item) {
    if (!item) return null;
    const archiveNoNorm = normalizeArchiveNoFromApi(item);
    return {
      ...item,
      ...(archiveNoNorm != null ? { archiveNo: archiveNoNorm } : {}),
      createdAt: item.createdAt || item.id,
      id: item.id,
      requirementDetail: item.requirementDetail ?? item.requirement_detail ?? '',
      requirementDetailHistory: item.requirementDetailHistory ?? item.requirement_detail_history ?? [],
      operationModel: item.operationModel ?? item.operation_model,
      businessStatus: item.businessStatus ?? item.business_status ?? '',
      urgencyAnalysis: item.urgencyAnalysis ?? item.urgency_analysis,
      task1InitialLlmQuery: item.task1InitialLlmQuery ?? item.task1_initial_llm_query ?? null,
      coreBusinessObjectSystemPromptOverride:
        item.coreBusinessObjectSystemPromptOverride ?? item.core_business_object_system_prompt_override,
      e2eFlowLandscapeJson: item.e2eFlowLandscapeJson ?? item.e2e_flow_landscape_json,
      e2eTransactionFlowJson: item.e2eTransactionFlowJson ?? item.e2e_transaction_flow_json,
      e2eRequirementScenarioSupplementJson:
        item.e2eRequirementScenarioSupplementJson ?? item.e2e_requirement_scenario_supplement_json,
      roleTaskCenterPortalDesignJson: (() => {
        const v = item.roleTaskCenterPortalDesignJson ?? item.role_task_center_portal_design_json;
        if (v != null && typeof v === 'string' && String(v).trim()) {
          try {
            return JSON.parse(String(v).trim().replace(/^\uFEFF/, ''));
          } catch (_) {
            return v;
          }
        }
        return v;
      })(),
      objectStateMachineJson: (() => {
        const v = item.objectStateMachineJson ?? item.object_state_machine_json;
        if (v != null && typeof v === 'string' && String(v).trim()) {
          try {
            return JSON.parse(String(v).trim().replace(/^\uFEFF/, ''));
          } catch (_) {
            return v;
          }
        }
        return v;
      })(),
      preliminaryReq: readPreliminaryReqFromPayload(item),
      task1PendingPreliminaryRequirement:
        item.task1PendingPreliminaryRequirement ?? item.task1_pending_preliminary_requirement,
      task1InitialLlmQuery: item.task1InitialLlmQuery ?? item.task1_initial_llm_query ?? null,
      valueStreamLogicText: item.valueStreamLogicText ?? item.value_stream_logic_text,
      valueStreamLogicTextMirror: item.valueStreamLogicTextMirror ?? item.value_stream_logic_text_mirror,
      valueStreamLogicTextHardening: item.valueStreamLogicTextHardening ?? item.value_stream_logic_text_hardening,
      itDesignSupplementSessions: item.itDesignSupplementSessions ?? item.it_design_supplement_sessions,
    };
  }

  /**
   * 新建案例：不传 id，由后端生成独立 caseId（不再用时间戳充当主键）。
   */
  function toCreatePayload(item) {
    return {
      customerName: String(item.customerName ?? item.customer_name ?? ''),
      customerNeedsOrChallenges: String(item.customerNeedsOrChallenges ?? item.customer_needs_or_challenges ?? ''),
      customerItStatus: String(item.customerItStatus ?? item.customer_it_status ?? ''),
      projectTimeRequirement: String(item.projectTimeRequirement ?? item.project_time_requirement ?? ''),
      requirementDetail: String(item.requirementDetail ?? item.requirement_detail ?? ''),
      requirementDetailHistory: Array.isArray(item.requirementDetailHistory) ? item.requirementDetailHistory : [],
      operationModel: item.operationModel,
      businessStatus: String(item.businessStatus ?? ''),
      urgencyAnalysis: item.urgencyAnalysis,
      currentMajorStage: Number(item.currentMajorStage ?? 0),
      currentItStrategySubstep: Number(item.currentItStrategySubstep ?? 0),
      completedStages: Array.isArray(item.completedStages) ? item.completedStages : [],
      workflowAlignCompletedStages: Array.isArray(item.workflowAlignCompletedStages) ? item.workflowAlignCompletedStages : [],
      itGapCompletedStages: Array.isArray(item.itGapCompletedStages) ? item.itGapCompletedStages : [],
      completedTaskIds: Array.isArray(item.completedTaskIds) ? item.completedTaskIds : [],
      basicInfo: item.basicInfo,
      bmc: item.bmc,
      requirementLogic: item.requirementLogic,
      valueStream: item.valueStream,
      valueStreamLogicText: item.valueStreamLogicText,
      valueStreamLogicTextMirror: item.valueStreamLogicTextMirror,
      valueStreamLogicTextHardening: item.valueStreamLogicTextHardening,
      e2eFlowLandscapeJson: item.e2eFlowLandscapeJson,
      e2eTransactionFlowJson: item.e2eTransactionFlowJson,
      e2eRequirementScenarioSupplementJson: item.e2eRequirementScenarioSupplementJson,
      globalItGapAnalysisJson: item.globalItGapAnalysisJson,
      globalItGapConstraintBaseMarkdown: item.globalItGapConstraintBaseMarkdown,
      itDesignSupplementSessions: item.itDesignSupplementSessions,
      localItGapSessions: item.localItGapSessions,
      localItGapAnalyses: item.localItGapAnalyses,
      roleTaskCenterPortalDesignJson: item.roleTaskCenterPortalDesignJson,
      objectStateMachineJson: item.objectStateMachineJson,
      rolePermissionSessions: item.rolePermissionSessions,
      coreBusinessObjectSessions: item.coreBusinessObjectSessions,
      coreBusinessObjectSystemPromptOverride:
        item.coreBusinessObjectSystemPromptOverride ?? item.core_business_object_system_prompt_override,
      preliminaryReq: item.preliminaryReq,
      task1PendingPreliminaryRequirement: item.task1PendingPreliminaryRequirement,
      task1InitialLlmQuery: item.task1InitialLlmQuery ?? item.task1_initial_llm_query ?? null,
    };
  }

  function toBackendPayload(item) {
    const createdAt = item.createdAt || item.id || new Date().toISOString();
    return {
      id: createdAt,
      customerName: String(item.customerName ?? item.customer_name ?? ''),
      customerNeedsOrChallenges: String(item.customerNeedsOrChallenges ?? item.customer_needs_or_challenges ?? ''),
      customerItStatus: String(item.customerItStatus ?? item.customer_it_status ?? ''),
      projectTimeRequirement: String(item.projectTimeRequirement ?? item.project_time_requirement ?? ''),
      requirementDetail: String(item.requirementDetail ?? item.requirement_detail ?? ''),
      requirementDetailHistory: Array.isArray(item.requirementDetailHistory) ? item.requirementDetailHistory : [],
      operationModel: item.operationModel,
      businessStatus: String(item.businessStatus ?? ''),
      urgencyAnalysis: item.urgencyAnalysis,
      currentMajorStage: Number(item.currentMajorStage ?? 0),
      currentItStrategySubstep: Number(item.currentItStrategySubstep ?? 0),
      completedStages: Array.isArray(item.completedStages) ? item.completedStages : [],
      workflowAlignCompletedStages: Array.isArray(item.workflowAlignCompletedStages) ? item.workflowAlignCompletedStages : [],
      itGapCompletedStages: Array.isArray(item.itGapCompletedStages) ? item.itGapCompletedStages : [],
      completedTaskIds: Array.isArray(item.completedTaskIds) ? item.completedTaskIds : [],
      basicInfo: item.basicInfo,
      bmc: item.bmc,
      requirementLogic: item.requirementLogic,
      valueStream: item.valueStream,
      valueStreamLogicText: item.valueStreamLogicText,
      valueStreamLogicTextMirror: item.valueStreamLogicTextMirror,
      valueStreamLogicTextHardening: item.valueStreamLogicTextHardening,
      e2eFlowLandscapeJson: item.e2eFlowLandscapeJson,
      e2eTransactionFlowJson: item.e2eTransactionFlowJson,
      e2eRequirementScenarioSupplementJson: item.e2eRequirementScenarioSupplementJson,
      globalItGapAnalysisJson: item.globalItGapAnalysisJson,
      globalItGapConstraintBaseMarkdown: item.globalItGapConstraintBaseMarkdown,
      itDesignSupplementSessions: item.itDesignSupplementSessions,
      localItGapSessions: item.localItGapSessions,
      localItGapAnalyses: item.localItGapAnalyses,
      roleTaskCenterPortalDesignJson: item.roleTaskCenterPortalDesignJson,
      objectStateMachineJson: item.objectStateMachineJson,
      rolePermissionSessions: item.rolePermissionSessions,
      coreBusinessObjectSessions: item.coreBusinessObjectSessions,
      coreBusinessObjectSystemPromptOverride:
        item.coreBusinessObjectSystemPromptOverride ?? item.core_business_object_system_prompt_override,
      preliminaryReq: item.preliminaryReq,
      task1PendingPreliminaryRequirement: item.task1PendingPreliminaryRequirement,
      task1InitialLlmQuery: item.task1InitialLlmQuery ?? item.task1_initial_llm_query ?? null,
    };
  }

  /** 后端消息表 content 为字符串：对象/数组必须 JSON 序列化，禁止 String(obj) 变成 "[object Object]"（task10/task11 推演卡片等） */
  function serializeMessageContent(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  /** 从服务端拉回的卡片：将 JSON 字符串 content 还原为对象，与内存/local 模式一致，便于渲染与工作区合并 */
  const MESSAGE_TYPES_WITH_JSON_OBJECT_CONTENT = new Set(['coreBusinessObjectAnalysisCard', 'rolePermissionAnalysisCard']);

  function hydrateMessageContentAfterLoad(m) {
    if (!m || typeof m.type !== 'string' || !MESSAGE_TYPES_WITH_JSON_OBJECT_CONTENT.has(m.type)) return m;
    const c = m.content;
    if (c == null || typeof c !== 'string' || c === '') return m;
    const t = c.trim();
    if (!(t.startsWith('{') || t.startsWith('['))) return m;
    try {
      return { ...m, content: JSON.parse(c) };
    } catch (_) {
      return m;
    }
  }

  /** POST/PUT/PATCH 与 Zod 对齐：剔除 ''、非法 role、非字符串 taskId 等，避免 400 */
  function toMessagePayload(m) {
    const id = m.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const content = serializeMessageContent(m.content);
    const timestamp =
      m.timestamp && typeof m.timestamp.endsWith === 'function' && m.timestamp.endsWith('Z')
        ? m.timestamp
        : new Date(m.timestamp || Date.now()).toISOString();
    const ROLE_OK = new Set(['user', 'assistant', 'system']);
    const out = { ...m, id, content, timestamp, confirmed: Boolean(m.confirmed) };
    if (m.role === null) {
      out.role = null;
    } else if (m.role === undefined || m.role === '') {
      delete out.role;
    } else {
      const rs = String(m.role).trim();
      if (ROLE_OK.has(rs)) out.role = rs;
      else delete out.role;
    }
    if (m.taskId === null) {
      out.taskId = null;
    } else if (m.taskId === undefined || m.taskId === '') {
      delete out.taskId;
    } else {
      const tid = String(m.taskId).trim();
      if (tid) out.taskId = tid;
      else {
        out.taskId = null;
      }
    }
    if (m.taskName === null) out.taskName = null;
    else if (m.taskName === undefined || m.taskName === '') delete out.taskName;
    else {
      const tn = String(m.taskName).trim();
      out.taskName = tn === '' ? null : tn;
    }
    if (m.type === null) out.type = null;
    else if (m.type === undefined || m.type === '') delete out.type;
    else {
      const ty = String(m.type).trim();
      out.type = ty === '' ? null : ty;
    }
    return out;
  }

  /** 与 main.js 空态占位一致，禁止写入后端 */
  const DEFAULT_CHAT_PLACEHOLDER = '请输入客户基本信息';

  function isPlaceholderOnlyPersistence(messages) {
    if (!Array.isArray(messages) || messages.length !== 1) return false;
    const m = messages[0];
    if (!m || m.role !== 'system') return false;
    if (String(m.content || '').trim() !== DEFAULT_CHAT_PLACEHOLDER) return false;
    if (m.type != null && m.type !== '') return false;
    return true;
  }

  /** owner 现场验证：在控制台执行 window.__FE_MSG_PERSIST_DEBUG = true 后观察 [FE:msg-persist]（含 prevLength/nextLength/sameArrayRef） */
  function msgPersistDebug(action, detail) {
    if (!global.__FE_MSG_PERSIST_DEBUG) return;
    try {
      const domMsgCount =
        typeof document !== 'undefined' && document.querySelectorAll
          ? document.querySelectorAll('.problem-detail-chat-msg').length
          : 'n/a';
      console.debug('[FE:msg-persist]', { action, domMsgCount, ...detail });
    } catch (_) {}
  }

  function stableTimestamp(m) {
    try {
      return new Date(m?.timestamp || 0).toISOString();
    } catch {
      return String(m?.timestamp || '');
    }
  }

  function stablePayloadJson(m) {
    try {
      return JSON.stringify(m.payloadJson !== undefined ? m.payloadJson : null);
    } catch {
      return '';
    }
  }

  function structuralKey(m) {
    return [m?.role || '', m?.type || '', m?.taskId || '', m?.taskName || ''].join('\u0001');
  }

  function structuralEqual(a, b) {
    return structuralKey(a) === structuralKey(b);
  }

  function patchableFingerprint(m) {
    return [serializeMessageContent(m?.content), Boolean(m?.confirmed), stableTimestamp(m), stablePayloadJson(m)].join('\u0002');
  }

  function isStrictAppend(prev, next) {
    if (!Array.isArray(prev) || !Array.isArray(next)) return false;
    if (next.length <= prev.length) return false;
    if (prev.length === 0) return next.length > 0;
    for (let i = 0; i < prev.length; i++) {
      if ((prev[i]?.id || '') !== (next[i]?.id || '')) return false;
    }
    return true;
  }

  function isStrictDelete(prev, next) {
    if (!Array.isArray(prev) || !Array.isArray(next)) return false;
    if (next.length >= prev.length) return false;
    let j = 0;
    for (let i = 0; i < prev.length; i++) {
      if (j < next.length && (prev[i]?.id || '') === (next[j]?.id || '')) j++;
    }
    return j === next.length;
  }

  function computeRemovedIds(prev, next) {
    const nextSet = new Set(next.map((m) => m?.id).filter(Boolean));
    return prev.map((m) => m?.id).filter(Boolean).filter((id) => !nextSet.has(id));
  }

  function isSameOrderSameIds(prev, next) {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i++) {
      if ((prev[i]?.id || '') !== (next[i]?.id || '')) return false;
    }
    return true;
  }

  function toPatchRequestBody(message) {
    const p = toMessagePayload(message);
    const body = {};
    if (p.content !== undefined) body.content = p.content;
    if (p.timestamp !== undefined) body.timestamp = p.timestamp;
    if (p.confirmed !== undefined) body.confirmed = p.confirmed;
    if (p.payloadJson !== undefined) body.payloadJson = p.payloadJson;
    if (p.role !== undefined) body.role = p.role;
    if (p.type !== undefined) body.type = p.type;
    if (p.taskId !== undefined) body.taskId = p.taskId;
    if (p.taskName !== undefined) body.taskName = p.taskName;
    return body;
  }

  /** `buildResetPreliminaryAdapterMergeClears` 等对栏位写 `null` 清空；后端 `updateProblemCaseSchema` 的 string/boolean optional 不接受 null */
  function coerceProblemCasePutForBackend(updates) {
    if (!updates || typeof updates !== 'object') return updates;
    const u = { ...updates };
    for (const k of ['customerNeedsOrChallenges', 'customerItStatus', 'projectTimeRequirement']) {
      if (u[k] === null) u[k] = '';
    }
    if (u.task1PendingPreliminaryRequirement === null) u.task1PendingPreliminaryRequirement = false;
    if (u.e2eFlowWorkspaceSuppressed === null) u.e2eFlowWorkspaceSuppressed = false;
    if (u.coreBusinessObjectSystemPromptOverride === null) u.coreBusinessObjectSystemPromptOverride = '';
    return u;
  }

  async function fetchJson(url, options) {
    const res = await fetchWithAuthRenewal(url, {
      headers: buildAuthHeaders(options && options.headers),
      ...options,
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await authErrorFromRes(res, url);
      }
      const err = new Error('Backend request failed: ' + res.status);
      err.status = res.status;
      err.url = url;
      throw err;
    }
    return res.json();
  }

  async function loadProblemCases() {
    try {
      // 避免浏览器对 GET 列表使用磁盘缓存：导入 POST 后若仍命中旧列表，会导致首页与 loadAllChats 均看不到新案例（FE-20260321-07）
      const data = await fetchJson(problemCasesPath, { cache: 'no-store' });
      const items = (data.items || []).map(toLegacyItem).filter(Boolean);
      problemCasesCache = items;
      applyOnlineArchiveNoDisplayCache();
    } catch (e) {
      console.warn('[storage-http-adapter] loadProblemCases failed:', e);
      problemCasesCache = [];
    }
  }

  /** 阶段四：localStorage 有数据且 Backend 无数据时，迁移到数据库 */
  async function migrateLocalToBackendIfNeeded() {
    /**
     * 安全态：online 多账号场景下，localStorage 可能残留上一账号的本地案例与聊天。
     * 若在“新账号后端列表为空”时自动迁移，会把上一账号数据写入当前账号（越界）。
     *
     * 因此本迁移默认关闭；仅在开发/单人环境显式打开开关时才允许执行。
     * - 打开方式：控制台 `window.__FE_ENABLE_LOCAL_MIGRATION_TO_BACKEND = true`
     */
    try {
      if (global.__FE_ENABLE_LOCAL_MIGRATION_TO_BACKEND !== true) return;
    } catch (_) {
      return;
    }

    const problemsKey = global.DIGITAL_PROBLEMS_STORAGE_KEY || 'digital_problem_followups';
    const chatsKey = global.PROBLEM_DETAIL_CHATS_STORAGE_KEY || 'problem_detail_chats';
    let localList = [];
    try {
      const raw = global.localStorage.getItem(problemsKey);
      localList = raw ? JSON.parse(raw) : [];
    } catch {
      return;
    }
    if (localList.length === 0) return;

    let backendItems = [];
    try {
      const data = await fetchJson(problemCasesPath);
      backendItems = data.items || [];
    } catch {
      return;
    }
    if (backendItems.length > 0) return;

    const localChats = (() => {
      try {
        const raw = global.localStorage.getItem(chatsKey);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })();

    for (const item of localList) {
      const localKey = item.id || item.createdAt;
      const createPayload = toCreatePayload({
        ...item,
        customerName: String(item.customerName ?? item.customer_name ?? '').trim() || '未命名',
      });
      let serverId = null;
      try {
        const res = await fetchWithAuthRenewal(problemCasesPath, {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify(createPayload),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            await authErrorFromRes(res, problemCasesPath);
          }
          throw new Error('POST failed: ' + res.status);
        }
        const saved = await res.json().catch(() => null);
        serverId = saved && saved.id ? saved.id : null;
        if (!serverId) {
          console.warn('[storage-http-adapter] migrate: POST 未返回 id，跳过该条');
          continue;
        }
      } catch (e) {
        console.warn('[storage-http-adapter] migrate create failed:', e);
        continue;
      }

      const id = serverId;
      const updates = toBackendPayload(item);
      delete updates.id;
      const migrateBaselineKeys = new Set([
        'customerName',
        'customerNeedsOrChallenges',
        'customerItStatus',
        'projectTimeRequirement',
        'requirementDetail',
        'requirementDetailHistory',
        'operationModel',
        'businessStatus',
        'urgencyAnalysis',
        'preliminaryReq',
        'task1PendingPreliminaryRequirement',
        'task1InitialLlmQuery',
      ]);
      const hasExtra = Object.keys(updates).some((k) => !migrateBaselineKeys.has(k) && updates[k] != null);
      if (hasExtra) {
        try {
          const res = await fetchWithAuthRenewal(problemCasesPath + '/' + encodeURIComponent(id), {
            method: 'PUT',
            headers: buildAuthHeaders(),
            body: JSON.stringify(updates),
          });
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              await authErrorFromRes(res, problemCasesPath + '/' + encodeURIComponent(id));
            }
            throw new Error('PUT failed: ' + res.status);
          }
        } catch (e) {
          console.warn('[storage-http-adapter] migrate update failed:', e);
        }
      }

      const chats = localChats[item.createdAt] || localChats[localKey] || localChats[id] || [];
      if (chats.length > 0) {
        const items = chats.map(toMessagePayload);
        try {
          const res = await fetchWithAuthRenewal(problemCasesPath + '/' + encodeURIComponent(id) + '/messages', {
            method: 'PUT',
            headers: buildAuthHeaders(),
            body: JSON.stringify({ items }),
          });
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              await authErrorFromRes(res, problemCasesPath + '/' + encodeURIComponent(id) + '/messages');
            }
            throw new Error('PUT messages failed: ' + res.status);
          }
        } catch (e) {
          console.warn('[storage-http-adapter] migrate messages failed:', e);
        }
      }
    }
  }

  async function loadChatsForCase(id) {
    try {
      const caseId = resolveCaseId(id);
      const data = await fetchJson(problemCasesPath + '/' + encodeURIComponent(caseId) + '/messages');
      return (data.items || []).map(toMessagePayload).map(hydrateMessageContentAfterLoad);
    } catch (e) {
      if (e && (e.status === 404 || e.status === 403)) throw e;
      return [];
    }
  }

  async function loadAllChats() {
    const map = {};
    for (const item of problemCasesCache) {
      // 聊天消息在后端以 problemCase.id 关联；内存键与 main getProblemDetailChatStorageKey 一致：有 id 时以 id 为主键
      const caseId = item.id || item.createdAt;
      const legacyKey = item.id || item.createdAt;
      if (caseId && legacyKey) map[legacyKey] = await loadChatsForCase(caseId);
    }
    problemChatsCache = map;
  }

  async function loadProblemCaseDetail(id) {
    const caseId = resolveCaseId(id);
    const data = await fetchJson(problemCasesPath + '/' + encodeURIComponent(caseId));
    return toLegacyItem(data);
  }

  async function loadTaskSummariesForCase(id) {
    try {
      const caseId = resolveCaseId(id);
      const data = await fetchJson(problemCasesPath + '/' + encodeURIComponent(caseId) + '/tasks');
      return Array.isArray(data.items) ? data.items : [];
    } catch (e) {
      if (e && (e.status === 404 || e.status === 403)) throw e;
      return [];
    }
  }

  function upsertProblemCase(item) {
    if (!item) return null;
    const nextItem = toLegacyItem(item);
    const key = nextItem.id || nextItem.createdAt;
    const idx = problemCasesCache.findIndex((it) => (it.createdAt || it.id) === key || it.id === nextItem.id);
    if (idx >= 0) {
      const prev = problemCasesCache[idx];
      problemCasesCache[idx] = {
        ...nextItem,
        archiveNo: nextItem.archiveNo ?? prev?.archiveNo,
        // 后端列表/详情未回传时，保留前端持久化的 task1 初步需求 LLM 查询快照
        task1InitialLlmQuery: nextItem.task1InitialLlmQuery ?? prev?.task1InitialLlmQuery ?? null,
        preliminaryReq: nextItem.preliminaryReq ?? prev?.preliminaryReq,
        task1PendingPreliminaryRequirement:
          nextItem.task1PendingPreliminaryRequirement ?? prev?.task1PendingPreliminaryRequirement,
        valueStreamLogicTextMirror: nextItem.valueStreamLogicTextMirror ?? prev?.valueStreamLogicTextMirror,
        valueStreamLogicTextHardening: nextItem.valueStreamLogicTextHardening ?? prev?.valueStreamLogicTextHardening,
        valueStreamLogicText: nextItem.valueStreamLogicText ?? prev?.valueStreamLogicText,
        itDesignSupplementSessions: mergeItDesignSupplementSessionsForCache(
          nextItem.itDesignSupplementSessions,
          prev?.itDesignSupplementSessions,
        ),
        e2eRequirementScenarioSupplementJson:
          nextItem.e2eRequirementScenarioSupplementJson ?? prev?.e2eRequirementScenarioSupplementJson,
      };
    }
    else problemCasesCache.unshift(nextItem);
    applyOnlineArchiveNoDisplayCache();
    // 须返回缓存内引用（含服务端 archiveNo），避免调用方拿到陈旧合并结果
    const idxAfter = problemCasesCache.findIndex((it) => (it.createdAt || it.id) === key || it.id === nextItem.id);
    return idxAfter >= 0 ? problemCasesCache[idxAfter] : nextItem;
  }

  async function refreshProblemDetailBundle(key) {
    const caseId = resolveCaseId(key);
    if (!caseId) return null;

    const cachedItem = problemCasesCache.find((it) => (it.createdAt || it.id) === key || it.id === caseId) || null;
    const legacyKey = cachedItem?.id || cachedItem?.createdAt || key;

    let item = cachedItem;
    let messages = problemChatsCache[legacyKey] || [];
    let taskSummaries = problemTaskSummariesCache[legacyKey] || [];

    try {
      item = await loadProblemCaseDetail(caseId);
    } catch (e) {
      if (e && (e.status === 404 || e.status === 403)) throw e;
      item = cachedItem;
    }

    try {
      messages = await loadChatsForCase(caseId);
    } catch (e) {
      if (e && (e.status === 404 || e.status === 403)) throw e;
      messages = problemChatsCache[legacyKey] || [];
    }

    try {
      taskSummaries = await loadTaskSummariesForCase(caseId);
    } catch (e) {
      if (e && (e.status === 404 || e.status === 403)) throw e;
      taskSummaries = problemTaskSummariesCache[legacyKey] || [];
    }

    const nextItem = item ? upsertProblemCase(item) : cachedItem;
    const nextKey = nextItem?.id || nextItem?.createdAt || legacyKey;
    problemChatsCache[nextKey] = Array.isArray(messages) ? messages : [];
    problemTaskSummariesCache[nextKey] = Array.isArray(taskSummaries) ? taskSummaries : [];

    return {
      item: nextItem || null,
      messages: problemChatsCache[nextKey],
      taskSummaries: problemTaskSummariesCache[nextKey],
    };
  }

  /** 与 main.js `isProblemDetailStorageHydrated` 对齐；`console.debug('[FE:http-hydration]')` 供 owner 过滤 */
  function logHttpHydration(phase, extra) {
    if (!useRemoteStorage) return;
    try {
      console.debug('[FE:http-hydration]', {
        phase,
        __STORAGE_HTTP_HYDRATED: global.__STORAGE_HTTP_HYDRATED,
        ...(extra || {}),
      });
    } catch (_) {}
  }

  async function init() {
    if (!useRemoteStorage) return;
    global.__STORAGE_HTTP_HYDRATED = false;
    logHttpHydration('init-before');
    try {
      const preloadAllChats = shouldPreloadAllChatsForCurrentRoute();
      await migrateLocalToBackendIfNeeded();
      await loadProblemCases();
      dispatchProblemCasesChanged('http-init-problem-cases-loaded', {
        preloadAllChats,
        route: isHomeShadowPagePath() ? 'home' : 'default',
      });
      if (preloadAllChats) {
        await loadAllChats();
      }
    } catch (e) {
      console.warn('[storage-http-adapter] init failed:', e);
    } finally {
      // 与 IndexedDB 适配器 __STORAGE_INDEXEDDB_HYDRATED 对称；main.js initProblemDetailChat 依赖此标志决定是否可落默认占位
      global.__STORAGE_HTTP_HYDRATED = true;
      logHttpHydration('init-after');
    }
    logHttpHydration('storageBackendReady-before-dispatch');
    global.dispatchEvent(new CustomEvent('storageBackendReady'));
    logHttpHydration('storageBackendReady-after-dispatch');
  }

  init();

  /** 与 main.js `mapRollbackCtxTaskId` 对齐，用于比对 task summary 条目的 taskId */
  function normalizeTaskSummaryEntryKeyForRestart(raw) {
    if (raw == null || raw === '') return '';
    const s = String(raw).trim();
    if (s === 'task10' || s === 'task11') return 'task12';
    const alias = {
      'e2e-flow': 'task7',
      'global-itgap': 'task8',
      'local-itgap': 'task9',
      'strategy-0': 'task12',
      'strategy-1': 'task12',
    };
    if (alias[s]) return alias[s];
    const strategyMatch = s.match(/^strategy-(\d+)$/);
    if (strategyMatch) {
      const ix = Number(strategyMatch[1]);
      if (Number.isInteger(ix) && (ix === 0 || ix === 1)) return 'task12';
      if (Number.isInteger(ix) && ix >= 2 && ix <= 5) return 'task' + String(ix + 10);
    }
    return s;
  }

  /** 「重启当前」时从内存缓存剔除该任务摘要，避免沟通历史仍显示旧 objective/评价标准 */
  function stripProblemTaskSummariesCacheForRestart(lookupKey, frontendTaskId) {
    if (!lookupKey || !frontendTaskId) return;
    const target = normalizeTaskSummaryEntryKeyForRestart(frontendTaskId);
    const keys = new Set([String(lookupKey)]);
    const cid = resolveCaseId(lookupKey);
    if (cid) keys.add(String(cid));
    keys.forEach((k) => {
      const arr = problemTaskSummariesCache[k];
      if (!Array.isArray(arr)) return;
      problemTaskSummariesCache[k] = arr.filter((entry) => {
        const raw = entry?.taskId;
        if (raw == null || raw === '') return true;
        return normalizeTaskSummaryEntryKeyForRestart(raw) !== target;
      });
    });
  }

  const HttpAdapter = {
    getDigitalProblems() {
      return problemCasesCache;
    },

    removeTaskSummaryEntriesForRestart(lookupKey, frontendTaskId) {
      stripProblemTaskSummariesCacheForRestart(lookupKey, frontendTaskId);
    },

    /** 顶栏「重置」后清空内存任务摘要缓存（沟通历史任务 Skill 等曾依赖 GET /tasks 缓存） */
    clearProblemCaseTaskSummariesCacheForItem(item) {
      if (!item || typeof item !== 'object') return;
      const keys = [];
      if (item.id != null && String(item.id).trim() !== '') keys.push(String(item.id).trim());
      if (item.createdAt != null && String(item.createdAt).trim() !== '') keys.push(String(item.createdAt).trim());
      [...new Set(keys)].forEach((k) => {
        problemTaskSummariesCache[k] = [];
      });
    },

    clearProblemDetailCaches() {
      problemCasesCache = [];
      problemChatsCache = {};
      problemTaskSummariesCache = {};
    },

    saveDigitalProblem(item) {
      const clientCreatedAt = item.createdAt || new Date().toISOString();
      const createPayload = toCreatePayload({ ...item, createdAt: clientCreatedAt });
      const optimistic = toLegacyItem({
        ...item,
        ...createPayload,
        createdAt: clientCreatedAt,
        id: undefined,
      });
      problemCasesCache.unshift(optimistic);
      applyOnlineArchiveNoDisplayCache();

      fetchWithAuthRenewal(problemCasesPath, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify(createPayload),
      })
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) await authErrorFromRes(res, problemCasesPath);
            return null;
          }
          return res.json().catch(() => null);
        })
        .then((saved) => {
          if (!saved || !saved.id) return;
          const merged = toLegacyItem(saved);
          const idx = problemCasesCache.findIndex(
            (it) => String(it.createdAt) === String(clientCreatedAt) && (it.id == null || it.id === clientCreatedAt),
          );
          if (idx >= 0) {
            const prev = problemCasesCache[idx];
            problemCasesCache[idx] = {
              ...merged,
              archiveNo: merged.archiveNo ?? prev?.archiveNo,
              // task1 初步需求 LLM 查询为前端复用字段，后端详情未返回时保留本地值
              task1InitialLlmQuery: merged.task1InitialLlmQuery ?? prev?.task1InitialLlmQuery ?? null,
              preliminaryReq: merged.preliminaryReq ?? prev?.preliminaryReq,
              task1PendingPreliminaryRequirement:
                merged.task1PendingPreliminaryRequirement ?? prev?.task1PendingPreliminaryRequirement,
            };
          } else {
            upsertProblemCase(merged);
          }
          if (idx >= 0) applyOnlineArchiveNoDisplayCache();

          const oldChatKey = clientCreatedAt;
          const newKey = merged.id || merged.createdAt;
          if (oldChatKey !== newKey && problemChatsCache[oldChatKey]) {
            problemChatsCache[newKey] = problemChatsCache[oldChatKey];
            delete problemChatsCache[oldChatKey];
          }
          if (oldChatKey !== newKey && problemTaskSummariesCache[oldChatKey]) {
            problemTaskSummariesCache[newKey] = problemTaskSummariesCache[oldChatKey];
            delete problemTaskSummariesCache[oldChatKey];
          }
          dispatchProblemCasesChanged('saveDigitalProblem-server-ack', {
            caseId: merged.id || null,
            createdAt: merged.createdAt || null,
            clientCreatedAt,
          });
        })
        .catch((e) => console.warn('[storage-http-adapter] saveDigitalProblem failed:', e));
    },

    removeDigitalProblem(index) {
      if (index < 0 || index >= problemCasesCache.length) return;
      const item = problemCasesCache[index];
      const id = item.id || item.createdAt;
      const cacheKey = item.id || item.createdAt;
      problemCasesCache.splice(index, 1);
      delete problemChatsCache[cacheKey];
      delete problemTaskSummariesCache[cacheKey];
      if (id) {
        fetchWithAuthRenewal(problemCasesPath + '/' + encodeURIComponent(id), {
          method: 'DELETE',
          headers: buildAuthHeaders(),
        })
          .then((res) => {
            if (!res.ok && (res.status === 401 || res.status === 403)) void authErrorFromRes(res, problemCasesPath + '/' + encodeURIComponent(id));
          })
          .catch((e) => console.warn('[storage-http-adapter] removeDigitalProblem failed:', e));
      }
    },

    updateDigitalProblem(createdAt, updates) {
      const key = String(createdAt);
      const idx = problemCasesCache.findIndex(
        (it) => String(it.createdAt || '') === key || String(it.id || '') === key,
      );
      const t9Dbg =
        globalThis.__FE_TASK9_PORTAL_DEBUG === true &&
        updates &&
        Object.prototype.hasOwnProperty.call(updates, 'roleTaskCenterPortalDesignJson');
      if (idx < 0) {
        if (t9Dbg) {
          try {
            console.warn('[FE:task9-portal]', 'http-adapter:updateDigitalProblem:cache-miss', {
              key,
              cacheLen: problemCasesCache.length,
              sampleKeys: problemCasesCache.slice(0, 5).map((it) => ({
                ca: it?.createdAt,
                id: it?.id,
              })),
            });
          } catch (_) {}
        }
        if (
          globalThis.__FE_E2E_WORKSPACE_DEBUG === true &&
          updates &&
          Object.prototype.hasOwnProperty.call(updates, 'e2eTransactionFlowJson')
        ) {
          try {
            console.warn('[FE:task7-e2e-workspace]', 'http-adapter:updateDigitalProblem:cache-miss-e2e', {
              key,
              cacheLen: problemCasesCache.length,
            });
          } catch (_) {}
        }
        return;
      }
      if (t9Dbg) {
        try {
          const v = updates.roleTaskCenterPortalDesignJson;
          console.debug('[FE:task9-portal]', 'http-adapter:updateDigitalProblem:cache-hit', {
            key,
            idx,
            caseId: resolveCaseId(createdAt),
            portalJsonType: v == null ? 'nil' : typeof v,
            portalIsArray: Array.isArray(v),
          });
        } catch (_) {}
      }
      const item = { ...problemCasesCache[idx], ...updates };
      problemCasesCache[idx] = item;
      applyOnlineArchiveNoDisplayCache();
      const caseId = resolveCaseId(createdAt);
      if (
        globalThis.__FE_E2E_WORKSPACE_DEBUG === true &&
        updates &&
        Object.prototype.hasOwnProperty.call(updates, 'e2eTransactionFlowJson')
      ) {
        try {
          const j = updates.e2eTransactionFlowJson;
          let jsonChars = 0;
          if (j != null && typeof j === 'object') {
            try {
              jsonChars = JSON.stringify(j).length;
            } catch (_) {
              jsonChars = -1;
            }
          }
          console.log('[FE:task7-e2e-workspace]', 'http-adapter:PUT-e2eTransactionFlowJson', {
            caseId,
            jsonChars,
            isObject: j != null && typeof j === 'object',
          });
        } catch (_) {}
      }
      fetchWithAuthRenewal(problemCasesPath + '/' + encodeURIComponent(caseId), {
        method: 'PUT',
        headers: buildAuthHeaders(),
        body: JSON.stringify(coerceProblemCasePutForBackend(updates)),
      })
        .then((res) => {
          if (t9Dbg) {
            try {
              console.debug('[FE:task9-portal]', 'http-adapter:updateDigitalProblem:put-response', {
                caseId,
                ok: res.ok,
                status: res.status,
              });
            } catch (_) {}
          }
          if (!res.ok && (res.status === 401 || res.status === 403)) void authErrorFromRes(res, problemCasesPath + '/' + encodeURIComponent(caseId));
        })
        .catch((e) => console.warn('[storage-http-adapter] updateDigitalProblem failed:', e));
    },

    getProblemDetailChats() {
      return problemChatsCache;
    },

    getProblemDetailTaskSummaries() {
      return problemTaskSummariesCache;
    },

    refreshProblemDetailBundle(key) {
      return refreshProblemDetailBundle(key);
    },

    /**
     * 将详情 GET 的 JSON 合并进内存 `problemCasesCache`（导入兜底路径在 main 内直接 fetch 时未经过 upsert，会导致首页列表缺项；FE-20260321-07）
     */
    upsertCaseFromDetailPayload(payload) {
      if (!useRemoteStorage) return null;
      return upsertProblemCase(payload);
    },

    /** 导入成功后重拉案例列表与聊天缓存（FE-20260321-03），不扩本地模型 */
    async reloadCachesFromBackend() {
      if (!useRemoteStorage) return;
      global.__STORAGE_HTTP_HYDRATED = false;
      logHttpHydration('reloadCaches-before');
      try {
        const preloadAllChats = shouldPreloadAllChatsForCurrentRoute();
        await loadProblemCases();
        dispatchProblemCasesChanged('http-reload-problem-cases-loaded', {
          preloadAllChats,
          route: isHomeShadowPagePath() ? 'home' : 'default',
        });
        if (preloadAllChats) {
          await loadAllChats();
        }
      } catch (e) {
        console.warn('[storage-http-adapter] reloadCachesFromBackend failed:', e);
      } finally {
        global.__STORAGE_HTTP_HYDRATED = true;
        logHttpHydration('reloadCaches-after');
      }
      logHttpHydration('storageBackendReady-before-dispatch');
      global.dispatchEvent(new CustomEvent('storageBackendReady'));
      logHttpHydration('storageBackendReady-after-dispatch');
    },

    saveProblemDetailChat(createdAt, messages) {
      // 保存前快照：prev 与 next 必须与调用方传入的 messages、以及彼此，在「数组引用」上解耦，否则 push 后 diff 会误判为 noop
      const prevCache = problemChatsCache[createdAt];
      const sameArrayRef = messages === prevCache;
      const prevMessages = Array.isArray(prevCache) ? prevCache.slice() : [];
      const nextMessages = Array.isArray(messages) ? messages.slice() : [];

      function ensureMessageId(m) {
        if (!m) return;
        if (m.id) return;
        m.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      }

      prevMessages.forEach(ensureMessageId);
      nextMessages.forEach(ensureMessageId);

      problemChatsCache[createdAt] = nextMessages;
      // 非空写入时同步案例 id/createdAt 双键指向同一数组，避免 `gatherTask1PreliminaryLlmDedupMessageLists` 扫到另一键陈旧副本而重复 push「初步需求提取」等块（FE-20260411-chat-alias）
      if (Array.isArray(nextMessages) && nextMessages.length > 0) {
        const row = problemCasesCache.find(
          (it) => String(it.createdAt || '') === String(createdAt) || String(it.id || '') === String(createdAt),
        );
        if (row) {
          if (row.createdAt != null) problemChatsCache[String(row.createdAt)] = nextMessages;
          if (row.id != null) problemChatsCache[String(row.id)] = nextMessages;
        }
      }
      // 清空聊天时同步别名键，避免 getChatsForProblem 回退读到 id/createdAt 另一键上的旧缓存，沟通历史过程日志不空
      if (Array.isArray(nextMessages) && nextMessages.length === 0) {
        const row = problemCasesCache.find(
          (it) => String(it.createdAt || '') === String(createdAt) || String(it.id || '') === String(createdAt),
        );
        if (row) {
          if (row.createdAt != null) problemChatsCache[String(row.createdAt)] = [];
          if (row.id != null) problemChatsCache[String(row.id)] = [];
        }
      }

      const caseId = resolveCaseId(createdAt);
      if (!caseId) return;

      const persistDims = {
        prevLength: prevMessages.length,
        nextLength: nextMessages.length,
        sameArrayRef,
      };
      msgPersistDebug('save-entry', { caseId, method: 'save-entry', ...persistDims });

      const baseUrlMsg = problemCasesPath + '/' + encodeURIComponent(caseId) + '/messages';

      if (isPlaceholderOnlyPersistence(nextMessages)) {
        problemChatsCache[createdAt] = [];
        msgPersistDebug('skip-placeholder', { caseId, method: 'none', ...persistDims });
        return;
      }

      // 非空 → 空：全量 PUT 替换，避免对仅存在于前端的 msg id 逐条 DELETE（服务端 404 仍会在 Network 面板出现）
      if (nextMessages.length === 0 && prevMessages.length > 0) {
        msgPersistDebug('put', { caseId, method: 'PUT', reason: 'clear-all', ...persistDims });
        fetchWithAuthRenewal(baseUrlMsg, {
          method: 'PUT',
          headers: buildAuthHeaders(),
          body: JSON.stringify({ items: [] }),
        })
          .then((res) => {
            if (!res.ok && (res.status === 401 || res.status === 403)) void authErrorFromRes(res, baseUrlMsg);
          })
          .catch((e) => console.warn('[storage-http-adapter] saveProblemDetailChat clear-all failed:', e));
        return;
      }

      function doPut(reason) {
        msgPersistDebug('put', { caseId, method: 'PUT', reason, ...persistDims });
        const items = nextMessages.map(toMessagePayload);
        fetchWithAuthRenewal(baseUrlMsg, {
          method: 'PUT',
          headers: buildAuthHeaders(),
          body: JSON.stringify({ items }),
        })
          .then((res) => {
            if (!res.ok && (res.status === 401 || res.status === 403)) void authErrorFromRes(res, baseUrlMsg);
          })
          .catch((e) => console.warn('[storage-http-adapter] saveProblemDetailChat failed:', e));
      }

      function patchOne(m) {
        const body = toPatchRequestBody(m);
        return fetchWithAuthRenewal(baseUrlMsg + '/' + encodeURIComponent(m.id), {
          method: 'PATCH',
          headers: buildAuthHeaders(),
          body: JSON.stringify(body),
        })
          .then((res) => {
            if (!res.ok) {
              if (res.status === 404) return null;
              if (res.status === 401 || res.status === 403) void authErrorFromRes(res, baseUrlMsg + '/' + encodeURIComponent(m.id));
              return null;
            }
            return res.json().catch(() => null);
          })
          .then((saved) => {
            if (saved && saved.id) {
              const idx = nextMessages.findIndex((x) => x && x.id === saved.id);
              if (idx >= 0) nextMessages[idx] = { ...nextMessages[idx], ...saved };
            }
          });
      }

      // 单条追加：长度 +1 且前缀 id 完全一致
      if (prevMessages.length + 1 === nextMessages.length) {
        const prevPrefix = prevMessages.map((m) => m?.id).slice(0, prevMessages.length);
        const nextPrefix = nextMessages.map((m) => m?.id).slice(0, prevMessages.length);
        const prefixOk = prevPrefix.every((id, idx) => id && id === nextPrefix[idx]);
        if (prefixOk) {
          const appended = nextMessages[nextMessages.length - 1];
          const payload = toMessagePayload(appended);
          msgPersistDebug('post-append', { caseId, method: 'POST', ...persistDims });
          fetchWithAuthRenewal(baseUrlMsg, {
            method: 'POST',
            headers: buildAuthHeaders(),
            body: JSON.stringify(payload),
          })
            .then((res) => {
              if (!res.ok) {
                if (res.status === 401 || res.status === 403) void authErrorFromRes(res, baseUrlMsg);
              }
              return res.ok ? res.json().catch(() => null) : null;
            })
            .then((saved) => {
              if (saved && saved.id) {
                const lastIdx = nextMessages.findIndex((mm) => mm && mm.id === saved.id);
                if (lastIdx >= 0) nextMessages[lastIdx] = { ...nextMessages[lastIdx], ...saved };
              }
            })
            .catch((e) => console.warn('[storage-http-adapter] appendProblemDetailChat failed:', e));
          return;
        }
      }

      // 严格尾部多条追加（如批量恢复）
      if (isStrictAppend(prevMessages, nextMessages)) {
        const appended = nextMessages.slice(prevMessages.length);
        if (appended.length > 1) {
          msgPersistDebug('post-append-multi', { caseId, method: 'POST', count: appended.length, ...persistDims });
          let chain = Promise.resolve();
          appended.forEach((msg) => {
            chain = chain.then(() =>
              fetchWithAuthRenewal(baseUrlMsg, {
                method: 'POST',
                headers: buildAuthHeaders(),
                body: JSON.stringify(toMessagePayload(msg)),
              })
                .then((res) => {
                  if (!res.ok) {
                    if (res.status === 401 || res.status === 403) void authErrorFromRes(res, baseUrlMsg);
                    return null;
                  }
                  return res.json().catch(() => null);
                })
                .then((saved) => {
                  if (saved && saved.id) {
                    const idx = nextMessages.findIndex((mm) => mm && mm.id === saved.id);
                    if (idx >= 0) nextMessages[idx] = { ...nextMessages[idx], ...saved };
                  }
                }),
            );
          });
          chain.catch((e) => console.warn('[storage-http-adapter] multi-append failed:', e));
          return;
        }
      }

      // 严格子序列删除多条（先于单条删除）
      if (isStrictDelete(prevMessages, nextMessages)) {
        const removed = computeRemovedIds(prevMessages, nextMessages);
        if (removed.length === prevMessages.length - nextMessages.length && removed.length > 1) {
          msgPersistDebug('delete-multi', { caseId, method: 'DELETE', count: removed.length, ...persistDims });
          let chain = Promise.resolve();
          removed.forEach((rid) => {
            chain = chain.then(() =>
              fetchWithAuthRenewal(baseUrlMsg + '/' + encodeURIComponent(rid), {
                method: 'DELETE',
                headers: buildAuthHeaders(),
              }).then((res) => {
                if (!res.ok && res.status === 404) return;
                if (!res.ok && (res.status === 401 || res.status === 403)) void authErrorFromRes(res, baseUrlMsg + '/' + encodeURIComponent(rid));
              }),
            );
          });
          chain.catch((e) => console.warn('[storage-http-adapter] multi-delete failed:', e));
          return;
        }
      }

      // 单条删除
      if (prevMessages.length - 1 === nextMessages.length) {
        const prevIds = prevMessages.map((m) => m?.id).filter(Boolean);
        const nextIds = new Set(nextMessages.map((m) => m?.id).filter(Boolean));
        const removedId = prevIds.find((id) => !nextIds.has(id));
        if (removedId) {
          msgPersistDebug('delete-one', { caseId, method: 'DELETE', messageId: removedId, ...persistDims });
          fetchWithAuthRenewal(baseUrlMsg + '/' + encodeURIComponent(removedId), {
            method: 'DELETE',
            headers: buildAuthHeaders(),
          })
            .then((res) => {
              if (!res.ok && res.status === 404) return;
              if (!res.ok && (res.status === 401 || res.status === 403)) void authErrorFromRes(res, baseUrlMsg + '/' + encodeURIComponent(removedId));
            })
            .catch((e) => console.warn('[storage-http-adapter] deleteProblemDetailChat failed:', e));
          return;
        }
      }

      // 同序同 id：仅内容/确认态/载荷/时间等变化 -> PATCH
      if (isSameOrderSameIds(prevMessages, nextMessages)) {
        const patchTargets = [];
        for (let i = 0; i < prevMessages.length; i++) {
          if (!structuralEqual(prevMessages[i], nextMessages[i])) {
            doPut('structural-mismatch');
            return;
          }
          if (patchableFingerprint(prevMessages[i]) !== patchableFingerprint(nextMessages[i])) {
            patchTargets.push(nextMessages[i]);
          }
        }
        if (patchTargets.length === 0) {
          msgPersistDebug('noop', { caseId, method: 'none', ...persistDims });
          return;
        }
        if (patchTargets.length === 1) {
          msgPersistDebug('patch-one', { caseId, method: 'PATCH', messageId: patchTargets[0].id, ...persistDims });
        } else {
          msgPersistDebug('patch-multi', { caseId, method: 'PATCH', count: patchTargets.length, ...persistDims });
        }
        let chain = Promise.resolve();
        patchTargets.forEach((mm) => {
          chain = chain.then(() => patchOne(mm));
        });
        chain.catch((e) => console.warn('[storage-http-adapter] patch messages failed:', e));
        return;
      }

      doPut('fallback');
    },
  };

  global.STORAGE_HTTP_ADAPTER = HttpAdapter;
})(typeof window !== 'undefined' ? window : this);
